import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the Axion workflow and removes starter UI", async () => {
  const [app, page, layout, packageJson] = await Promise.all([
    readFile(new URL("app/AxionApp.tsx", root), "utf8"),
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);
  assert.match(app, /Vue responsable/);
  assert.match(app, /Vue technicien/);
  assert.match(app, /Vue client/);
  assert.match(app, /Signature du client/);
  assert.match(app, /Exporter/);
  assert.match(page, /AxionApp/);
  assert.match(layout, /og\.png/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview/SkeletonPreview.tsx", root)));
});

test("declares durable intervention storage and offline shell", async () => {
  const [schema, hosting, serviceWorker, migration] = await Promise.all([
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL("public/sw.js", root), "utf8"),
    readFile(new URL("drizzle/0001_graceful_callisto.sql", root), "utf8"),
  ]);
  assert.match(schema, /interventions/);
  assert.match(schema, /auditLogs/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(hosting, /"r2": "FILES"/);
  assert.match(serviceWorker, /caches\.open/);
  assert.match(migration, /idx_interventions_organization_date/);
});
