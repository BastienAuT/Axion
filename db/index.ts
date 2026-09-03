import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as appSchema from "./schema";
import * as authSchema from "./better-auth.generated";

const schema = { ...appSchema, ...authSchema };

const globalForDb = globalThis as unknown as {
  libsqlClient?: Client;
  db?: LibSQLDatabase<typeof schema>;
};

function databaseConnection() {
  const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
  if (tursoUrl) {
    return {
      url: tursoUrl,
      authToken: process.env.TURSO_AUTH_TOKEN?.trim() || undefined,
    };
  }

  const databasePath = process.env.DATABASE_PATH
    ?? (process.env.NODE_ENV === "test" ? ":memory:" : "./data/axion.sqlite");
  if (databasePath === ":memory:") return { url: "file::memory:" };

  const absolutePath = resolve(/* turbopackIgnore: true */ databasePath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  return { url: pathToFileURL(absolutePath).href };
}

export function getDb() {
  if (globalForDb.db) return globalForDb.db;

  const client = createClient(databaseConnection());
  globalForDb.libsqlClient = client;
  globalForDb.db = drizzle(client, { schema });
  return globalForDb.db;
}
