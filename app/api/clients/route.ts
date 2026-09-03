import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, customers, sites } from "@/db/schema";
import { requireAuthContext } from "@/lib/auth-context";
import { readJsonRequest } from "../interventions/validation";
import { validateCreateClient } from "./validation";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };

class DuplicateClientError extends Error {}

function isDuplicateClientError(error: unknown) {
  if (error instanceof DuplicateClientError) return true;
  if (!(error instanceof Error)) return false;
  const sqliteCode = "code" in error ? String(error.code) : "";
  return sqliteCode === "SQLITE_CONSTRAINT_UNIQUE" || error.message.includes("UNIQUE constraint failed");
}

function errorResponse(message: string, status: number, details?: unknown) {
  return Response.json(
    details === undefined ? { error: message } : { error: message, details },
    { status, headers: NO_STORE_HEADERS },
  );
}

export async function GET(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager", "technician"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  try {
    const db = getDb();
    const [customerRows, siteRows] = await Promise.all([
      db.select().from(customers)
        .where(eq(customers.organizationId, context.organizationId))
        .orderBy(asc(customers.name)),
      db.select().from(sites)
        .where(eq(sites.organizationId, context.organizationId))
        .orderBy(asc(sites.name)),
    ]);
    const clientSites = new Map<string, typeof siteRows>();
    for (const site of siteRows) {
      clientSites.set(site.customerId, [...(clientSites.get(site.customerId) ?? []), site]);
    }
    const clients = customerRows.map((customer) => ({
      id: customer.id,
      name: customer.name,
      contact: customer.contactName,
      email: customer.email,
      phone: customer.phone,
      sites: (clientSites.get(customer.id) ?? []).map((site) => ({
        id: site.id,
        name: site.name,
        address: site.address,
        city: site.city,
      })),
    }));
    return Response.json({ clients, tenant: context.organizationId }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[api/clients] GET failed", error);
    return errorResponse("Impossible de charger les clients", 500);
  }
}

export async function POST(request: Request) {
  const authenticated = await requireAuthContext(request, ["manager"]);
  if (!authenticated.ok) return authenticated.response;
  const context = authenticated.context;
  const parsed = await readJsonRequest(request);
  if (!parsed.ok) return errorResponse(parsed.message, parsed.status);
  const validated = validateCreateClient(parsed.value);
  if (!validated.ok) return errorResponse("Données client invalides", 422, validated.issues);

  try {
    const client = getDb().transaction((tx) => {
      const duplicate = tx.select({ id: customers.id }).from(customers).where(and(
        eq(customers.organizationId, context.organizationId),
        sql`(lower(${customers.name}) = lower(${validated.value.name}) or lower(${customers.email}) = lower(${validated.value.email}))`,
      )).get();
      if (duplicate) throw new DuplicateClientError();

      const customerId = crypto.randomUUID();
      const siteId = crypto.randomUUID();
      tx.insert(customers).values({
        id: customerId,
        organizationId: context.organizationId,
        name: validated.value.name,
        contactName: validated.value.contact,
        email: validated.value.email,
        phone: validated.value.phone,
      }).run();
      tx.insert(sites).values({
        id: siteId,
        organizationId: context.organizationId,
        customerId,
        name: validated.value.siteName,
        address: validated.value.address,
        city: validated.value.city,
      }).run();
      tx.insert(auditLogs).values({
        id: crypto.randomUUID(),
        organizationId: context.organizationId,
        actorId: context.userId,
        action: "customer.created",
        entityType: "customer",
        entityId: customerId,
        metadata: JSON.stringify({ siteId }),
      }).run();
      return {
        id: customerId,
        name: validated.value.name,
        contact: validated.value.contact,
        email: validated.value.email,
        phone: validated.value.phone,
        sites: [{
          id: siteId,
          name: validated.value.siteName,
          address: validated.value.address,
          city: validated.value.city,
        }],
      };
    });
    return Response.json(
      { client, tenant: context.organizationId },
      { status: 201, headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (isDuplicateClientError(error)) {
      return errorResponse("Un client avec ce nom ou cet e-mail existe déjà", 409);
    }
    console.error("[api/clients] POST failed", error);
    return errorResponse("Impossible de créer le client", 500);
  }
}
