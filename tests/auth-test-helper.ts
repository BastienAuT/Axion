import { getDb } from "../db";
import { member, organization } from "../db/better-auth.generated";
import { organizations } from "../db/schema";
import { createAxionAuth } from "../lib/auth";
import type { AxionRole } from "../lib/auth-permissions";

const TEST_PASSWORD = "Test-password-2026!";
const testAuth = createAxionAuth({ allowSignUp: true });

function requestHeaders(authHeaders: Headers, contentType?: string) {
  const headers = new Headers();
  const cookie = authHeaders.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  if (contentType) headers.set("content-type", contentType);
  return headers;
}

export async function createTestSession(options: {
  role?: AxionRole;
  organizationId?: string;
  customerId?: string | null;
  name?: string;
} = {}) {
  const role = options.role ?? "manager";
  const organizationId = options.organizationId ?? "org_axion_demo";
  const name = options.name ?? `Compte test ${role}`;
  const email = `${role}-${crypto.randomUUID()}@axion.test`;
  const signedUp = await testAuth.api.signUpEmail({
    body: { name, email, password: TEST_PASSWORD },
    returnHeaders: true,
  });
  const db = getDb();

  await db.insert(organizations).values({ id: organizationId, name: `Entreprise ${organizationId}` })
    .onConflictDoNothing();
  await db.insert(organization).values({
    id: organizationId,
    name: `Entreprise ${organizationId}`,
    slug: `entreprise-${organizationId.toLocaleLowerCase("fr").replace(/[^a-z0-9]+/g, "-")}`,
    createdAt: new Date(),
  }).onConflictDoNothing();
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId,
    userId: signedUp.response.user.id,
    role,
    createdAt: new Date(),
    customerId: options.customerId ?? null,
  });

  const getSetCookie = (signedUp.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
  const setCookies = getSetCookie?.call(signedUp.headers)
    ?? [signedUp.headers.get("set-cookie")].filter((value): value is string => Boolean(value));
  const cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
  const headers = new Headers({ cookie });

  return {
    headers,
    jsonHeaders: requestHeaders(headers, "application/json"),
    userId: signedUp.response.user.id,
    organizationId,
    customerId: options.customerId ?? null,
  };
}

export function authenticatedHeaders(headers: Headers, contentType?: string) {
  return requestHeaders(headers, contentType);
}
