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

const pad = (value: number) => String(value).padStart(2, "0");

export function toDateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateKeyInParis(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export const todayKey = dateKeyInParis();

export function dateFromToday(offset: number) {
  const date = new Date(`${todayKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

const currentYear = Number(todayKey.slice(0, 4));

export const seedInterventions: Intervention[] = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    reference: `INT-${currentYear}-0048`,
    title: "Maintenance pompe à chaleur",
    customerName: "Atelier Berthier",
    siteName: "Atelier principal",
    address: "18 rue du Bac, Lyon 2e",
    technician: "Nicolas Martin",
    scheduledDate: todayKey,
    scheduledTime: "08:30",
    durationMinutes: 90,
    priority: "high",
    status: "in_progress",
    description:
      "Contrôle complet de la pompe à chaleur, diagnostic des performances et remise en service.",
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    reference: `INT-${currentYear}-0049`,
    title: "Contrôle tableau électrique",
    customerName: "Maison Lenoir",
    siteName: "Résidence Lenoir",
    address: "42 avenue des Frères Lumière, Lyon 8e",
    technician: "Sofia Benali",
    scheduledDate: todayKey,
    scheduledTime: "10:30",
    durationMinutes: 60,
    priority: "normal",
    status: "en_route",
    description:
      "Vérification des protections, serrage des connexions et relevé des mesures de sécurité.",
  },
  {
    id: "40000000-0000-4000-8000-000000000003",
    reference: `INT-${currentYear}-0050`,
    title: "Fuite circuit sanitaire",
    customerName: "Café Auguste",
    siteName: "Restaurant",
    address: "7 place Sathonay, Lyon 1er",
    technician: "Nicolas Martin",
    scheduledDate: todayKey,
    scheduledTime: "14:00",
    durationMinutes: 120,
    priority: "urgent",
    status: "scheduled",
    description:
      "Localiser l’origine de la fuite, sécuriser la zone puis remplacer la pièce défectueuse.",
  },
  {
    id: "40000000-0000-4000-8000-000000000004",
    reference: `INT-${currentYear}-0047`,
    title: "Entretien ventilation",
    customerName: "Groupe Valmont",
    siteName: "Bureaux Confluence",
    address: "12 quai Perrache, Lyon 2e",
    technician: "Sofia Benali",
    scheduledDate: dateFromToday(-1),
    scheduledTime: "15:00",
    durationMinutes: 75,
    priority: "normal",
    status: "completed",
    description: "Nettoyage des bouches, remplacement des filtres et contrôle des débits.",
  },
  {
    id: "40000000-0000-4000-8000-000000000005",
    reference: `INT-${currentYear}-0046`,
    title: "Remplacement thermostat",
    customerName: "Cabinet Orion",
    siteName: "Cabinet médical",
    address: "4 rue Vendôme, Lyon 6e",
    technician: "Lucas Morel",
    scheduledDate: dateFromToday(-2),
    scheduledTime: "09:00",
    durationMinutes: 45,
    priority: "low",
    status: "completed",
    description: "Dépose de l’ancien thermostat, installation et programmation du nouveau modèle.",
  },
  {
    id: "40000000-0000-4000-8000-000000000006",
    reference: `INT-${currentYear}-0038`,
    title: "Révision annuelle compresseur",
    customerName: "Atelier Berthier",
    siteName: "Atelier principal",
    address: "18 rue du Bac, Lyon 2e",
    technician: "Nicolas Martin",
    scheduledDate: dateFromToday(-13),
    scheduledTime: "11:00",
    durationMinutes: 75,
    priority: "normal",
    status: "completed",
    description: "Révision préventive, contrôle des pressions et remplacement du filtre.",
  },
  {
    id: "40000000-0000-4000-8000-000000000007",
    reference: `INT-${currentYear}-0051`,
    title: "Maintenance préventive chaudière",
    customerName: "Régie Molière",
    siteName: "Immeuble République",
    address: "81 cours de la Liberté, Lyon 3e",
    technician: "Lucas Morel",
    scheduledDate: dateFromToday(1),
    scheduledTime: "09:30",
    durationMinutes: 90,
    priority: "normal",
    status: "scheduled",
    description: "Visite annuelle, nettoyage du corps de chauffe et contrôle de combustion.",
  },
];

export const seedReports: InterventionReport[] = seedInterventions
  .filter((item) => item.status === "completed")
  .map((item, index) => ({
    id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    interventionId: item.id,
    summary: item.description ?? "Intervention réalisée et contrôlée.",
    materials: index === 0 ? "Filtres de ventilation" : "Matériel standard d’entretien",
    clientName: item.customerName === "Atelier Berthier" ? "Thomas Berthier" : "Client démonstration",
    signedAt: `${item.scheduledDate}T16:30:00.000Z`,
    signatureData: null,
    createdAt: `${item.scheduledDate}T16:30:00.000Z`,
    demo: true,
  }));

export const seedClients: ClientRecord[] = [
  {
    id: "demo-client-1",
    name: "Atelier Berthier",
    contact: "Thomas Berthier",
    email: "thomas@atelier-berthier.fr",
    phone: "04 72 10 28 40",
    demo: true,
    sites: [
      { name: "Atelier principal", address: "18 rue du Bac, Lyon 2e" },
      { name: "Dépôt", address: "6 rue de la Navigation, Lyon 9e" },
    ],
  },
  {
    id: "demo-client-2",
    name: "Groupe Valmont",
    contact: "Julie Ferreira",
    email: "julie@groupe-valmont.fr",
    phone: "04 78 42 19 00",
    demo: true,
    sites: [{ name: "Bureaux Confluence", address: "12 quai Perrache, Lyon 2e" }],
  },
  {
    id: "demo-client-3",
    name: "Café Auguste",
    contact: "Marc Vignal",
    email: "marc@cafe-auguste.fr",
    phone: "04 72 98 12 44",
    demo: true,
    sites: [{ name: "Restaurant", address: "7 place Sathonay, Lyon 1er" }],
  },
  {
    id: "demo-client-4",
    name: "Maison Lenoir",
    contact: "Alice Lenoir",
    email: "alice.lenoir@example.fr",
    phone: "06 18 54 32 10",
    demo: true,
    sites: [
      { name: "Résidence Lenoir", address: "42 avenue des Frères Lumière, Lyon 8e" },
    ],
  },
  {
    id: "demo-client-5",
    name: "Cabinet Orion",
    contact: "Dr. Émilie Roussel",
    email: "contact@cabinet-orion.fr",
    phone: "04 28 29 11 06",
    demo: true,
    sites: [{ name: "Cabinet médical", address: "4 rue Vendôme, Lyon 6e" }],
  },
];

export const seedBillingDocuments: BillingDocument[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    kind: "Facture",
    number: `FAC-${currentYear}-0087`,
    client: "Groupe Valmont",
    date: dateFromToday(-4),
    amount: 1840,
    status: "sent",
    demo: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    kind: "Facture",
    number: `FAC-${currentYear}-0086`,
    client: "Cabinet Orion",
    date: dateFromToday(-6),
    amount: 620,
    status: "paid",
    demo: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    kind: "Facture",
    number: `FAC-${currentYear}-0082`,
    client: "Maison Lenoir",
    date: dateFromToday(-20),
    amount: 1380,
    status: "overdue",
    demo: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    kind: "Devis",
    number: `DEV-${currentYear}-0041`,
    client: "Café Auguste",
    date: dateFromToday(-3),
    amount: 2290,
    status: "draft",
    demo: true,
  },
];

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
