export type ReportInput = {
  interventionId: string;
  summary: string;
  materials: string;
  clientName: string;
  signedAt?: string;
  signatureData?: string;
};

export type ReportValidationIssue = {
  field: string;
  message: string;
};

export type ReportValidationResult =
  | { ok: true; value: ReportInput }
  | { ok: false; issues: ReportValidationIssue[] };

const REPORT_FIELDS = new Set([
  "interventionId",
  "summary",
  "materials",
  "clientName",
  "signedAt",
  "signatureData",
]);
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RFC3339_PATTERN =
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
const SINGLE_LINE_CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const MULTILINE_CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  payload: Record<string, unknown>,
  field: string,
  maxLength: number,
  multiline: boolean,
  issues: ReportValidationIssue[],
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
  } else if (
    (multiline ? MULTILINE_CONTROL_CHARACTERS : SINGLE_LINE_CONTROL_CHARACTERS).test(trimmed)
  ) {
    issues.push({ field, message: "Contient des caractères de contrôle invalides" });
  }
  return trimmed;
}

function materialsString(payload: Record<string, unknown>, issues: ReportValidationIssue[]) {
  const value = payload.materials;
  if (typeof value !== "string") {
    issues.push({ field: "materials", message: "Doit être une chaîne de caractères" });
    return "";
  }

  const trimmed = value.trim();
  if (trimmed.length > 2_000) {
    issues.push({ field: "materials", message: "Ne doit pas dépasser 2000 caractères" });
  } else if (MULTILINE_CONTROL_CHARACTERS.test(trimmed)) {
    issues.push({ field: "materials", message: "Contient des caractères de contrôle invalides" });
  }
  return trimmed;
}

function hasRealCalendarDate(value: string) {
  const [datePart] = value.split("T", 1);
  const [year, month, day] = datePart.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function signedAtValue(payload: Record<string, unknown>, issues: ReportValidationIssue[]) {
  if (payload.signedAt === undefined) return undefined;
  if (
    typeof payload.signedAt !== "string" ||
    !RFC3339_PATTERN.test(payload.signedAt) ||
    !hasRealCalendarDate(payload.signedAt)
  ) {
    issues.push({ field: "signedAt", message: "Horodatage RFC 3339 invalide" });
    return undefined;
  }

  const parsed = new Date(payload.signedAt);
  if (Number.isNaN(parsed.getTime())) {
    issues.push({ field: "signedAt", message: "Horodatage RFC 3339 invalide" });
    return undefined;
  }
  return parsed.toISOString();
}

function signatureDataValue(
  payload: Record<string, unknown>,
  issues: ReportValidationIssue[],
) {
  if (payload.signatureData === undefined) return undefined;
  if (typeof payload.signatureData !== "string") {
    issues.push({ field: "signatureData", message: "Doit être une chaîne de caractères" });
    return undefined;
  }
  if (payload.signatureData.length > 48_000) {
    issues.push({ field: "signatureData", message: "Signature trop volumineuse" });
    return undefined;
  }

  try {
    const parsed = JSON.parse(payload.signatureData) as unknown;
    if (!isRecord(parsed) || parsed.version !== 1 || parsed.width !== 700 || parsed.height !== 180) {
      throw new Error("format");
    }
    if (!Array.isArray(parsed.strokes) || parsed.strokes.length < 1 || parsed.strokes.length > 40) {
      throw new Error("strokes");
    }

    let points = 0;
    let distance = 0;
    for (const stroke of parsed.strokes) {
      if (!Array.isArray(stroke) || stroke.length < 1) throw new Error("stroke");
      let previous: [number, number] | null = null;
      for (const point of stroke) {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          typeof point[0] !== "number" ||
          typeof point[1] !== "number" ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1]) ||
          point[0] < 0 ||
          point[0] > 700 ||
          point[1] < 0 ||
          point[1] > 180
        ) {
          throw new Error("point");
        }
        if (previous) distance += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
        previous = [point[0], point[1]];
        points += 1;
        if (points > 1_500) throw new Error("points");
      }
    }
    if (points < 2 || distance < 18) throw new Error("empty");
    return payload.signatureData;
  } catch {
    issues.push({ field: "signatureData", message: "Tracé de signature invalide" });
    return undefined;
  }
}

export function validateReport(payload: unknown): ReportValidationResult {
  if (!isRecord(payload)) {
    return { ok: false, issues: [{ field: "$", message: "Doit être un objet" }] };
  }

  const issues: ReportValidationIssue[] = [];
  for (const field of Object.keys(payload)) {
    if (!REPORT_FIELDS.has(field)) issues.push({ field, message: "Champ inconnu" });
  }

  const interventionId = requiredString(payload, "interventionId", 36, false, issues);
  if (interventionId && !UUID_PATTERN.test(interventionId)) {
    issues.push({ field: "interventionId", message: "Identifiant UUID invalide" });
  }

  const summary = requiredString(payload, "summary", 5_000, true, issues);
  const materials = materialsString(payload, issues);
  const clientName = requiredString(payload, "clientName", 120, false, issues);
  const signedAt = signedAtValue(payload, issues);
  const signatureData = signatureDataValue(payload, issues);

  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    value: {
      interventionId,
      summary,
      materials,
      clientName,
      ...(signedAt ? { signedAt } : {}),
      ...(signatureData ? { signatureData } : {}),
    },
  };
}

export function canFinalizeReport(status: string) {
  return status === "in_progress";
}
