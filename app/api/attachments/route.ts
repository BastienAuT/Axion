import { createHash } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, auditLogs, interventions, reports } from "@/db/schema";
import { canAccessIntervention, requireAuthContext } from "@/lib/auth-context";
import {
  detectedImageType,
  isAttachmentUuid,
  MAX_MULTIPART_BYTES,
  MAX_PHOTO_BYTES,
  MAX_PHOTO_COUNT,
  safeAttachmentFilename,
  validateAttachmentFields,
} from "./validation";

const MAX_ATTACHMENTS_PER_REPORT = 8;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

class ReportNotFoundError extends Error {}
class AttachmentLimitError extends Error {}

function errorResponse(message: string, status: number, details?: unknown) {
  return Response.json(
    details === undefined ? { error: message } : { error: message, details },
    { status, headers: NO_STORE_HEADERS },
  );
}

function metadata(row: typeof attachments.$inferSelect) {
  return {
    id: row.id,
    interventionId: row.interventionId,
    reportId: row.reportId,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt,
    url: `/api/attachments/${row.id}`,
  };
}

async function readMultipart(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
    return { ok: false as const, status: 415, message: "Le contenu doit être multipart/form-data" };
  }
  const announcedLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(announcedLength) && announcedLength > MAX_MULTIPART_BYTES) {
    return { ok: false as const, status: 413, message: "Envoi trop volumineux" };
  }
  if (!request.body) return { ok: false as const, status: 400, message: "Envoi vide" };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_MULTIPART_BYTES) {
      await reader.cancel();
      return { ok: false as const, status: 413, message: "Envoi trop volumineux" };
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const formData = await new Response(bytes, { headers: { "content-type": contentType } }).formData();
    return { ok: true as const, formData };
  } catch {
    return { ok: false as const, status: 400, message: "Formulaire multipart invalide" };
  }
}

export async function GET(request: Request) {
  const authenticated = await requireAuthContext(request);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const interventionId = new URL(request.url).searchParams.get("interventionId");
  if (interventionId && !isAttachmentUuid(interventionId)) {
    return errorResponse("Identifiant d’intervention invalide", 422);
  }
  try {
    const db = getDb();
    const visibleIds = db.select().from(interventions)
      .where(eq(interventions.organizationId, context.organizationId)).all()
      .filter((intervention) => canAccessIntervention(context, intervention))
      .map((intervention) => intervention.id)
      .filter((id) => !interventionId || id === interventionId);
    const rows = visibleIds.length
      ? await db.select().from(attachments).where(and(
          eq(attachments.organizationId, context.organizationId),
          inArray(attachments.interventionId, visibleIds),
        )).orderBy(asc(attachments.createdAt))
      : [];
    return Response.json(
      { attachments: rows.map(metadata), tenant: context.organizationId },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[api/attachments] GET failed", error);
    return errorResponse("Impossible de charger les pièces jointes", 500);
  }
}

export async function POST(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager", "technician"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const parsed = await readMultipart(request);
  if (!parsed.ok) return errorResponse(parsed.message, parsed.status);
  const validated = validateAttachmentFields(
    parsed.formData.get("interventionId"),
    parsed.formData.get("reportId"),
  );
  if (!validated.ok) return errorResponse("Références de pièce jointe invalides", 422, validated.issues);
  const files = parsed.formData.getAll("photos").filter((value): value is File => value instanceof File);
  if (!files.length || files.length > MAX_PHOTO_COUNT) {
    return errorResponse(`Ajoutez entre 1 et ${MAX_PHOTO_COUNT} photos`, 422);
  }

  const prepared: Array<{
    id: string;
    filename: string;
    contentType: "image/jpeg" | "image/png";
    sizeBytes: number;
    dataBase64: string;
    sha256: string;
  }> = [];
  for (const file of files) {
    if (file.size <= 0 || file.size > MAX_PHOTO_BYTES) {
      return errorResponse("Chaque photo doit peser au maximum 2 Mo", 422);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectedImageType(bytes);
    if (!contentType) return errorResponse("Seules les images JPEG et PNG valides sont acceptées", 422);
    prepared.push({
      id: crypto.randomUUID(),
      filename: safeAttachmentFilename(file.name),
      contentType,
      sizeBytes: bytes.byteLength,
      dataBase64: Buffer.from(bytes).toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }

  try {
    const rows = getDb().transaction((tx) => {
      const intervention = tx.select().from(interventions).where(and(
        eq(interventions.id, validated.value.interventionId),
        eq(interventions.organizationId, context.organizationId),
      )).get();
      if (!intervention || !canAccessIntervention(context, intervention)) {
        throw new ReportNotFoundError();
      }
      const report = tx.select({ id: reports.id }).from(reports).where(and(
        eq(reports.id, validated.value.reportId),
        eq(reports.interventionId, validated.value.interventionId),
        eq(reports.organizationId, context.organizationId),
      )).get();
      if (!report) throw new ReportNotFoundError();
      const currentCount = tx.select({ id: attachments.id }).from(attachments).where(and(
        eq(attachments.reportId, report.id),
        eq(attachments.organizationId, context.organizationId),
      )).all().length;
      if (currentCount + prepared.length > MAX_ATTACHMENTS_PER_REPORT) {
        throw new AttachmentLimitError();
      }
      const inserted = prepared.map((photo) => tx.insert(attachments).values({
        id: photo.id,
        organizationId: context.organizationId,
        interventionId: validated.value.interventionId,
        reportId: report.id,
        storageKey: `sqlite:${photo.id}`,
        filename: photo.filename,
        contentType: photo.contentType,
        sizeBytes: photo.sizeBytes,
        dataBase64: photo.dataBase64,
      }).returning().get());
      tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorId: context.userId,
        action: "attachments.created",
        entityType: "report",
        entityId: report.id,
        metadata: JSON.stringify({
          interventionId: validated.value.interventionId,
          files: prepared.map(({ id, filename, sizeBytes, sha256 }) => ({ id, filename, sizeBytes, sha256 })),
        }),
      }).run();
      return inserted;
    });
    return Response.json(
      { attachments: rows.map(metadata), tenant: context.organizationId },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ReportNotFoundError) return errorResponse("Rapport introuvable", 404);
    if (error instanceof AttachmentLimitError) return errorResponse("Ce rapport contient déjà trop de pièces jointes", 409);
    console.error("[api/attachments] POST failed", error);
    return errorResponse("Impossible d’enregistrer les photos", 500);
  }
}
