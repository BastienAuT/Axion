import { beforeAll, describe, expect, test } from "bun:test";
import { and, eq, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { POST as createBilling, PATCH as updateBilling } from "../app/api/billing/route";
import {
  canTransitionBilling,
  validateCreateBilling,
  validateUpdateBilling,
} from "../app/api/billing/validation";
import { POST as createClient } from "../app/api/clients/route";
import { validateCreateClient } from "../app/api/clients/validation";
import { getDb } from "../db";
import {
  auditLogs,
  billingDocuments,
  billingSequences,
  customers,
  sites,
} from "../db/schema";
import { authenticatedHeaders, createTestSession } from "./auth-test-helper";

process.env.DATABASE_PATH = ":memory:";

let authHeaders = new Headers();

beforeAll(async () => {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  authHeaders = (await createTestSession()).headers;
});

const validClient = {
  name: "Entreprise Test Boréal",
  contact: "Lou Martin",
  email: "LOU@BOREAL.EXAMPLE",
  phone: "+33 6 12 34 56 78",
  siteName: "Agence centrale",
  address: "10 rue du Test",
  city: "Lyon",
};

describe("validation clients et facturation", () => {
  test("normalise un client valide et rejette les champs suspects", () => {
    expect(validateCreateClient(validClient)).toEqual({
      ok: true,
      value: { ...validClient, email: "lou@boreal.example" },
    });
    const invalid = validateCreateClient({ ...validClient, email: "incorrect", extra: true });
    expect(invalid.ok).toBeFalse();
    if (!invalid.ok) {
      expect(invalid.issues.map((issue) => issue.field).sort()).toEqual(["email", "extra"]);
    }
  });

  test("convertit les euros en centimes sans accepter plus de deux décimales", () => {
    expect(validateCreateBilling({ kind: "Facture", client: validClient.name, amount: 1250.45 }))
      .toEqual({
        ok: true,
        value: { kind: "Facture", client: validClient.name, amountCents: 125045 },
      });
    expect(validateCreateBilling({ kind: "Facture", client: validClient.name, amount: 1.001 }).ok)
      .toBeFalse();
  });

  test("sépare les cycles de vie d'une facture et d'un devis", () => {
    expect(canTransitionBilling("Facture", "draft", "sent")).toBeTrue();
    expect(canTransitionBilling("Facture", "sent", "paid")).toBeTrue();
    expect(canTransitionBilling("Facture", "paid", "draft")).toBeFalse();
    expect(canTransitionBilling("Devis", "sent", "accepted")).toBeTrue();
    expect(canTransitionBilling("Devis", "sent", "paid")).toBeFalse();
    expect(validateUpdateBilling({ id: "demo", status: "paid" }).ok).toBeFalse();
  });
});

describe("persistance clients et facturation", () => {
  test("crée le client, son site, une facture séquencée et leurs audits", async () => {
    const db = getDb();
    let customerId = "";
    let siteId = "";
    let documentId = "";
    try {
      const clientResponse = await createClient(new Request("http://localhost/api/clients", {
        method: "POST",
        headers: authenticatedHeaders(authHeaders, "application/json"),
        body: JSON.stringify(validClient),
      }));
      const clientBody = await clientResponse.json() as {
        client: { id: string; email: string; sites: Array<{ id: string }> };
      };
      customerId = clientBody.client.id;
      siteId = clientBody.client.sites[0].id;
      expect(clientResponse.status).toBe(201);
      expect(clientBody.client.email).toBe("lou@boreal.example");
      expect((await db.select().from(sites).where(eq(sites.id, siteId)).get())?.city).toBe("Lyon");

      const billingResponse = await createBilling(new Request("http://localhost/api/billing", {
        method: "POST",
        headers: authenticatedHeaders(authHeaders, "application/json"),
        body: JSON.stringify({ kind: "Facture", client: validClient.name, amount: 1250.45 }),
      }));
      const billingBody = await billingResponse.json() as {
        document: { id: string; number: string; amount: number; status: string };
      };
      documentId = billingBody.document.id;
      expect(billingResponse.status).toBe(201);
      expect(billingBody.document.number).toMatch(/^FAC-\d{4}-0001$/);
      expect(billingBody.document.amount).toBe(1250.45);

      const updateResponse = await updateBilling(new Request("http://localhost/api/billing", {
        method: "PATCH",
        headers: authenticatedHeaders(authHeaders, "application/json"),
        body: JSON.stringify({ id: documentId, status: "sent" }),
      }));
      expect(updateResponse.status).toBe(200);
      expect((await updateResponse.json() as { document: { status: string } }).document.status)
        .toBe("sent");

      const actions = (await db.select({ action: auditLogs.action }).from(auditLogs).where(or(
        eq(auditLogs.entityId, customerId),
        eq(auditLogs.entityId, documentId),
      )).all()).map((log) => log.action).sort();
      expect(actions).toEqual(["billing.created", "billing.status_changed", "customer.created"]);
    } finally {
      if (documentId) {
        await db.delete(auditLogs).where(eq(auditLogs.entityId, documentId));
        await db.delete(billingDocuments).where(eq(billingDocuments.id, documentId));
      }
      if (customerId) {
        await db.delete(auditLogs).where(eq(auditLogs.entityId, customerId));
        await db.delete(sites).where(eq(sites.customerId, customerId));
        await db.delete(customers).where(eq(customers.id, customerId));
      }
      await db.delete(billingSequences).where(and(
        eq(billingSequences.organizationId, "org_axion_demo"),
        eq(billingSequences.kind, "Facture"),
      ));
    }
  });

  test("refuse un doublon client et une transition commerciale interdite", async () => {
    const db = getDb();
    const customerId = crypto.randomUUID();
    const documentId = crypto.randomUUID();
    await db.insert(customers).values({
      id: customerId,
      organizationId: "org_axion_demo",
      name: validClient.name,
      contactName: validClient.contact,
      email: "existing@example.test",
      phone: validClient.phone,
    });
    await db.insert(billingDocuments).values({
      id: documentId,
      organizationId: "org_axion_demo",
      kind: "Facture",
      number: `FAC-TEST-${documentId.slice(0, 8)}`,
      client: validClient.name,
      date: "2026-09-03",
      amountCents: 10000,
      status: "paid",
    });
    try {
      const duplicate = await createClient(new Request("http://localhost/api/clients", {
        method: "POST",
        headers: authenticatedHeaders(authHeaders, "application/json"),
        body: JSON.stringify(validClient),
      }));
      expect(duplicate.status).toBe(409);

      const invalidTransition = await updateBilling(new Request("http://localhost/api/billing", {
        method: "PATCH",
        headers: authenticatedHeaders(authHeaders, "application/json"),
        body: JSON.stringify({ id: documentId, status: "draft" }),
      }));
      expect(invalidTransition.status).toBe(409);
    } finally {
      await db.delete(billingDocuments).where(eq(billingDocuments.id, documentId));
      await db.delete(customers).where(eq(customers.id, customerId));
    }
  });
});
