import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { getDb } from "@/db";
import { axionAccess, axionRoles } from "./auth-permissions";

const DEVELOPMENT_SECRET = "axion-development-only-secret-do-not-use-in-production";

function applicationOrigin() {
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  const configured = process.env.APP_URL ?? process.env.BETTER_AUTH_URL
    ?? (vercelUrl ? `https://${vercelUrl}` : undefined);
  if (!configured) return "http://localhost:3000";
  try {
    return new URL(configured).origin;
  } catch {
    return "http://localhost:3000";
  }
}

function trustedOrigins(origin: string) {
  const candidates = [
    origin,
    process.env.APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];
  return [...new Set(candidates.flatMap((candidate) => {
    if (!candidate) return [];
    try {
      return [new URL(candidate).origin];
    } catch {
      return [];
    }
  }))];
}

export function createAxionAuth(options: { allowSignUp?: boolean } = {}) {
  const origin = applicationOrigin();
  return betterAuth({
    appName: "Axion Interventions",
    baseURL: origin,
    secret: process.env.BETTER_AUTH_SECRET ?? DEVELOPMENT_SECRET,
    trustedOrigins: trustedOrigins(origin),
    database: drizzleAdapter(getDb(), {
      provider: "sqlite",
    }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: !options.allowSignUp,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 60,
      storage: "database",
    },
    advanced: {
      database: {
        generateId: "uuid",
        joins: true,
      },
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    plugins: [
      organization({
        ac: axionAccess,
        roles: axionRoles,
        creatorRole: "manager",
        allowUserToCreateOrganization: false,
        membershipLimit: 250,
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
}

export const auth = createAxionAuth();
