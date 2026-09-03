import { beforeAll, describe, expect, test } from "bun:test";
import { eq, or } from "drizzle-orm";
import { migrate } from "drizzle-orm/libsql/migrator";
import { GET as downloadAttachment } from "../app/api/attachments/[id]/route";
import { GET as listAttachments, POST as uploadAttachments } from "../app/api/attachments/route";
import {
  detectedImageType,
  safeAttachmentFilename,
  validateAttachmentFields,
} from "../app/api/attachments/validation";
import { getDb } from "../db";
import { attachments, auditLogs, interventions, reports } from "../db/schema";
import { authenticatedHeaders, createTestSession } from "./auth-test-helper";

process.env.DATABASE_PATH = ":memory:";

let authHeaders = new Headers();

beforeAll(async () => {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  authHeaders = (await createTestSession()).headers;
});

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe("validation des pièces jointes", () => {
  test("reconnaît le contenu réel des images et nettoie les noms", () => {
    expect(detectedImageType(pngBytes)).toBe("image/png");
    expect(detectedImageType(new Uint8Array([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectedImageType(new TextEncoder().encode("not an image"))).toBeNull();
    expect(safeAttachmentFilename(" photo\u0000.png ")).toBe("photo.png");
  });

  test("impose deux références UUID", () => {
    const validId = crypto.randomUUID();
    expect(validateAttachmentFields(validId, validId).ok).toBeTrue();
    expect(validateAttachmentFields("demo-1", "report").ok).toBeFalse();
  });
});

describe("stockage des pièces jointes", () => {
  test("enregistre, liste et restitue une photo avec son audit", async () => {
    const db = getDb();
    const interventionId = crypto.randomUUID();
    const reportId = crypto.randomUUID();
    let attachmentId = "";
    await db.insert(interventions).values({
      id: interventionId,
      organizationId: "org_axion_demo",
      reference: `INT-PHOTO-${interventionId.slice(0, 8)}`,
      customerName: "Client photo",
      siteName: "Site photo",
      address: "1 rue Photo, Lyon",
      title: "Preuve photographique",
      technician: "Nicolas Martin",
      scheduledDate: "2026-09-03",
      scheduledTime: "10:00",
      status: "completed",
    });
    await db.insert(reports).values({
      id: reportId,
      organizationId: "org_axion_demo",
      interventionId,
      summary: "Rapport photo",
      clientName: "Client photo",
      signedAt: "2026-09-03T10:30:00.000Z",
    });

    try {
      const form = new FormData();
      form.set("interventionId", interventionId);
      form.set("reportId", reportId);
      form.append("photos", new File([pngBytes], "avant.png", { type: "image/png" }));
      const uploadResponse = await uploadAttachments(new Request("http://localhost/api/attachments", {
        method: "POST",
        headers: authHeaders,
        body: form,
      }));
      const uploadBody = await uploadResponse.json() as {
        attachments: Array<{ id: string; url: string; contentType: string; sizeBytes: number }>;
      };
      attachmentId = uploadBody.attachments[0].id;
      expect(uploadResponse.status).toBe(201);
      expect(uploadBody.attachments[0]).toMatchObject({
        url: `/api/attachments/${attachmentId}`,
        contentType: "image/png",
        sizeBytes: pngBytes.byteLength,
      });

      const listResponse = await listAttachments(
        new Request(`http://localhost/api/attachments?interventionId=${interventionId}`, { headers: authHeaders }),
      );
      expect((await listResponse.json() as { attachments: unknown[] }).attachments).toHaveLength(1);

      const downloadResponse = await downloadAttachment(
        new Request(`http://localhost/api/attachments/${attachmentId}`, { headers: authHeaders }),
        { params: Promise.resolve({ id: attachmentId }) },
      );
      expect(downloadResponse.status).toBe(200);
      expect(downloadResponse.headers.get("content-type")).toBe("image/png");
      expect(new Uint8Array(await downloadResponse.arrayBuffer())).toEqual(pngBytes);

      const stored = await db.select().from(attachments).where(eq(attachments.id, attachmentId)).get();
      expect(stored?.dataBase64.length).toBeGreaterThan(0);
      const log = await db.select().from(auditLogs).where(eq(auditLogs.entityId, reportId)).get();
      expect(log?.action).toBe("attachments.created");
      expect(JSON.parse(log?.metadata ?? "{}").files[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    } finally {
      await db.delete(auditLogs).where(or(
        eq(auditLogs.entityId, reportId),
        eq(auditLogs.entityId, attachmentId),
      ));
      await db.delete(attachments).where(eq(attachments.interventionId, interventionId));
      await db.delete(reports).where(eq(reports.id, reportId));
      await db.delete(interventions).where(eq(interventions.id, interventionId));
    }
  });

  test("rejette un fichier qui ment sur son type MIME", async () => {
    const form = new FormData();
    form.set("interventionId", crypto.randomUUID());
    form.set("reportId", crypto.randomUUID());
    form.append("photos", new File(["faux PNG"], "faux.png", { type: "image/png" }));
    const response = await uploadAttachments(new Request("http://localhost/api/attachments", {
      method: "POST",
      headers: authenticatedHeaders(authHeaders),
      body: form,
    }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: "Seules les images JPEG et PNG valides sont acceptées",
    });
  });
});
