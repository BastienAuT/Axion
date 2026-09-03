import { beforeAll, describe, expect, test } from "bun:test";
import { eq, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { GET, POST } from "../app/api/reports/route";
import { canFinalizeReport, validateReport } from "../app/api/reports/validation";
import { getDb } from "../db";
import { auditLogs, interventions, reports } from "../db/schema";
import { authenticatedHeaders, createTestSession } from "./auth-test-helper";

process.env.DATABASE_PATH = ":memory:";

let authHeaders = new Headers();

beforeAll(async () => {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  authHeaders = (await createTestSession()).headers;
});

const validSignature = JSON.stringify({
  version: 1,
  width: 700,
  height: 180,
  strokes: [[[10, 20], [40, 25], [75, 18]]],
});

const validPayload = {
  interventionId: "7e0b6f80-e7bc-4d52-bcd8-76b53a322d17",
  summary: "Diagnostic effectué et équipement remis en service.",
  materials: "1 × joint EPDM",
  clientName: "Thomas Berthier",
  signatureData: validSignature,
};

describe("validation des rapports", () => {
  test("normalise un rapport valide sans faire confiance à l'horloge cliente", () => {
    expect(validateReport({
      ...validPayload,
      summary: `  ${validPayload.summary}  `,
      materials: "  1 × joint EPDM  ",
    })).toEqual({
      ok: true,
      value: validPayload,
    });
  });

  test("normalise un horodatage RFC 3339 fourni", () => {
    const result = validateReport({
      ...validPayload,
      signedAt: "2026-09-02T12:30:45+02:00",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        ...validPayload,
        signedAt: "2026-09-02T10:30:45.000Z",
      },
    });
  });

  test("rejette identifiant, horodatage et champs inconnus", () => {
    const result = validateReport({
      ...validPayload,
      interventionId: "demo-1",
      signedAt: "02/09/2026",
      unexpected: true,
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field).sort()).toEqual([
        "interventionId",
        "signedAt",
        "unexpected",
      ]);
    }
  });

  test("rejette une date calendaire impossible dans signedAt", () => {
    const result = validateReport({
      ...validPayload,
      signedAt: "2026-02-30T12:00:00Z",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.issues.map((issue) => issue.field)).toEqual(["signedAt"]);
  });

  test("rejette un tracé trop court ou hors du canevas", () => {
    const result = validateReport({
      ...validPayload,
      signatureData: JSON.stringify({
        version: 1,
        width: 700,
        height: 180,
        strokes: [[[10, 10], [12, 10], [900, 10]]],
      }),
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) expect(result.issues.map((issue) => issue.field)).toEqual(["signatureData"]);
  });

  test("impose les longueurs et les types", () => {
    const result = validateReport({
      ...validPayload,
      summary: "x".repeat(5_001),
      materials: null,
      clientName: "",
    });

    expect(result.ok).toBeFalse();
    if (!result.ok) {
      expect(result.issues.map((issue) => issue.field)).toEqual([
        "summary",
        "materials",
        "clientName",
      ]);
    }
  });

  test("ne finalise que depuis in_progress", () => {
    expect(canFinalizeReport("in_progress")).toBeTrue();
    expect(canFinalizeReport("scheduled")).toBeFalse();
    expect(canFinalizeReport("en_route")).toBeFalse();
    expect(canFinalizeReport("completed")).toBeFalse();
    expect(canFinalizeReport("cancelled")).toBeFalse();
  });
});

describe("contrat HTTP des rapports", () => {
  test("retourne la collection des rapports sans mise en cache", async () => {
    const response = await GET(new Request("http://localhost/api/reports", { headers: authHeaders }));
    const body = await response.json() as { reports: unknown[]; tenant: string };

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(Array.isArray(body.reports)).toBeTrue();
    expect(body.tenant).toBe("org_axion_demo");
  });

  test("retourne 400 et no-store pour du JSON mal formé", async () => {
    const response = await POST(new Request("http://localhost/api/reports", {
      method: "POST",
      headers: authenticatedHeaders(authHeaders, "application/json"),
      body: "{",
    }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual({ error: "JSON invalide" });
  });

  test("retourne 422 avec les erreurs de champ sans ouvrir la base", async () => {
    const response = await POST(new Request("http://localhost/api/reports", {
      method: "POST",
      headers: authenticatedHeaders(authHeaders, "application/json"),
      body: JSON.stringify({ ...validPayload, interventionId: "demo-1" }),
    }));
    const body = await response.json() as {
      error: string;
      details: Array<{ field: string; message: string }>;
    };

    expect(response.status).toBe(422);
    expect(body.error).toBe("Données de rapport invalides");
    expect(body.details.map((detail) => detail.field)).toContain("interventionId");
  });

  test("persiste atomiquement le rapport, termine l’intervention et journalise l’action", async () => {
    const db = getDb();
    const interventionId = crypto.randomUUID();
    let reportId: string | undefined;
    await db.insert(interventions).values({
      id: interventionId,
      organizationId: "org_axion_demo",
      reference: `INT-TEST-${interventionId.slice(0, 8)}`,
      customerName: "Client test",
      siteName: "Site test",
      address: "1 rue du Test, Lyon",
      title: "Validation transactionnelle",
      technician: "Nicolas Martin",
      scheduledDate: "2026-09-02",
      scheduledTime: "14:00",
      durationMinutes: 30,
      priority: "normal",
      status: "in_progress",
    });

    try {
      const response = await POST(new Request("http://localhost/api/reports", {
        method: "POST",
        headers: authenticatedHeaders(authHeaders, "application/json"),
        body: JSON.stringify({ ...validPayload, interventionId }),
      }));
      const body = await response.json() as {
        report: { id: string; interventionId: string; summary: string };
        intervention: { id: string; status: string };
      };
      reportId = body.report.id;

      expect(response.status).toBe(201);
      expect(body.report.interventionId).toBe(interventionId);
      expect(body.report.summary).toBe(validPayload.summary);
      expect(body.intervention).toMatchObject({ id: interventionId, status: "completed" });

      const storedIntervention = await db
        .select()
        .from(interventions)
        .where(eq(interventions.id, interventionId))
        .get();
      const storedReport = await db
        .select()
        .from(reports)
        .where(eq(reports.interventionId, interventionId))
        .get();
      const logs = await db
        .select()
        .from(auditLogs)
        .where(or(
          eq(auditLogs.entityId, interventionId),
          eq(auditLogs.entityId, reportId),
        ))
        .all();

      expect(storedIntervention?.status).toBe("completed");
      expect(storedReport?.clientName).toBe(validPayload.clientName);
      expect(storedReport?.signatureData).toBe(validSignature);
      expect(logs.map((log) => log.action).sort()).toEqual([
        "intervention.status_changed",
        "report.created",
      ]);
      const reportLog = logs.find((log) => log.action === "report.created");
      const reportMetadata = JSON.parse(reportLog?.metadata ?? "{}") as {
        signatureHash?: string;
        signatureMethod?: string;
      };
      expect(reportMetadata.signatureMethod).toBe("drawn");
      expect(reportMetadata.signatureHash).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      const storedReport = await db
        .select({ id: reports.id })
        .from(reports)
        .where(eq(reports.interventionId, interventionId))
        .get();
      reportId ??= storedReport?.id;
      if (reportId) {
        await db.delete(auditLogs).where(or(
          eq(auditLogs.entityId, interventionId),
          eq(auditLogs.entityId, reportId),
        ));
      } else {
        await db.delete(auditLogs).where(eq(auditLogs.entityId, interventionId));
      }
      await db.delete(reports).where(eq(reports.interventionId, interventionId));
      await db.delete(interventions).where(eq(interventions.id, interventionId));
    }
  });
});
