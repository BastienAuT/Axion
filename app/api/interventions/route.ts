import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditLogs, interventions } from "@/db/schema";

const DEMO_ORG = "org_axion_demo";

export async function GET() {
  try {
    const rows = await getDb().select().from(interventions)
      .where(eq(interventions.organizationId, DEMO_ORG))
      .orderBy(desc(interventions.scheduledDate), desc(interventions.scheduledTime));
    return Response.json({ interventions: rows });
  } catch { return Response.json({ interventions: [], demo: true }); }
}

export async function POST(request: Request) {
  const payload = await request.json() as Record<string, unknown>;
  const required = ["title", "customerName", "siteName", "address", "technician", "scheduledDate", "scheduledTime"];
  if (required.some((key) => typeof payload[key] !== "string" || !String(payload[key]).trim()))
    return Response.json({ error: "Champs obligatoires manquants" }, { status: 400 });
  const id = crypto.randomUUID();
  const reference = `INT-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
  const row = {
    id, organizationId: DEMO_ORG, reference,
    customerName: String(payload.customerName), siteName: String(payload.siteName),
    address: String(payload.address), title: String(payload.title),
    description: String(payload.description ?? ""), technician: String(payload.technician),
    scheduledDate: String(payload.scheduledDate), scheduledTime: String(payload.scheduledTime),
    durationMinutes: Number(payload.durationMinutes ?? 60),
    priority: (payload.priority ?? "normal") as "low" | "normal" | "high" | "urgent",
    status: "scheduled" as const,
  };
  try {
    const db = getDb();
    await db.batch([
      db.insert(interventions).values(row),
      db.insert(auditLogs).values({ id: crypto.randomUUID(), organizationId: DEMO_ORG,
        actorId: "manager_demo", action: "intervention.created", entityType: "intervention",
        entityId: id, metadata: JSON.stringify({ reference }) }),
    ]);
    return Response.json({ intervention: row }, { status: 201 });
  } catch { return Response.json({ intervention: row, demo: true }, { status: 201 }); }
}
