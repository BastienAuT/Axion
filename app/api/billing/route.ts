import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, billingDocuments, billingSequences, customers } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { readJsonRequest } from "../interventions/validation";
import {
  canTransitionBilling,
  validateCreateBilling,
  validateUpdateBilling,
  type BillingStatus,
} from "./validation";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

class ClientNotFoundError extends Error {}
class BillingNotFoundError extends Error {}
class InvalidBillingTransitionError extends Error {}
class ConcurrentBillingUpdateError extends Error {}

function errorResponse(message: string, status: number, details?: unknown) {
  return Response.json(
    details === undefined ? { error: message } : { error: message, details },
    { status, headers: NO_STORE_HEADERS },
  );
}

function serializeDocument(row: typeof billingDocuments.$inferSelect) {
  return { ...row, amount: row.amountCents / 100, amountCents: undefined };
}

function dateInParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function GET(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  try {
    const rows = await getDb().select().from(billingDocuments)
      .where(eq(billingDocuments.organizationId, context.organizationId))
      .orderBy(desc(billingDocuments.date), desc(billingDocuments.createdAt));
    return Response.json(
      { documents: rows.map(serializeDocument), tenant: context.organizationId },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    console.error("[api/billing] GET failed", error);
    return errorResponse("Impossible de charger la facturation", 500);
  }
}

export async function POST(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const parsed = await readJsonRequest(request);
  if (!parsed.ok) return errorResponse(parsed.message, parsed.status);
  const validated = validateCreateBilling(parsed.value);
  if (!validated.ok) return errorResponse("Données de facturation invalides", 422, validated.issues);

  try {
    const row = getDb().transaction((tx) => {
      const client = tx.select({ id: customers.id }).from(customers).where(and(
        eq(customers.organizationId, context.organizationId),
        sql`lower(${customers.name}) = lower(${validated.value.client})`,
      )).get();
      if (!client) throw new ClientNotFoundError();

      const year = Number(dateInParis().slice(0, 4));
      const sequence = tx.insert(billingSequences).values({
        organizationId: context.organizationId,
        kind: validated.value.kind,
        year,
        lastValue: 1,
      }).onConflictDoUpdate({
        target: [billingSequences.organizationId, billingSequences.kind, billingSequences.year],
        set: { lastValue: sql`${billingSequences.lastValue} + 1` },
      }).returning({ value: billingSequences.lastValue }).get();
      const prefix = validated.value.kind === "Facture" ? "FAC" : "DEV";
      const number = `${prefix}-${year}-${String(sequence.value).padStart(4, "0")}`;
      const id = crypto.randomUUID();
      const document = tx.insert(billingDocuments).values({
        id,
        organizationId: context.organizationId,
        customerId: client.id,
        kind: validated.value.kind,
        number,
        client: validated.value.client,
        date: dateInParis(),
        amountCents: validated.value.amountCents,
        status: "draft",
      }).returning().get();
      tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorId: context.userId,
        action: "billing.created",
        entityType: "billing_document",
        entityId: id,
        metadata: JSON.stringify({ number, kind: document.kind, amountCents: document.amountCents }),
      }).run();
      return document;
    });
    return Response.json(
      { document: serializeDocument(row), tenant: context.organizationId },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof ClientNotFoundError) return errorResponse("Client introuvable", 404);
    console.error("[api/billing] POST failed", error);
    return errorResponse("Impossible de créer le document", 500);
  }
}

export async function PATCH(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const parsed = await readJsonRequest(request);
  if (!parsed.ok) return errorResponse(parsed.message, parsed.status);
  const validated = validateUpdateBilling(parsed.value);
  if (!validated.ok) return errorResponse("Mise à jour de facturation invalide", 422, validated.issues);

  try {
    const row = getDb().transaction((tx) => {
      const current = tx.select().from(billingDocuments).where(and(
        eq(billingDocuments.id, validated.value.id),
        eq(billingDocuments.organizationId, context.organizationId),
      )).get();
      if (!current) throw new BillingNotFoundError();
      const currentStatus = current.status as BillingStatus;
      if (!canTransitionBilling(current.kind, currentStatus, validated.value.status)) {
        throw new InvalidBillingTransitionError();
      }
      if (currentStatus === validated.value.status) return current;
      const updated = tx.update(billingDocuments).set({
        status: validated.value.status,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      }).where(and(
        eq(billingDocuments.id, current.id),
        eq(billingDocuments.organizationId, context.organizationId),
        eq(billingDocuments.status, currentStatus),
      )).returning().get();
      if (!updated) throw new ConcurrentBillingUpdateError();
      tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorId: context.userId,
        action: "billing.status_changed",
        entityType: "billing_document",
        entityId: current.id,
        metadata: JSON.stringify({ from: currentStatus, to: validated.value.status }),
      }).run();
      return updated;
    });
    return Response.json(
      { document: serializeDocument(row), tenant: context.organizationId },
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof BillingNotFoundError) return errorResponse("Document introuvable", 404);
    if (error instanceof InvalidBillingTransitionError) return errorResponse("Transition de statut interdite", 409);
    if (error instanceof ConcurrentBillingUpdateError) return errorResponse("Le document a été modifié simultanément", 409);
    console.error("[api/billing] PATCH failed", error);
    return errorResponse("Impossible de mettre à jour le document", 500);
  }
}
