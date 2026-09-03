import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { attachments, interventions } from "@/db/schema";
import { canAccessIntervention, requireAuthContext } from "@/lib/auth-context";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authenticated = await requireAuthContext(request);
  if (!authenticated.ok) return authenticated.response;
  const authContext = authenticated.context;
  const { id } = await context.params;
  if (!UUID_PATTERN.test(id)) return Response.json({ error: "Pièce jointe introuvable" }, { status: 404 });
  try {
    const db = getDb();
    const row = await db.select().from(attachments).where(and(
      eq(attachments.id, id),
      eq(attachments.organizationId, authContext.organizationId),
    )).get();
    if (!row || !row.dataBase64) {
      return Response.json({ error: "Pièce jointe introuvable" }, { status: 404 });
    }
    const intervention = await db.select().from(interventions).where(and(
      eq(interventions.id, row.interventionId),
      eq(interventions.organizationId, authContext.organizationId),
    )).get();
    if (!intervention || !canAccessIntervention(authContext, intervention)) {
      return Response.json({ error: "Pièce jointe introuvable" }, { status: 404 });
    }
    const bytes = Buffer.from(row.dataBase64, "base64");
    return new Response(bytes, {
      headers: {
        "Content-Type": row.contentType,
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    console.error("[api/attachments/:id] GET failed", error);
    return Response.json({ error: "Impossible de charger la pièce jointe" }, { status: 500 });
  }
}
