import { migrate } from "drizzle-orm/libsql/migrator";
import { getDb } from "../db";

await migrate(getDb(), { migrationsFolder: "./drizzle" });
console.info("Migrations Drizzle appliquées.");
