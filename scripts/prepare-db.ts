import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

if (process.env.TURSO_DATABASE_URL) process.exit(0);

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/axion.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
