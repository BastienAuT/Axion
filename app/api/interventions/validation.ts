export const INTERVENTION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const INTERVENTION_STATUSES = [
  "scheduled",
  "en_route",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type InterventionPriority = (typeof INTERVENTION_PRIORITIES)[number];
export type InterventionStatus = (typeof INTERVENTION_STATUSES)[number];

export type CreateInterventionInput = {
  title: string;
  customerName: string;
  siteName: string;
  address: string;
  technician: string;
  scheduledDate: string;
  scheduledTime: string;
  description: string;
  durationMinutes: number;
  priority: InterventionPriority;
};

export type StatusUpdateInput = {
  id: string;
  status: InterventionStatus;
};

export type ValidationIssue = {
  field: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: ValidationIssue[] };

export type JsonRequestResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413 | 415; message: string };

const MAX_JSON_BYTES = 32 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const SINGLE_LINE_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MULTILINE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const CREATE_FIELDS = new Set([
  "title",
  "customerName",
  "siteName",
  "address",
  "technician",
  "scheduledDate",
  "scheduledTime",
  "description",
  "durationMinutes",
  "priority",
]);

const STATUS_UPDATE_FIELDS = new Set(["id", "status"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addUnknownFieldIssues(
  payload: Record<string, unknown>,
  allowedFields: ReadonlySet<string>,
  issues: ValidationIssue[],
) {
  for (const field of Object.keys(payload)) {
    if (!allowedFields.has(field)) {
      issues.push({ field, message: "Champ inconnu" });
    }
  }
}

function requiredString(
  payload: Record<string, unknown>,
  field: string,
  maxLength: number,
  issues: ValidationIssue[],
) {
  const value = payload[field];
  if (typeof value !== "string") {
    issues.push({ field, message: "Doit être une chaîne de caractères" });
    return "";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    issues.push({ field, message: "Champ obligatoire" });
  } else if (trimmed.length > maxLength) {
    issues.push({ field, message: `Ne doit pas dépasser ${maxLength} caractères` });
  } else if (SINGLE_LINE_CONTROL_CHARACTERS.test(trimmed)) {
    issues.push({ field, message: "Contient des caractères de contrôle invalides" });
  }
  return trimmed;
}

function optionalDescription(payload: Record<string, unknown>, issues: ValidationIssue[]) {
  const value = payload.description;
  if (value === undefined) return "";
  if (typeof value !== "string") {
    issues.push({ field: "description", message: "Doit être une chaîne de caractères" });
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length > 5_000) {
    issues.push({ field: "description", message: "Ne doit pas dépasser 5000 caractères" });
  } else if (MULTILINE_CONTROL_CHARACTERS.test(trimmed)) {
    issues.push({ field: "description", message: "Contient des caractères de contrôle invalides" });
  }
  return trimmed;
}

function isRealDate(value: string) {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 2000 || year > 2100) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export async function readJsonRequest(
  request: Request,
  maxBytes = MAX_JSON_BYTES,
): Promise<JsonRequestResult> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType?.endsWith("+json")) {
    return { ok: false, status: 415, message: "Le contenu doit être du JSON" };
  }

  const announcedLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(announcedLength) && announcedLength > maxBytes) {
    return { ok: false, status: 413, message: "Corps de requête trop volumineux" };
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return { ok: false, status: 400, message: "Corps de requête illisible" };
  }

  if (new TextEncoder().encode(rawBody).byteLength > maxBytes) {
    return { ok: false, status: 413, message: "Corps de requête trop volumineux" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody) as unknown;
  } catch {
    return { ok: false, status: 400, message: "JSON invalide" };
  }

  if (!isRecord(parsed)) {
    return { ok: false, status: 400, message: "Le corps JSON doit être un objet" };
  }

  return { ok: true, value: parsed };
}

export function validateCreateIntervention(payload: unknown): ValidationResult<CreateInterventionInput> {
  if (!isRecord(payload)) {
    return { ok: false, issues: [{ field: "$", message: "Doit être un objet" }] };
  }

  const issues: ValidationIssue[] = [];
  addUnknownFieldIssues(payload, CREATE_FIELDS, issues);

  const title = requiredString(payload, "title", 160, issues);
  const customerName = requiredString(payload, "customerName", 120, issues);
  const siteName = requiredString(payload, "siteName", 120, issues);
  const address = requiredString(payload, "address", 300, issues);
  const technician = requiredString(payload, "technician", 120, issues);
  const scheduledDate = requiredString(payload, "scheduledDate", 10, issues);
  const scheduledTime = requiredString(payload, "scheduledTime", 5, issues);
  const description = optionalDescription(payload, issues);

  if (scheduledDate && !isRealDate(scheduledDate)) {
    issues.push({ field: "scheduledDate", message: "Date invalide, format attendu : AAAA-MM-JJ" });
  }
  if (scheduledTime && !TIME_PATTERN.test(scheduledTime)) {
    issues.push({ field: "scheduledTime", message: "Heure invalide, format attendu : HH:MM" });
  }

  const rawDuration = payload.durationMinutes === undefined ? 60 : payload.durationMinutes;
  const durationMinutes = typeof rawDuration === "number" ? rawDuration : Number.NaN;
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1_440) {
    issues.push({
      field: "durationMinutes",
      message: "Doit être un entier compris entre 1 et 1440",
    });
  }

  const rawPriority = payload.priority === undefined ? "normal" : payload.priority;
  const priority = INTERVENTION_PRIORITIES.find((candidate) => candidate === rawPriority);
  if (!priority) {
    issues.push({ field: "priority", message: "Priorité invalide" });
  }

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      title,
      customerName,
      siteName,
      address,
      technician,
      scheduledDate,
      scheduledTime,
      description,
      durationMinutes,
      priority: priority!,
    },
  };
}

export function validateStatusUpdate(payload: unknown): ValidationResult<StatusUpdateInput> {
  if (!isRecord(payload)) {
    return { ok: false, issues: [{ field: "$", message: "Doit être un objet" }] };
  }

  const issues: ValidationIssue[] = [];
  addUnknownFieldIssues(payload, STATUS_UPDATE_FIELDS, issues);

  const id = requiredString(payload, "id", 36, issues);
  if (id && !UUID_PATTERN.test(id)) {
    issues.push({ field: "id", message: "Identifiant UUID invalide" });
  }

  const status = INTERVENTION_STATUSES.find((candidate) => candidate === payload.status);
  if (!status) {
    issues.push({ field: "status", message: "Statut invalide" });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: { id, status: status! } };
}

export function canTransitionStatus(from: InterventionStatus, to: InterventionStatus) {
  if (from === to) return true;
  const transitions: Record<InterventionStatus, readonly InterventionStatus[]> = {
    scheduled: ["en_route", "in_progress", "cancelled"],
    en_route: ["in_progress", "cancelled"],
    // Completion is atomic with report creation through POST /api/reports.
    in_progress: ["cancelled"],
    completed: [],
    cancelled: [],
  };
  return transitions[from].includes(to);
}

export function createInterventionReference(
  date = new Date(),
  randomId = crypto.randomUUID(),
) {
  const year = date.getUTCFullYear();
  const timestamp = date.getTime().toString(36).toUpperCase();
  const random = randomId.replaceAll("-", "").slice(0, 8).toUpperCase();
  return `INT-${year}-${timestamp}-${random}`;
}
