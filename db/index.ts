import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import * as appSchema from "./schema";
import * as authSchema from "./better-auth.generated";

const schema = { ...appSchema, ...authSchema };

const globalForDb = globalThis as unknown as {
  sqlite?: Database;
  db?: BunSQLiteDatabase<typeof schema>;
};

export function getDb() {
  if (globalForDb.db) return globalForDb.db;

  const databasePath = process.env.DATABASE_PATH
    ?? (process.env.NODE_ENV === "test" ? ":memory:" : "./data/axion.sqlite");
  if (databasePath !== ":memory:") {
    mkdirSync(dirname(databasePath), { recursive: true });
  }
  const sqlite = new Database(databasePath, { create: true, strict: true });
  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");

  globalForDb.sqlite = sqlite;
  globalForDb.db = drizzle(sqlite, { schema });
  return globalForDb.db;
}
