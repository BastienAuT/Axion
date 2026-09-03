import type { ValidationIssue, ValidationResult } from "../interventions/validation";

export const BILLING_STATUSES = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "accepted",
  "rejected",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];
export type BillingKind = "Facture" | "Devis";
export type CreateBillingInput = { kind: BillingKind; client: string; amountCents: number };
export type UpdateBillingInput = { id: string; status: BillingStatus };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unknownFields(
  payload: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  issues: ValidationIssue[],
) {
  for (const field of Object.keys(payload)) {
    if (!allowed.has(field)) issues.push({ field, message: "Champ inconnu" });
  }
}

export function validateCreateBilling(payload: unknown): ValidationResult<CreateBillingInput> {
  if (!isRecord(payload)) {
    return { ok: false, issues: [{ field: "$", message: "Doit être un objet" }] };
  }
  const issues: ValidationIssue[] = [];
  unknownFields(payload, new Set(["kind", "client", "amount"]), issues);
  const kind = payload.kind === "Facture" || payload.kind === "Devis" ? payload.kind : null;
  if (!kind) issues.push({ field: "kind", message: "Type de document invalide" });
  const client = typeof payload.client === "string" ? payload.client.trim() : "";
  if (!client) issues.push({ field: "client", message: "Champ obligatoire" });
  else if (client.length > 120) issues.push({ field: "client", message: "Ne doit pas dépasser 120 caractères" });
  else if (CONTROL_CHARACTERS.test(client)) issues.push({ field: "client", message: "Contient des caractères invalides" });
  const amount = typeof payload.amount === "number" ? payload.amount : Number.NaN;
  const amountCents = Math.round(amount * 100);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000 || Math.abs(amount * 100 - amountCents) > 1e-7) {
    issues.push({ field: "amount", message: "Montant invalide (deux décimales maximum)" });
  }
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: { kind: kind!, client, amountCents } };
}

export function validateUpdateBilling(payload: unknown): ValidationResult<UpdateBillingInput> {
  if (!isRecord(payload)) {
    return { ok: false, issues: [{ field: "$", message: "Doit être un objet" }] };
  }
  const issues: ValidationIssue[] = [];
  unknownFields(payload, new Set(["id", "status"]), issues);
  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  if (!UUID_PATTERN.test(id)) issues.push({ field: "id", message: "Identifiant UUID invalide" });
  const status = BILLING_STATUSES.find((candidate) => candidate === payload.status);
  if (!status) issues.push({ field: "status", message: "Statut invalide" });
  if (issues.length) return { ok: false, issues };
  return { ok: true, value: { id, status: status! } };
}

export function canTransitionBilling(kind: BillingKind, from: BillingStatus, to: BillingStatus) {
  if (from === to) return true;
  const invoiceTransitions: Partial<Record<BillingStatus, readonly BillingStatus[]>> = {
    draft: ["sent"], sent: ["paid", "overdue"], overdue: ["paid", "sent"], paid: [],
  };
  const quoteTransitions: Partial<Record<BillingStatus, readonly BillingStatus[]>> = {
    draft: ["sent"], sent: ["accepted", "rejected"], accepted: [], rejected: [],
  };
  return (kind === "Facture" ? invoiceTransitions : quoteTransitions)[from]?.includes(to) ?? false;
}
