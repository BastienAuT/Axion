import { todayKey } from "./dates";

export { dateFromToday, todayKey, toDateKey } from "./dates";
export { seedBillingDocuments, seedClients, seedInterventions, seedReports } from "./demo-data";

export type Status =
  | "scheduled"
  | "en_route"
  | "in_progress"
  | "completed"
  | "cancelled";

export type Priority = "low" | "normal" | "high" | "urgent";
export type Role = "manager" | "technician" | "client";
export type AxionIdentity = {
  userId: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  customerId: string | null;
};
export type View =
  | "dashboard"
  | "planning"
  | "interventions"
  | "clients"
  | "reports"
  | "billing";

export type Intervention = {
  id: string;
  reference: string;
  title: string;
  customerName: string;
  siteName: string;
  address: string;
  technician: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: number;
  priority: Priority;
  status: Status;
  description?: string;
};

export type InterventionReport = {
  id: string;
  interventionId: string;
  summary: string;
  materials: string;
  clientName: string;
  signedAt: string | null;
  signatureData: string | null;
  createdAt?: string;
  demo?: boolean;
};

export type ReportAttachment = {
  id: string;
  interventionId: string;
  reportId: string | null;
  filename: string;
  contentType: "image/jpeg" | "image/png";
  sizeBytes: number;
  url: string;
  createdAt?: string;
};

export type InterventionFilter = "all" | "active" | "scheduled" | "completed";

export type ClientRecord = {
  id?: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  sites: { id?: string; name: string; address: string; city?: string }[];
  demo?: boolean;
};

export type CreateClientValues = {
  name: string;
  contact: string;
  email: string;
  phone: string;
  siteName: string;
  address: string;
  city: string;
};

export type BillingStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "accepted"
  | "rejected";
export type BillingDocument = {
  id: string;
  kind: "Facture" | "Devis";
  number: string;
  client: string;
  date: string;
  amount: number;
  status: BillingStatus;
  demo?: boolean;
};

export type CreateBillingValues = {
  kind: BillingDocument["kind"];
  client: string;
  amount: number;
};

export const statusLabel: Record<Status, string> = {
  scheduled: "Planifiée",
  en_route: "En route",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

export const priorityLabel: Record<Priority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  urgent: "Urgente",
};

export const roleLabel: Record<Role, string> = {
  manager: "Responsable",
  technician: "Technicien",
  client: "Client",
};

export function formatDate(date: string, compact = false) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: compact ? "short" : "long",
    ...(compact ? {} : { year: "numeric" }),
  }).format(new Date(`${date}T12:00:00`));
}

export function formatTodayHeading() {
  const value = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${todayKey}T12:00:00`));
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function matchesSearch(item: Intervention, query: string) {
  const normalized = query.trim().toLocaleLowerCase("fr");
  if (!normalized) return true;
  return [
    item.reference,
    item.title,
    item.customerName,
    item.siteName,
    item.technician,
    item.address,
  ]
    .join(" ")
    .toLocaleLowerCase("fr")
    .includes(normalized);
}

export function isIntervention(value: unknown): value is Intervention {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.reference === "string" &&
    typeof item.title === "string" &&
    typeof item.customerName === "string" &&
    typeof item.siteName === "string" &&
    typeof item.address === "string" &&
    typeof item.technician === "string" &&
    typeof item.scheduledDate === "string" &&
    typeof item.scheduledTime === "string" &&
    typeof item.durationMinutes === "number" &&
    ["low", "normal", "high", "urgent"].includes(String(item.priority)) &&
    ["scheduled", "en_route", "in_progress", "completed", "cancelled"].includes(
      String(item.status),
    )
  );
}

export function isInterventionReport(value: unknown): value is InterventionReport {
  if (!value || typeof value !== "object") return false;
  const report = value as Record<string, unknown>;
  return (
    typeof report.id === "string" &&
    typeof report.interventionId === "string" &&
    typeof report.summary === "string" &&
    typeof report.materials === "string" &&
    typeof report.clientName === "string" &&
    (typeof report.signedAt === "string" || report.signedAt === null) &&
    (typeof report.signatureData === "string" || report.signatureData === null)
  );
}

export function isClientRecord(value: unknown): value is ClientRecord {
  if (!value || typeof value !== "object") return false;
  const client = value as Record<string, unknown>;
  return (
    (typeof client.id === "string" || client.id === undefined) &&
    typeof client.name === "string" &&
    typeof client.contact === "string" &&
    typeof client.email === "string" &&
    typeof client.phone === "string" &&
    Array.isArray(client.sites) &&
    client.sites.every((value) => {
      if (!value || typeof value !== "object") return false;
      const site = value as Record<string, unknown>;
      return (
        (typeof site.id === "string" || site.id === undefined) &&
        typeof site.name === "string" &&
        typeof site.address === "string" &&
        (typeof site.city === "string" || site.city === undefined)
      );
    })
  );
}

export function isBillingDocument(value: unknown): value is BillingDocument {
  if (!value || typeof value !== "object") return false;
  const document = value as Record<string, unknown>;
  return (
    typeof document.id === "string" &&
    (document.kind === "Facture" || document.kind === "Devis") &&
    typeof document.number === "string" &&
    typeof document.client === "string" &&
    typeof document.date === "string" &&
    typeof document.amount === "number" &&
    ["draft", "sent", "paid", "overdue", "accepted", "rejected"].includes(
      String(document.status),
    )
  );
}

export function isReportAttachment(value: unknown): value is ReportAttachment {
  if (!value || typeof value !== "object") return false;
  const attachment = value as Record<string, unknown>;
  return (
    typeof attachment.id === "string" &&
    typeof attachment.interventionId === "string" &&
    (typeof attachment.reportId === "string" || attachment.reportId === null) &&
    typeof attachment.filename === "string" &&
    (attachment.contentType === "image/jpeg" || attachment.contentType === "image/png") &&
    typeof attachment.sizeBytes === "number" &&
    typeof attachment.url === "string"
  );
}
