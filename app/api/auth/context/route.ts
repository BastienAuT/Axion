import { requireAuthContext } from "@/lib/auth-context";

const PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  const authenticated = await requireAuthContext(request);
  if (!authenticated.ok) return authenticated.response;

  return Response.json(
    { authenticated: true, identity: authenticated.context },
    { headers: PRIVATE_HEADERS },
  );
}
