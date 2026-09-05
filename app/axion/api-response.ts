type ApiPayload = {
  intervention?: unknown;
  report?: unknown;
  client?: unknown;
  document?: unknown;
  attachments?: unknown;
  error?: string;
  details?: { field?: string; message?: string }[];
};

export async function readApiPayload(response: Response): Promise<ApiPayload> {
  if (!response.headers.get("content-type")?.includes("application/json")) {
    return { error: `Le serveur a retourné une réponse inattendue (${response.status}).` };
  }
  try {
    const payload = (await response.json()) as ApiPayload;
    const issue = payload.details?.[0];
    if (issue?.message) {
      return {
        ...payload,
        error: `${issue.field && issue.field !== "$" ? `${issue.field} : ` : ""}${issue.message}`,
      };
    }
    return payload;
  } catch {
    return { error: `La réponse du serveur est illisible (${response.status}).` };
  }
}

