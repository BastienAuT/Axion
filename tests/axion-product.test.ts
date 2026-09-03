import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readSource = (path: string) => readFile(new URL(path, root), "utf8");

function declaration(source: string, start: string, end: string) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("Axion", () => {
  test("compose les trois parcours métier depuis des modules dédiés", async () => {
    const [app, model, primitives, views] = await Promise.all([
      readSource("app/AxionApp.tsx"),
      readSource("app/axion/model.ts"),
      readSource("app/axion/primitives.tsx"),
      readSource("app/axion/views.tsx"),
    ]);

    expect(app).toContain('from "./axion/model"');
    expect(app).toContain('from "./axion/primitives"');
    expect(app).toContain('from "./axion/views"');
    expect(model).toContain('export type Role = "manager" | "technician" | "client"');

    expect(app).toContain("const role = identity.role");
    expect(app).toContain("authClient.signOut()");
    expect(app).not.toContain("<select value={role}");
    for (const view of ["ManagerDashboard", "TechnicianDashboard", "ClientPortal"]) {
      expect(views).toContain(`export function ${view}`);
    }

    expect(primitives).toContain("export function SignaturePad");
    expect(primitives).toContain('aria-label="Zone de signature client"');
    expect(primitives).toContain("Alternative accessible à la signature manuscrite.");
    expect(app).toContain("<SignaturePad");

    expect(views).toContain("Exporter");
    expect(views).toContain('{ type: "text/csv" }');
    expect(views).toContain("interventions-axion-${todayKey}.csv");
  });

  test("adapte la navigation et les données au rôle actif", async () => {
    const app = await readSource("app/AxionApp.tsx");
    const managerNavigation = declaration(app, "const managerNavigation", "const technicianNavigation");
    const technicianNavigation = declaration(app, "const technicianNavigation", "const clientNavigation");
    const clientNavigation = declaration(app, "const clientNavigation", "const defaultReport");

    expect(managerNavigation.match(/\bid:/g)).toHaveLength(6);
    expect(managerNavigation).toContain('id: "clients"');
    expect(managerNavigation).toContain('id: "billing"');

    expect(technicianNavigation.match(/\bid:/g)).toHaveLength(3);
    expect(technicianNavigation).toContain("Ma tournée");
    expect(technicianNavigation).not.toContain('id: "clients"');
    expect(technicianNavigation).not.toContain('id: "billing"');

    expect(clientNavigation.match(/\bid:/g)).toHaveLength(3);
    expect(clientNavigation).toContain("Mon suivi");
    expect(clientNavigation).not.toContain('id: "planning"');
    expect(clientNavigation).not.toContain('id: "billing"');

    expect(app).toContain("item.technician === identity.name");
    expect(app).toContain('identity.customerId === "10000000-0000-4000-8000-000000000001"');
    expect(app).toContain("items={technicianItems}");
    expect(app).toContain("items={clientItems}");
  });

  test("produit un vrai PDF et garde les modales accessibles", async () => {
    const [app, primitives] = await Promise.all([
      readSource("app/AxionApp.tsx"),
      readSource("app/axion/primitives.tsx"),
    ]);

    expect(app).toContain('let pdf = "%PDF-1.4\\n"');
    expect(app).toContain('{ type: "application/pdf" }');
    expect(app).toContain('link.download = `${item.reference}-rapport.pdf`');
    expect(app).toContain("Finaliser et générer le PDF");

    expect(primitives).toContain('role="dialog"');
    expect(primitives).toContain('aria-modal="true"');
    expect(primitives).toContain("aria-labelledby={titleId}");
    expect(primitives).toContain('event.key === "Escape"');
    expect(primitives).toContain("previousFocus?.focus()");
  });

  test("préserve le mode hors ligne et synchronise les statuts par PATCH", async () => {
    const [app, route, validation, serviceWorker] = await Promise.all([
      readSource("app/AxionApp.tsx"),
      readSource("app/api/interventions/route.ts"),
      readSource("app/api/interventions/validation.ts"),
      readSource("public/sw.js"),
    ]);

    expect(app).toContain('window.addEventListener("offline"');
    expect(app).toContain('.register("/sw.js"');
    expect(app).toContain('className="offline-banner" role="status"');
    expect(serviceWorker).toContain("Authenticated HTML");
    expect(serviceWorker).not.toContain('"/",\n  "/manifest.webmanifest"');

    expect(app).toContain('method: "PATCH"');
    expect(route).toContain("export async function PATCH");
    expect(route).toContain("canTransitionStatus(currentStatus, validated.value.status)");
    expect(route).toContain('action: "intervention.status_changed"');
    expect(validation).toContain("export function validateStatusUpdate");
    expect(validation).toContain("export function canTransitionStatus");
  });

  test("utilise Next natif avec Bun, sans Vite", async () => {
    const packageJson = JSON.parse(await readSource("package.json")) as {
      packageManager?: string;
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.packageManager).toBe("bun@1.3.14");
    expect(packageJson.scripts?.dev).toContain("next");
    expect(packageJson.scripts?.build).toContain("next build");
    expect(packageJson.dependencies?.vinext).toBeUndefined();
    expect(packageJson.devDependencies?.vite).toBeUndefined();
  });

  test("conserve la persistance métier locale ou Turso et son journal d’audit", async () => {
    const [schema, database, route] = await Promise.all([
      readSource("db/schema.ts"),
      readSource("db/index.ts"),
      readSource("app/api/interventions/route.ts"),
    ]);

    expect(schema).toContain("interventions");
    expect(schema).toContain("auditLogs");
    expect(database).toContain('from "@libsql/client"');
    expect(database).toContain("TURSO_DATABASE_URL");
    expect(route).toContain('action: "intervention.created"');
    expect(route).toContain('action: "intervention.status_changed"');
  });
});
