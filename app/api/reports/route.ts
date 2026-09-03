import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, interventions, reports } from "@/db/schema";
import { canAccessIntervention, requireAuthContext } from "@/lib/auth-context";
import { readJsonRequest } from "../interventions/validation";
import { canFinalizeReport, validateReport } from "./validation";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

class InterventionNotFoundError extends Error {}
class InvalidInterventionStatusError extends Error {}
class ConcurrentReportFinalizationError extends Error {}

function errorResponse(message: string, status: number, details?: unknown) {
  return Response.json(
    details === undefined ? { error: message } : { error: message, details },
    { status, headers: NO_STORE_HEADERS },
  );
}

function isSqliteConcurrencyError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const sqliteCode = "code" in error ? String(error.code) : "";
  return sqliteCode.startsWith("SQLITE_BUSY") || error.message.includes("database is locked");
}

export async function GET(request: Request) {
  const authenticated = await requireAuthContext(request);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  try {
    const db = getDb();
    const visibleInterventions = await db.select().from(interventions)
      .where(eq(interventions.organizationId, context.organizationId)).all();
    const visibleIds = visibleInterventions
      .filter((intervention) => canAccessIntervention(context, intervention))
      .map((intervention) => intervention.id);
    const rows = visibleIds.length
      ? await db.select().from(reports).where(and(
          eq(reports.organizationId, context.organizationId),
          inArray(reports.interventionId, visibleIds),
        )).orderBy(desc(reports.createdAt)).all()
      : [];

    return Response.json(
      { reports: rows, tenant: context.organizationId },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[api/reports] GET failed", error);
    return errorResponse("Impossible de charger les rapports", 500);
  }
}

export async function POST(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager", "technician"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const parsed = await readJsonRequest(request, 128 * 1024);
  if (!parsed.ok) return errorResponse(parsed.message, parsed.status);

  const validated = validateReport(parsed.value);
  if (!validated.ok) return errorResponse("Données de rapport invalides", 422, validated.issues);
  const signatureHash = validated.value.signatureData
    ? createHash("sha256").update(validated.value.signatureData).digest("hex")
    : null;

  try {
    const db = getDb();
    const result = await db.transaction(async (tx) => {
      const intervention = await tx.select().from(interventions).where(and(
        eq(interventions.id, validated.value.interventionId),
        eq(interventions.organizationId, context.organizationId),
      )).get();

      if (!intervention || !canAccessIntervention(context, intervention)) {
        throw new InterventionNotFoundError();
      }
      if (!canFinalizeReport(intervention.status)) throw new InvalidInterventionStatusError();

      const existing = await tx.select().from(reports).where(and(
        eq(reports.interventionId, intervention.id),
        eq(reports.organizationId, context.organizationId),
      )).orderBy(desc(reports.createdAt)).get();
      const signedAt = validated.value.signedAt ?? new Date().toISOString();

      const report = existing
        ? await tx.update(reports).set({
            summary: validated.value.summary,
            materials: validated.value.materials,
            clientName: validated.value.clientName,
            signedAt,
            signatureData: validated.value.signatureData ?? null,
          }).where(and(
            eq(reports.id, existing.id),
            eq(reports.organizationId, context.organizationId),
            eq(reports.interventionId, intervention.id),
          )).returning().get()
        : await tx.insert(reports).values({
            id: crypto.randomUUID(),
            organizationId: context.organizationId,
            interventionId: intervention.id,
            summary: validated.value.summary,
            materials: validated.value.materials,
            clientName: validated.value.clientName,
            signedAt,
            signatureData: validated.value.signatureData ?? null,
          }).returning().get();

      if (!report) throw new ConcurrentReportFinalizationError();

      const completed = await tx.update(interventions).set({
        status: "completed",
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(and(
        eq(interventions.id, intervention.id),
        eq(interventions.organizationId, context.organizationId),
        eq(interventions.status, "in_progress"),
      )).returning().get();

      if (!completed) throw new ConcurrentReportFinalizationError();

      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorId: context.userId,
        action: existing ? "report.updated" : "report.created",
        entityType: "report",
        entityId: report.id,
        metadata: JSON.stringify({
          interventionId: intervention.id,
          reference: intervention.reference,
          signedAt,
          signatureMethod: validated.value.signatureData ? "drawn" : "electronic_confirmation",
          signatureHash,
        }),
      }).run();
      await tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorId: context.userId,
        action: "intervention.status_changed",
        entityType: "intervention",
        entityId: intervention.id,
        metadata: JSON.stringify({
          from: "in_progress",
          to: "completed",
          source: "report.finalized",
          reportId: report.id,
        }),
      }).run();

      return { report, intervention: completed, created: !existing };
    });

    return Response.json(
      {
        report: result.report,
        intervention: result.intervention,
        tenant: context.organizationId,
      },
      { status: result.created ? 201 : 200, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof InterventionNotFoundError) {
      return errorResponse("Intervention introuvable", 404);
    }
    if (error instanceof InvalidInterventionStatusError) {
      return errorResponse("Seule une intervention en cours peut être finalisée", 409);
    }
    if (error instanceof ConcurrentReportFinalizationError) {
      return errorResponse("L'intervention a été modifiée simultanément", 409);
    }
    if (isSqliteConcurrencyError(error)) {
      return errorResponse("L'intervention est déjà en cours de finalisation", 409);
    }

    console.error("[api/reports] POST failed", error);
    return errorResponse("Impossible de finaliser le rapport", 500);
  }
}
