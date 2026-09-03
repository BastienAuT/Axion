import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: ["./db/schema.ts", "./db/better-auth.generated.ts"],
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./data/axion.sqlite",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
