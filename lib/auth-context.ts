import { eq } from "drizzle-orm";
import { auth } from "./auth";
import { getDb } from "@/db";
import { member, organization } from "@/db/better-auth.generated";
import { isAxionRole, type AxionRole } from "./auth-permissions";

export type AxionAuthContext = {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: AxionRole;
  customerId: string | null;
};

type AuthContextResult =
  | { ok: true; context: AxionAuthContext }
  | { ok: false; response: Response };

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

function authError(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: PRIVATE_HEADERS });
}

export async function requireAuthContext(
  request: Request,
  allowedRoles: readonly AxionRole[] = ["manager", "technician", "client"],
): Promise<AuthContextResult> {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { ok: false, response: authError("Authentification requise", 401) };

  const activeOrganizationId = session.session.activeOrganizationId;
  const db = getDb();
  const memberships = await db.select().from(member).where(eq(member.userId, session.user.id)).all();
  const membership = activeOrganizationId
    ? memberships.find((item) => item.organizationId === activeOrganizationId)
    : memberships.length === 1
      ? memberships[0]
      : null;

  if (!membership) {
    return {
      ok: false,
      response: authError(
        memberships.length > 1
          ? "Sélectionnez une entreprise avant de continuer"
          : "Ce compte n’appartient à aucune entreprise",
        403,
      ),
    };
  }

  const roles = membership.role.split(",").map((role) => role.trim());
  const role = roles.find(isAxionRole);
  if (!role || !allowedRoles.includes(role)) {
    return { ok: false, response: authError("Accès interdit", 403) };
  }
  const activeOrganization = await db.select({ name: organization.name }).from(organization)
    .where(eq(organization.id, membership.organizationId)).get();

  return {
    ok: true,
    context: {
      userId: session.user.id,
      name: session.user.name,
      email: session.user.email,
      organizationId: membership.organizationId,
      organizationName: activeOrganization?.name ?? "Espace Axion",
      role,
      customerId: membership.customerId ?? null,
    },
  };
}

export async function requirePageAuth(headers: Headers): Promise<AxionAuthContext | null> {
  const result = await requireAuthContext(new Request("http://axion.local", { headers }));
  return result.ok ? result.context : null;
}

export function canAccessIntervention(
  context: AxionAuthContext,
  intervention: {
    organizationId: string;
    customerId: string | null;
    technicianUserId: string | null;
  },
) {
  if (intervention.organizationId !== context.organizationId) return false;
  if (context.role === "manager") return true;
  if (context.role === "technician") return intervention.technicianUserId === context.userId;
  return Boolean(context.customerId) && intervention.customerId === context.customerId;
}
