import { beforeAll, describe, expect, test } from "bun:test";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { GET as getBilling } from "../app/api/billing/route";
import { GET as getAuthContext } from "../app/api/auth/context/route";
import { GET as getInterventions, PATCH as updateIntervention } from "../app/api/interventions/route";
import { getDb } from "../db";
import { interventions } from "../db/schema";
import { authenticatedHeaders, createTestSession } from "./auth-test-helper";

process.env.DATABASE_PATH = ":memory:";

const organizationA = `org-security-a-${crypto.randomUUID()}`;
const organizationB = `org-security-b-${crypto.randomUUID()}`;
const customerA = crypto.randomUUID();
const customerB = crypto.randomUUID();
const assignedInterventionId = crypto.randomUUID();
const otherInterventionId = crypto.randomUUID();
const foreignInterventionId = crypto.randomUUID();

let managerA = new Headers();
let technicianA = new Headers();
let technicianAUserId = "";
let clientA = new Headers();

beforeAll(async () => {
  migrate(getDb(), { migrationsFolder: "./drizzle" });
  managerA = (await createTestSession({ role: "manager", organizationId: organizationA })).headers;
  const technician = await createTestSession({
    role: "technician",
    organizationId: organizationA,
    name: "Technicien autorisé",
  });
  technicianA = technician.headers;
  technicianAUserId = technician.userId;
  clientA = (await createTestSession({
    role: "client",
    organizationId: organizationA,
    customerId: customerA,
    name: "Client autorisé",
  })).headers;
  await createTestSession({ role: "manager", organizationId: organizationB });

  const common = {
    siteName: "Site sécurité",
    address: "1 rue de la Sécurité, Lyon",
    scheduledDate: "2026-09-03",
    scheduledTime: "09:00",
    durationMinutes: 60,
    priority: "normal" as const,
    status: "scheduled" as const,
  };
  getDb().insert(interventions).values([
    {
      ...common,
      id: assignedInterventionId,
      organizationId: organizationA,
      customerId: customerA,
      technicianUserId: technicianAUserId,
      reference: `INT-A-${assignedInterventionId.slice(0, 8)}`,
      customerName: "Client A",
      title: "Mission attribuée",
      technician: "Technicien autorisé",
    },
    {
      ...common,
      id: otherInterventionId,
      organizationId: organizationA,
      customerId: customerB,
      technicianUserId: crypto.randomUUID(),
      reference: `INT-B-${otherInterventionId.slice(0, 8)}`,
      customerName: "Client B",
      title: "Mission non attribuée",
      technician: "Autre technicien",
    },
    {
      ...common,
      id: foreignInterventionId,
      organizationId: organizationB,
      customerId: crypto.randomUUID(),
      technicianUserId: crypto.randomUUID(),
      reference: `INT-C-${foreignInterventionId.slice(0, 8)}`,
      customerName: "Client étranger",
      title: "Mission autre entreprise",
      technician: "Technicien étranger",
    },
  ]).run();
});

async function visibleIds(headers: Headers) {
  const response = await getInterventions(
    new Request("http://localhost/api/interventions", { headers }),
  );
  const body = await response.json() as { interventions: Array<{ id: string }> };
  return { response, ids: body.interventions.map((item) => item.id) };
}

describe("authentification et autorisations", () => {
  test("refuse une API sans session", async () => {
    const response = await getInterventions(new Request("http://localhost/api/interventions"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentification requise" });
  });

  test("confirme la session complète avant la navigation post-connexion", async () => {
    const anonymous = await getAuthContext(new Request("http://localhost/api/auth/context"));
    const authenticated = await getAuthContext(
      new Request("http://localhost/api/auth/context", { headers: managerA }),
    );
    const body = await authenticated.json() as {
      authenticated: boolean;
      identity: { organizationId: string; role: string };
    };

    expect(anonymous.status).toBe(401);
    expect(authenticated.status).toBe(200);
    expect(authenticated.headers.get("cache-control")).toContain("no-store");
    expect(body).toMatchObject({
      authenticated: true,
      identity: { organizationId: organizationA, role: "manager" },
    });
  });

  test("isole strictement les données par entreprise", async () => {
    const { response, ids } = await visibleIds(managerA);
    expect(response.status).toBe(200);
    expect(ids).toContain(assignedInterventionId);
    expect(ids).toContain(otherInterventionId);
    expect(ids).not.toContain(foreignInterventionId);
  });

  test("limite un technicien à ses missions et un client à son compte", async () => {
    const technician = await visibleIds(technicianA);
    const client = await visibleIds(clientA);
    expect(technician.ids).toEqual([assignedInterventionId]);
    expect(client.ids).toEqual([assignedInterventionId]);
  });

  test("interdit la facturation au client et masque les missions non attribuées", async () => {
    const billingResponse = await getBilling(
      new Request("http://localhost/api/billing", { headers: clientA }),
    );
    expect(billingResponse.status).toBe(403);

    const updateResponse = await updateIntervention(new Request(
      "http://localhost/api/interventions",
      {
        method: "PATCH",
        headers: authenticatedHeaders(technicianA, "application/json"),
        body: JSON.stringify({ id: otherInterventionId, status: "en_route" }),
      },
    ));
    expect(updateResponse.status).toBe(404);
  });
});
