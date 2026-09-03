import Database from "better-sqlite3";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import {
  axionAccess,
  axionRoles,
} from "../lib/auth-permissions";

// The Better Auth generator executes under Node and cannot import bun:sqlite.
// This isolated in-memory adapter mirrors the runtime options solely for schema generation.
export const auth = betterAuth({
  database: new Database(":memory:"),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  plugins: [
    organization({
      ac: axionAccess,
      roles: axionRoles,
      creatorRole: "manager",
      allowUserToCreateOrganization: false,
      requireEmailVerificationOnInvitation: true,
      schema: {
        member: {
          additionalFields: {
            customerId: {
              type: "string",
              required: false,
              input: false,
            },
          },
        },
      },
    }),
  ],
});
