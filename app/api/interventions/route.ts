import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { member, user } from "@/db/better-auth.generated";
import { auditLogs, customers, interventions } from "@/db/schema";
import { canAccessIntervention, requireAuthContext } from "@/lib/auth-context";
import {
  canTransitionStatus,
  createInterventionReference,
  readJsonRequest,
  validateCreateIntervention,
  validateStatusUpdate,
  type InterventionStatus,
} from "./validation";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

class InterventionNotFoundError extends Error {}
class CustomerNotFoundError extends Error {}
class InvalidStatusTransitionError extends Error {}
class ConcurrentStatusUpdateError extends Error {}

function errorResponse(message: string, status: number, details?: unknown) {
  return Response.json(
    details === undefined ? { error: message } : { error: message, details },
    { status, headers: NO_STORE_HEADERS },
  );
}

function isReferenceConflict(error: unknown) {
  if (!(error instanceof Error)) return false;
  const sqliteCode = "code" in error ? String(error.code) : "";
  return (
    sqliteCode === "SQLITE_CONSTRAINT_UNIQUE" ||
    error.message.includes("UNIQUE constraint failed: interventions.reference")
  );
}

export async function GET(request: Request) {
  const authenticated = await requireAuthContext(request);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  try {
    const scope = context.role === "manager"
      ? eq(interventions.organizationId, context.organizationId)
      : context.role === "technician"
        ? and(
            eq(interventions.organizationId, context.organizationId),
            eq(interventions.technicianUserId, context.userId),
          )
        : and(
            eq(interventions.organizationId, context.organizationId),
            eq(interventions.customerId, context.customerId ?? "__no_customer__"),
          );
    const rows = await getDb().select().from(interventions)
      .where(scope)
      .orderBy(desc(interventions.scheduledDate), desc(interventions.scheduledTime));
    return Response.json(
      { interventions: rows, tenant: context.organizationId },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[api/interventions] GET failed", error);
    return errorResponse("Impossible de charger les interventions", 500);
  }
}

export async function POST(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const parsed = await readJsonRequest(request);
  if (!parsed.ok) return errorResponse(parsed.message, parsed.status);

  const validated = validateCreateIntervention(parsed.value);
  if (!validated.ok) return errorResponse("Données d'intervention invalides", 422, validated.issues);

  const id = crypto.randomUUID();
  try {
    const db = getDb();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const reference = createInterventionReference();
      try {
        const row = db.transaction((tx) => {
          const customer = tx.select({ id: customers.id }).from(customers).where(and(
            eq(customers.organizationId, context.organizationId),
            sql`lower(${customers.name}) = lower(${validated.value.customerName})`,
          )).get();
          if (!customer) throw new CustomerNotFoundError();
          const technician = tx.select({ id: user.id }).from(user).innerJoin(
            member,
            and(
              eq(member.userId, user.id),
              eq(member.organizationId, context.organizationId),
              eq(member.role, "technician"),
            ),
          ).where(sql`lower(${user.name}) = lower(${validated.value.technician})`).get();
          const created = {
            id,
            organizationId: context.organizationId,
            customerId: customer.id,
            technicianUserId: technician?.id ?? null,
            reference,
            ...validated.value,
            status: "scheduled" as const,
          };
          tx.insert(interventions).values(created).run();
          tx.insert(auditLogs).values({
            id: crypto.randomUUID(),
            organizationId: context.organizationId,
            actorId: context.userId,
            action: "intervention.created",
            entityType: "intervention",
            entityId: id,
            metadata: JSON.stringify({ reference }),
          }).run();
          return created;
        });
        return Response.json(
          { intervention: row, tenant: context.organizationId },
          { status: 201, headers: NO_STORE_HEADERS },
        );
      } catch (error) {
        if (attempt < 2 && isReferenceConflict(error)) continue;
        throw error;
      }
    }

    throw new Error("Reference generation exhausted");
  } catch (error) {
    if (error instanceof CustomerNotFoundError) {
      return errorResponse("Client introuvable dans cette entreprise", 404);
    }
    console.error("[api/interventions] POST failed", error);
    return errorResponse("Impossible de créer l'intervention", 500);
  }
}

export async function PATCH(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager", "technician"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const parsed = await readJsonRequest(request);
  if (!parsed.ok) return errorResponse(parsed.message, parsed.status);

  const validated = validateStatusUpdate(parsed.value);
  if (!validated.ok) return errorResponse("Mise à jour de statut invalide", 422, validated.issues);

  try {
    const db = getDb();
    const updated = db.transaction((tx) => {
      const current = tx.select().from(interventions).where(and(
        eq(interventions.id, validated.value.id),
        eq(interventions.organizationId, context.organizationId),
      )).get();

      if (!current || !canAccessIntervention(context, current)) throw new InterventionNotFoundError();
      const currentStatus = current.status as InterventionStatus;
      if (!canTransitionStatus(currentStatus, validated.value.status)) {
        throw new InvalidStatusTransitionError();
      }
      if (currentStatus === validated.value.status) return current;

      const next = tx.update(interventions).set({
        status: validated.value.status,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(and(
        eq(interventions.id, validated.value.id),
        eq(interventions.organizationId, context.organizationId),
        eq(interventions.status, currentStatus),
      )).returning().get();

      if (!next) throw new ConcurrentStatusUpdateError();
      tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorId: context.userId,
        action: "intervention.status_changed",
        entityType: "intervention",
        entityId: current.id,
        metadata: JSON.stringify({ from: currentStatus, to: validated.value.status }),
      }).run();
      return next;
    });

    return Response.json(
      { intervention: updated, tenant: context.organizationId },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof InterventionNotFoundError) {
      return errorResponse("Intervention introuvable", 404);
    }
    if (error instanceof InvalidStatusTransitionError) {
      return errorResponse("Transition de statut interdite", 409);
    }
    if (error instanceof ConcurrentStatusUpdateError) {
      return errorResponse("L'intervention a été modifiée simultanément", 409);
    }

    console.error("[api/interventions] PATCH failed", error);
    return errorResponse("Impossible de mettre à jour l'intervention", 500);
  }
}
