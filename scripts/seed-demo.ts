import { and, eq, sql } from "drizzle-orm";
import {
  seedBillingDocuments,
  seedClients,
  seedInterventions,
  seedReports,
} from "../app/axion/model";
import { getDb } from "../db";
import { member, organization, session, user } from "../db/better-auth.generated";
import {
  billingDocuments,
  billingSequences,
  customers,
  interventions,
  organizations,
  reports,
  sites,
} from "../db/schema";
import { createAxionAuth } from "../lib/auth";

const ORGANIZATION_ID = "org_axion_demo";
const db = getDb();

const shouldSeed = process.env.SEED_DEMO_DATA === "true" || (
  process.env.SEED_DEMO_DATA !== "false" && process.env.NODE_ENV !== "production"
);

if (!shouldSeed) {
  console.info("Base Axion prête : amorçage de démonstration désactivé.");
  process.exit(0);
}

await db.transaction(async (tx) => {
  await tx.insert(organizations).values({ id: ORGANIZATION_ID, name: "Axion Démonstration" })
    .onConflictDoNothing();
  for (const [clientIndex, client] of seedClients.entries()) {
    const customerId = `10000000-0000-4000-8000-${String(clientIndex + 1).padStart(12, "0")}`;
    await tx.insert(customers).values({
      id: customerId,
      organizationId: ORGANIZATION_ID,
      name: client.name,
      contactName: client.contact,
      email: client.email,
      phone: client.phone,
    }).onConflictDoNothing();
    for (const [siteIndex, site] of client.sites.entries()) {
      await tx.insert(sites).values({
        id: `11000000-0000-4000-8000-${String(clientIndex * 10 + siteIndex + 1).padStart(12, "0")}`,
        organizationId: ORGANIZATION_ID,
        customerId,
        name: site.name,
        address: site.address,
        city: site.city ?? "Lyon",
      }).onConflictDoNothing();
    }
  }

  for (const document of seedBillingDocuments) {
    await tx.insert(billingDocuments).values({
      id: document.id,
      organizationId: ORGANIZATION_ID,
      kind: document.kind,
      number: document.number,
      client: document.client,
      date: document.date,
      amountCents: Math.round(document.amount * 100),
      status: document.status,
    }).onConflictDoNothing();
  }

  const currentYear = new Date().getFullYear();
  for (const { kind, lastValue } of [
    { kind: "Facture" as const, lastValue: 87 },
    { kind: "Devis" as const, lastValue: 41 },
  ]) {
    await tx.insert(billingSequences).values({
      organizationId: ORGANIZATION_ID,
      kind,
      year: currentYear,
      lastValue,
    }).onConflictDoUpdate({
      target: [billingSequences.organizationId, billingSequences.kind, billingSequences.year],
      set: { lastValue: sql`max(${billingSequences.lastValue}, ${lastValue})` },
    });
  }
});

const demoPassword = process.env.DEMO_AUTH_PASSWORD ?? "Axion-Demo-2026!";
const seedAuth = createAxionAuth({ allowSignUp: true });
const accounts = [
  { email: "claire@axion.local", name: "Claire Durand", role: "manager" },
  { email: "nicolas@axion.local", name: "Nicolas Martin", role: "technician" },
  { email: "sofia@axion.local", name: "Sofia Benali", role: "technician" },
  { email: "lucas@axion.local", name: "Lucas Morel", role: "technician" },
  {
    email: "thomas@atelier-berthier.local",
    name: "Thomas Berthier",
    role: "client",
    customerId: "10000000-0000-4000-8000-000000000001",
  },
] as const;

async function ensureUser(identity: (typeof accounts)[number]) {
  const existing = await db.select({ id: user.id }).from(user)
    .where(sql`lower(${user.email}) = ${identity.email}`).get();
  if (existing) return existing.id;
  if (!existing) {
    const created = await seedAuth.api.signUpEmail({
      body: {
        name: identity.name,
        email: identity.email,
        password: demoPassword,
      },
    });
    return created.user.id;
  }
  throw new Error(`Impossible d’amorcer le compte ${identity.email}`);
}

const identities = await Promise.all(accounts.map(async (identity) => ({
  identity,
  userId: await ensureUser(identity),
})));

await db.transaction(async (tx) => {
  await tx.insert(organization).values({
    id: ORGANIZATION_ID,
    name: "Durand Maintenance",
    slug: "durand-maintenance",
    createdAt: new Date(),
    metadata: JSON.stringify({ demo: true }),
  }).onConflictDoNothing();

  for (const [index, { identity, userId }] of identities.entries()) {
    await tx.insert(member).values({
      id: `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      organizationId: ORGANIZATION_ID,
      userId,
      role: identity.role,
      createdAt: new Date(),
      customerId: "customerId" in identity ? identity.customerId : null,
    }).onConflictDoNothing();
    // signUpEmail creates a server-side bootstrap session whose cookie is never exposed.
    await tx.delete(session).where(sql`${session.userId} = ${userId}`);
  }

  const customerIds = new Map(
    seedClients.map((client, index) => [
      client.name,
      `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ]),
  );
  const technicianIds = new Map<string, string>(
    identities
      .filter(({ identity }) => identity.role === "technician")
      .map(({ identity, userId }) => [identity.name, userId]),
  );

  for (const intervention of seedInterventions) {
    await tx.insert(interventions).values({
      ...intervention,
      organizationId: ORGANIZATION_ID,
      customerId: customerIds.get(intervention.customerName) ?? null,
      technicianUserId: technicianIds.get(intervention.technician) ?? null,
    }).onConflictDoNothing();
  }
  for (const report of seedReports) {
    await tx.insert(reports).values({
      id: report.id,
      organizationId: ORGANIZATION_ID,
      interventionId: report.interventionId,
      summary: report.summary,
      materials: report.materials,
      clientName: report.clientName,
      signedAt: report.signedAt,
      signatureData: report.signatureData,
      createdAt: report.createdAt,
    }).onConflictDoNothing();
  }
  for (const client of seedClients) {
    const customerId = customerIds.get(client.name);
    if (!customerId) continue;
    await tx.update(interventions).set({ customerId }).where(and(
      eq(interventions.organizationId, ORGANIZATION_ID),
      eq(interventions.customerName, client.name),
    ));
    await tx.update(billingDocuments).set({ customerId }).where(and(
      eq(billingDocuments.organizationId, ORGANIZATION_ID),
      eq(billingDocuments.client, client.name),
    ));
  }
  for (const [technicianName, userId] of technicianIds) {
    await tx.update(interventions).set({ technicianUserId: userId }).where(and(
      eq(interventions.organizationId, ORGANIZATION_ID),
      eq(interventions.technician, technicianName),
    ));
  }
});

console.info(`Base Axion prête : démo et ${identities.length} comptes Better Auth vérifiés.`);
