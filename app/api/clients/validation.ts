import type { ValidationIssue, ValidationResult } from "../interventions/validation";

export type CreateClientInput = {
  name: string;
  contact: string;
  email: string;
  phone: string;
  siteName: string;
  address: string;
  city: string;
};

const ALLOWED_FIELDS = new Set([
  "name",
  "contact",
  "email",
  "phone",
  "siteName",
  "address",
  "city",
]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+()\d][+()\d .-]{5,29}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  payload: Record<string, unknown>,
  field: keyof CreateClientInput,
  maxLength: number,
  issues: ValidationIssue[],
) {
  const value = payload[field];
  if (typeof value !== "string") {
    issues.push({ field, message: "Doit être une chaîne de caractères" });
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) issues.push({ field, message: "Champ obligatoire" });
  else if (trimmed.length > maxLength) {
    issues.push({ field, message: `Ne doit pas dépasser ${maxLength} caractères` });
  } else if (CONTROL_CHARACTERS.test(trimmed)) {
    issues.push({ field, message: "Contient des caractères de contrôle invalides" });
  }
  return trimmed;
}

export function validateCreateClient(payload: unknown): ValidationResult<CreateClientInput> {
  if (!isRecord(payload)) {
    return { ok: false, issues: [{ field: "$", message: "Doit être un objet" }] };
  }

  const issues: ValidationIssue[] = [];
  for (const field of Object.keys(payload)) {
    if (!ALLOWED_FIELDS.has(field)) issues.push({ field, message: "Champ inconnu" });
  }

  const name = requiredString(payload, "name", 120, issues);
  const contact = requiredString(payload, "contact", 120, issues);
  const email = requiredString(payload, "email", 254, issues).toLocaleLowerCase("fr");
  const phone = requiredString(payload, "phone", 30, issues);
  const siteName = requiredString(payload, "siteName", 120, issues);
  const address = requiredString(payload, "address", 300, issues);
  const city = requiredString(payload, "city", 100, issues);

  if (email && !EMAIL_PATTERN.test(email)) {
    issues.push({ field: "email", message: "Adresse e-mail invalide" });
  }
  if (phone && !PHONE_PATTERN.test(phone)) {
    issues.push({ field: "phone", message: "Numéro de téléphone invalide" });
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, value: { name, contact, email, phone, siteName, address, city } };
}
