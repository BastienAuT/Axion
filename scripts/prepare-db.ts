import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const databasePath = resolve(process.env.DATABASE_PATH ?? "./data/axion.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });
