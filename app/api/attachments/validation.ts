import type { ValidationIssue, ValidationResult } from "../interventions/validation";

export const MAX_PHOTO_COUNT = 4;
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_MULTIPART_BYTES = 9 * 1024 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

export type AttachmentFields = { interventionId: string; reportId: string };

export function isAttachmentUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function validateAttachmentFields(
  interventionId: unknown,
  reportId: unknown,
): ValidationResult<AttachmentFields> {
  const issues: ValidationIssue[] = [];
  const normalizedInterventionId = typeof interventionId === "string" ? interventionId.trim() : "";
  const normalizedReportId = typeof reportId === "string" ? reportId.trim() : "";
  if (!isAttachmentUuid(normalizedInterventionId)) {
    issues.push({ field: "interventionId", message: "Identifiant UUID invalide" });
  }
  if (!isAttachmentUuid(normalizedReportId)) {
    issues.push({ field: "reportId", message: "Identifiant UUID invalide" });
  }
  if (issues.length) return { ok: false, issues };
  return {
    ok: true,
    value: { interventionId: normalizedInterventionId, reportId: normalizedReportId },
  };
}

export function safeAttachmentFilename(value: string) {
  const normalized = value.trim().replace(CONTROL_CHARACTERS, "");
  return (normalized || "photo").slice(0, 180);
}

export function detectedImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  return null;
}
