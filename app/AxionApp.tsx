"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Icon, type IconName } from "./axion/icons";
import { authClient } from "@/lib/auth-client";
import {
  formatDate,
  isBillingDocument,
  isClientRecord,
  isIntervention,
  isInterventionReport,
  isReportAttachment,
  matchesSearch,
  roleLabel,
  seedBillingDocuments,
  seedClients,
  seedInterventions,
  seedReports,
  statusLabel,
  todayKey,
  type BillingDocument,
  type BillingStatus,
  type AxionIdentity,
  type ClientRecord,
  type CreateBillingValues,
  type CreateClientValues,
  type Intervention,
  type InterventionReport,
  type Priority,
  type ReportAttachment,
  type Role,
  type Status,
  type View,
} from "./axion/model";
import {
  Avatar,
  Drawer,
  Modal,
  parseSignatureData,
  SignaturePad,
  StatusBadge,
} from "./axion/primitives";
import {
  BillingView,
  ClientPortal,
  ClientsView,
  InterventionList,
  ManagerDashboard,
  Planning,
  ReportsView,
  TechnicianDashboard,
} from "./axion/views";

type NavItem = { id: View; label: string; icon: IconName };
type Toast = { message: string; tone: "success" | "error" | "info" };
type ReportDraft = { summary: string; materials: string; signatory: string };
type ReportDocument = ReportDraft & {
  reportId?: string;
  signatureData?: string | null;
  signedAt?: string | null;
};

const managerNavigation: NavItem[] = [
  { id: "dashboard", label: "Vue d’ensemble", icon: "home" },
  { id: "planning", label: "Planning", icon: "calendar" },
  { id: "interventions", label: "Interventions", icon: "wrench" },
  { id: "clients", label: "Clients & sites", icon: "users" },
  { id: "reports", label: "Rapports", icon: "file" },
  { id: "billing", label: "Devis & factures", icon: "receipt" },
];

const technicianNavigation: NavItem[] = [
  { id: "dashboard", label: "Ma tournée", icon: "route" },
  { id: "interventions", label: "Mes interventions", icon: "wrench" },
  { id: "reports", label: "Mes rapports", icon: "file" },
];

const clientNavigation: NavItem[] = [
  { id: "dashboard", label: "Mon suivi", icon: "home" },
  { id: "interventions", label: "Mes interventions", icon: "wrench" },
  { id: "reports", label: "Mes rapports", icon: "file" },
];

const defaultReport: ReportDraft = {
  summary: "",
  materials: "",
  signatory: "",
};

function initialReportFor(item: Intervention): ReportDraft {
  return {
    ...defaultReport,
    signatory:
      seedClients.find((client) => client.name === item.customerName)?.contact ?? "",
  };
}

function reportDraftKey(id: string) {
  return `axion:demo:report-draft:${id}`;
}

function readReportDraft(id: string): ReportDraft | null {
  try {
    const raw = window.localStorage.getItem(reportDraftKey(id));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ReportDraft>;
    if (
      typeof value.summary !== "string" ||
      typeof value.materials !== "string" ||
      typeof value.signatory !== "string"
    ) {
      return null;
    }
    return value as ReportDraft;
  } catch {
    return null;
  }
}

function writeReportDraft(id: string, value: ReportDraft) {
  try {
    window.localStorage.setItem(reportDraftKey(id), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function removeReportDraft(id: string) {
  try {
    window.localStorage.removeItem(reportDraftKey(id));
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

function navigationFor(role: Role) {
  if (role === "technician") return technicianNavigation;
  if (role === "client") return clientNavigation;
  return managerNavigation;
}

function initialsFor(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("fr"))
    .join("");
}

function demoItemsForIdentity(identity: AxionIdentity, enabled: boolean) {
  if (!enabled) return [];
  if (identity.role === "manager") return seedInterventions;
  if (identity.role === "technician") {
    return seedInterventions.filter((item) => item.technician === identity.name);
  }
  if (identity.customerId === "10000000-0000-4000-8000-000000000001") {
    return seedInterventions.filter((item) => item.customerName === "Atelier Berthier");
  }
  return [];
}

function ascii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("€", "EUR")
    .replace(/[^\x20-\x7E]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

type ApiPayload = {
  intervention?: unknown;
  report?: unknown;
  client?: unknown;
  document?: unknown;
  attachments?: unknown;
  error?: string;
  details?: { field?: string; message?: string }[];
};

async function readApiPayload(response: Response): Promise<ApiPayload> {
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

function wrapPdfText(value: string, maxLength = 78) {
  const words = ascii(value)
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) =>
      Array.from(
        { length: Math.ceil(word.length / maxLength) },
        (_, index) => word.slice(index * maxLength, (index + 1) * maxLength),
      ),
    );
  if (!words.length) return [""];
  return words.reduce<string[]>((lines, word) => {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > maxLength) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
    return lines;
  }, []);
}

function formatPdfTimestamp(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function downloadReportPdf(item: Intervention, report?: ReportDocument) {
  const summary =
    report?.summary.trim() ||
    item.description ||
    "Diagnostic, remise en etat et controle de fonctionnement.";
  const materials = report?.materials.trim();
  const signatory = report?.signatory.trim();
  const signatureStrokes = parseSignatureData(report?.signatureData);
  const lines = [
    { text: "AXION", size: 12, gap: 28 },
    { text: "Rapport d'intervention", size: 24, gap: 38 },
    { text: item.reference, size: 11, gap: 28 },
    { text: `Intervention : ${item.title}`, size: 13, gap: 24 },
    { text: `Client : ${item.customerName} - ${item.siteName}`, size: 11, gap: 20 },
    { text: `Adresse : ${item.address}`, size: 11, gap: 20 },
    { text: `Date : ${formatDate(item.scheduledDate)} à ${item.scheduledTime}`, size: 11, gap: 20 },
    { text: `Technicien : ${item.technician}`, size: 11, gap: 28 },
    { text: "Compte-rendu", size: 14, gap: 24 },
    ...wrapPdfText(summary).map((text) => ({ text, size: 10, gap: 17 })),
    ...(materials
      ? [
          { text: "Materiel utilise", size: 14, gap: 24 },
          ...wrapPdfText(materials).map((text) => ({ text, size: 10, gap: 17 })),
        ]
      : []),
    ...(signatory ? [{ text: `Signe par : ${signatory}`, size: 11, gap: 24 }] : []),
    { text: "Rapport finalise et valide electroniquement dans Axion.", size: 9, gap: 20 },
  ];
  const pageCommands: string[][] = [[]];
  let y = 790;
  lines.forEach((line) => {
    if (y - line.gap < 54 && pageCommands.at(-1)?.length) {
      pageCommands.push([]);
      y = 790;
    }
    pageCommands.at(-1)?.push(
      `BT /F1 ${line.size} Tf 52 ${y} Td (${ascii(line.text)}) Tj ET`,
    );
    y -= line.gap;
  });
  const signedAtLabel = formatPdfTimestamp(report?.signedAt);
  if (signatory && signedAtLabel) {
    const proofCommands = [
      "BT /F1 18 Tf 52 790 Td (Preuve de signature) Tj ET",
      `BT /F1 11 Tf 52 752 Td (${ascii(`Signataire : ${signatory}`)}) Tj ET`,
      `BT /F1 10 Tf 52 730 Td (${ascii(`Valide le : ${signedAtLabel}`)}) Tj ET`,
      ...(report?.reportId
        ? [`BT /F1 9 Tf 52 710 Td (${ascii(`Identifiant : ${report.reportId}`)}) Tj ET`]
        : []),
      "0.75 0.78 0.86 RG 52 548 420 128 re S",
    ];
    if (signatureStrokes.length) {
      proofCommands.push(
        "q 1.8 w 0.12 0.16 0.27 RG 1 J 1 j",
        ...signatureStrokes.map((stroke) =>
          `${stroke
            .map(([x, pointY], index) =>
              `${(52 + x * 0.6).toFixed(1)} ${(656 - pointY * 0.6).toFixed(1)} ${index ? "l" : "m"}`,
            )
            .join(" ")} S`,
        ),
        "Q",
        "BT /F1 9 Tf 52 528 Td (Signature manuscrite enregistree avec le rapport.) Tj ET",
      );
    } else {
      proofCommands.push(
        "BT /F1 14 Tf 120 607 Td (CONFIRMATION ELECTRONIQUE) Tj ET",
        "BT /F1 9 Tf 137 582 Td (Validation accessible sans trace manuscrite) Tj ET",
      );
    }
    pageCommands.push(proofCommands);
  }
  const pageStreams = pageCommands.map((commands, index) =>
    [
      ...commands,
      `BT /F1 8 Tf 500 28 Td (Page ${index + 1} / ${pageCommands.length}) Tj ET`,
    ].join("\n"),
  );
  const pageIds = pageStreams.map((_, index) => 3 + index * 2);
  const fontId = 3 + pageStreams.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  ];
  pageStreams.forEach((commands, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
    );
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  link.href = url;
  link.download = `${item.reference}-rapport.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function AxionApp({
  identity,
  demoEnabled,
}: {
  identity: AxionIdentity;
  demoEnabled: boolean;
}) {
  const role = identity.role;
  const initialDemoItems = demoItemsForIdentity(identity, demoEnabled);
  const initialDemoItemIds = new Set(initialDemoItems.map((item) => item.id));
  const [view, setView] = useState<View>("dashboard");
  const [items, setItems] = useState<Intervention[]>(initialDemoItems);
  const [reports, setReports] = useState<InterventionReport[]>(
    seedReports.filter((report) => demoEnabled && initialDemoItemIds.has(report.interventionId)),
  );
  const [clients, setClients] = useState<ClientRecord[]>(
    role === "manager" && demoEnabled ? seedClients : [],
  );
  const [billingDocuments, setBillingDocuments] = useState<BillingDocument[]>(
    role === "manager" && demoEnabled ? seedBillingDocuments : [],
  );
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<Intervention | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSigned, setReportSigned] = useState(false);
  const [reportSignature, setReportSignature] = useState<string | null>(null);
  const [reportDraft, setReportDraft] = useState(defaultReport);
  const [photos, setPhotos] = useState<File[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(3);
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const statusLocks = useRef(new Set<string>());

  const notify = useCallback(
    (message: string, tone: Toast["tone"] = "success") => setToast({ message, tone }),
    [],
  );

  const handleSignatureChange = useCallback((signed: boolean, signatureData: string | null) => {
    setReportSigned(signed);
    setReportSignature(signatureData);
  }, []);

  const refreshInterventions = useCallback(
    async (signal?: AbortSignal, showError = false) => {
      try {
        const [response, reportsResponse, clientsResponse, billingResponse, attachmentsResponse] = await Promise.all([
          fetch("/api/interventions", { cache: "no-store", signal }),
          fetch("/api/reports", { cache: "no-store", signal }),
          role === "manager" ? fetch("/api/clients", { cache: "no-store", signal }) : Promise.resolve(null),
          role === "manager" ? fetch("/api/billing", { cache: "no-store", signal }) : Promise.resolve(null),
          fetch("/api/attachments", { cache: "no-store", signal }),
        ]);
        if (
          !response.ok ||
          !reportsResponse.ok ||
          (clientsResponse && !clientsResponse.ok) ||
          (billingResponse && !billingResponse.ok) ||
          !attachmentsResponse.ok
        ) {
          throw new Error("API indisponible");
        }
        const data = (await response.json()) as { interventions?: unknown[] };
        const reportData = (await reportsResponse.json()) as { reports?: unknown[] };
        const clientData = clientsResponse
          ? (await clientsResponse.json()) as { clients?: unknown[] }
          : { clients: [] };
        const billingData = billingResponse
          ? (await billingResponse.json()) as { documents?: unknown[] }
          : { documents: [] };
        const attachmentData = (await attachmentsResponse.json()) as { attachments?: unknown[] };
        const persisted = (data.interventions ?? []).filter(isIntervention);
        const persistedReports = (reportData.reports ?? []).filter(isInterventionReport);
        const persistedClients = (clientData.clients ?? []).filter(isClientRecord);
        const persistedBilling = (billingData.documents ?? []).filter(isBillingDocument);
        const persistedAttachments = (attachmentData.attachments ?? []).filter(isReportAttachment);
        const persistedReferences = new Set(persisted.map((item) => item.reference));
        const persistedReportInterventions = new Set(
          persistedReports.map((report) => report.interventionId),
        );
        const roleDemoItems = demoItemsForIdentity(identity, demoEnabled);
        const roleDemoItemIds = new Set(roleDemoItems.map((item) => item.id));
        setItems([
          ...persisted,
          ...roleDemoItems.filter((item) => !persistedReferences.has(item.reference)),
        ]);
        setReports([
          ...persistedReports,
          ...seedReports.filter(
            (report) => roleDemoItemIds.has(report.interventionId) && !persistedReportInterventions.has(report.interventionId),
          ),
        ]);
        const persistedClientNames = new Set(
          persistedClients.map((client) => client.name.toLocaleLowerCase("fr")),
        );
        setClients([
          ...persistedClients,
          ...(role === "manager" && demoEnabled ? seedClients : []).filter(
            (client) => !persistedClientNames.has(client.name.toLocaleLowerCase("fr")),
          ),
        ]);
        const persistedDocumentNumbers = new Set(
          persistedBilling.map((document) => document.number),
        );
        setBillingDocuments([
          ...persistedBilling,
          ...(role === "manager" && demoEnabled ? seedBillingDocuments : []).filter(
            (document) => !persistedDocumentNumbers.has(document.number),
          ),
        ]);
        setAttachments(persistedAttachments);
        setApiAvailable(true);
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return false;
        setApiAvailable(false);
        if (showError) {
          notify(
            "Les données serveur sont indisponibles. La démonstration locale reste accessible.",
            "info",
          );
        }
        return false;
      } finally {
        setLoadingData(false);
      }
    },
    [demoEnabled, identity, notify, role],
  );

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      setLoadingData(true);
      notify("Connexion rétablie. Les données peuvent à nouveau être synchronisées.", "info");
    };
    const handleOffline = () => {
      setOnline(false);
      setApiAvailable(false);
      setLoadingData(false);
      notify("Mode hors ligne : consultation disponible, modifications suspendues.", "info");
    };
    const initialStatusTimer = window.setTimeout(() => {
      setOnline(navigator.onLine);
      if (!navigator.onLine) {
        setApiAvailable(false);
        setLoadingData(false);
      }
    }, 0);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => registration.update())
        .catch(() => undefined);
    }
    return () => {
      window.clearTimeout(initialStatusTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [notify]);

  useEffect(() => {
    if (online !== true) return;
    const controller = new AbortController();
    const onFocus = () => void refreshInterventions(undefined, false);
    const refreshTimer = window.setTimeout(
      () => void refreshInterventions(controller.signal, true),
      0,
    );
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(refreshTimer);
      controller.abort();
      window.removeEventListener("focus", onFocus);
    };
  }, [online, refreshInterventions]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!reportOpen || !selected) return;
    const timer = window.setTimeout(() => {
      writeReportDraft(selected.id, reportDraft);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [reportDraft, reportOpen, selected]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase("fr") === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "/" && document.activeElement?.tagName !== "INPUT") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (event.key === "Escape") {
        setQuery("");
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navigation = navigationFor(role);
  const filtered = useMemo(
    () => items.filter((item) => matchesSearch(item, query)).slice(0, 6),
    [items, query],
  );
  const demoItemIds = new Set(seedInterventions.map((item) => item.id));
  const hasDemoData = demoEnabled && items.some((item) => demoItemIds.has(item.id));
  const technicianItems = role === "technician" ? items : [];
  const clientItems = role === "client" ? items : [];
  const profileName = identity.name;

  const downloadStoredReport = (item: Intervention, report?: InterventionReport) => {
    downloadReportPdf(
      item,
      report
        ? {
            reportId: report.id,
            summary: report.summary,
            materials: report.materials,
            signatory: report.clientName,
            signatureData: report.signatureData,
            signedAt: report.signedAt,
          }
        : undefined,
    );
  };

  const navigate = (next: View) => {
    setView(next);
    setMobileNav(false);
    setQuery("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      window.location.assign("/login");
    } catch {
      setSigningOut(false);
      notify("La déconnexion a échoué. Réessayez.", "error");
    }
  };

  const openCreate = () => {
    setSelected(null);
    setNotificationsOpen(false);
    setCreateOpen(true);
  };

  const createIntervention = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!online) {
      notify("Une connexion est requise pour créer une intervention.", "error");
      return;
    }
    const data = new FormData(event.currentTarget);
    const creationPayload = {
      title: String(data.get("title")).trim(),
      customerName: String(data.get("customerName")).trim(),
      siteName: String(data.get("siteName")).trim(),
      address: String(data.get("address")).trim(),
      technician: String(data.get("technician")).trim(),
      scheduledDate: String(data.get("scheduledDate")),
      scheduledTime: String(data.get("scheduledTime")),
      durationMinutes: Number(data.get("durationMinutes")),
      priority: String(data.get("priority")) as Priority,
      description: String(data.get("description")).trim(),
    };

    setSaving(true);
    let responseStatus = 0;
    try {
      const response = await fetch("/api/interventions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(creationPayload),
      });
      responseStatus = response.status;
      const payload = await readApiPayload(response);
      if (!response.ok || !isIntervention(payload.intervention)) {
        throw new Error(payload.error ?? "Création impossible");
      }
      setItems((current) => [payload.intervention as Intervention, ...current]);
      setApiAvailable(true);
      setCreateOpen(false);
      notify(`${(payload.intervention as Intervention).reference} a été créée et affectée.`);
    } catch (error) {
      setApiAvailable(responseStatus > 0 && responseStatus < 500);
      notify(error instanceof Error ? error.message : "La création a échoué. Réessayez.", "error");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    if (!online) {
      notify("Une connexion est requise pour modifier le statut.", "error");
      return false;
    }
    const previous = items.find((item) => item.id === id);
    if (!previous) return false;
    if (statusLocks.current.has(id)) {
      notify("Une mise à jour est déjà en cours pour cette intervention.", "info");
      return false;
    }
    statusLocks.current.add(id);

    const apply = (nextStatus: Status) => {
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)),
      );
      setSelected((current) =>
        current?.id === id ? { ...current, status: nextStatus } : current,
      );
    };

    apply(status);
    if (id.startsWith("demo-")) {
      statusLocks.current.delete(id);
      notify(`Statut de démonstration mis à jour : ${statusLabel[status]}.`);
      return true;
    }

    let responseStatus = 0;
    try {
      const response = await fetch("/api/interventions", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      responseStatus = response.status;
      const payload = await readApiPayload(response);
      if (!response.ok || !isIntervention(payload.intervention)) {
        if (response.status === 404 || response.status === 409) {
          void refreshInterventions(undefined, false);
        }
        throw new Error(payload.error ?? "Mise à jour impossible");
      }
      const persisted = payload.intervention as Intervention;
      setItems((current) =>
        current.map((item) => (item.id === id ? { ...item, ...persisted } : item)),
      );
      setSelected((current) =>
        current?.id === id ? { ...current, ...persisted } : current,
      );
      setApiAvailable(true);
      notify(`Statut mis à jour : ${statusLabel[status]}.`);
      return true;
    } catch (error) {
      setApiAvailable(responseStatus > 0 && responseStatus < 500);
      apply(previous.status);
      notify(error instanceof Error ? error.message : "La mise à jour a échoué.", "error");
      return false;
    } finally {
      statusLocks.current.delete(id);
    }
  };

  const createClient = async (client: CreateClientValues) => {
    if (!online) {
      notify("Une connexion est requise pour créer un client.", "error");
      return false;
    }
    let responseStatus = 0;
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(client),
      });
      responseStatus = response.status;
      const payload = await readApiPayload(response);
      if (!response.ok || !isClientRecord(payload.client)) {
        throw new Error(payload.error ?? "Création impossible");
      }
      const created = payload.client as ClientRecord;
      setClients((current) => [
        created,
        ...current.filter(
          (item) => item.name.toLocaleLowerCase("fr") !== created.name.toLocaleLowerCase("fr"),
        ),
      ]);
      setApiAvailable(true);
      notify(`${created.name} a été enregistré avec son premier site.`);
      return true;
    } catch (error) {
      setApiAvailable(responseStatus > 0 && responseStatus < 500);
      notify(error instanceof Error ? error.message : "La création du client a échoué.", "error");
      return false;
    }
  };

  const createBillingDocument = async (document: CreateBillingValues) => {
    if (!online) {
      notify("Une connexion est requise pour créer un document.", "error");
      return false;
    }
    let responseStatus = 0;
    try {
      const response = await fetch("/api/billing", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(document),
      });
      responseStatus = response.status;
      const payload = await readApiPayload(response);
      if (!response.ok || !isBillingDocument(payload.document)) {
        throw new Error(payload.error ?? "Création impossible");
      }
      const created = payload.document as BillingDocument;
      setBillingDocuments((current) => [created, ...current]);
      setApiAvailable(true);
      notify(`${created.number} a été enregistré en brouillon.`);
      return true;
    } catch (error) {
      setApiAvailable(responseStatus > 0 && responseStatus < 500);
      notify(error instanceof Error ? error.message : "La création du document a échoué.", "error");
      return false;
    }
  };

  const updateBillingStatus = async (document: BillingDocument, status: BillingStatus) => {
    if (!online) {
      notify("Une connexion est requise pour modifier ce document.", "error");
      return false;
    }
    let responseStatus = 0;
    try {
      const response = await fetch("/api/billing", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: document.id, status }),
      });
      responseStatus = response.status;
      const payload = await readApiPayload(response);
      if (!response.ok || !isBillingDocument(payload.document)) {
        throw new Error(payload.error ?? "Mise à jour impossible");
      }
      const updated = payload.document as BillingDocument;
      setBillingDocuments((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setApiAvailable(true);
      const labels: Record<BillingStatus, string> = {
        draft: "brouillon",
        sent: "envoyé",
        paid: "payé",
        overdue: "en retard",
        accepted: "accepté",
        rejected: "refusé",
      };
      notify(`${updated.number} : statut ${labels[updated.status]}.`);
      return true;
    } catch (error) {
      setApiAvailable(responseStatus > 0 && responseStatus < 500);
      notify(error instanceof Error ? error.message : "La mise à jour a échoué.", "error");
      return false;
    }
  };

  const openReportFor = (item: Intervention) => {
    setSelected(item);
    setReportDraft(readReportDraft(item.id) ?? initialReportFor(item));
    setReportSigned(false);
    setReportSignature(null);
    setPhotos([]);
    setReportOpen(true);
  };

  const openReport = () => {
    if (selected) openReportFor(selected);
  };

  const selectReportPhotos = (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length > 4) {
      setPhotos([]);
      notify("Vous pouvez joindre jusqu’à 4 photos par envoi.", "error");
      return;
    }
    const invalid = selectedFiles.find(
      (file) => !["image/jpeg", "image/png"].includes(file.type) || file.size <= 0 || file.size > 2 * 1024 * 1024,
    );
    if (invalid) {
      setPhotos([]);
      notify("Chaque photo doit être un JPEG ou PNG de 2 Mo maximum.", "error");
      return;
    }
    setPhotos(selectedFiles);
  };

  const saveReportDraft = () => {
    if (!selected) return;
    const stored = writeReportDraft(selected.id, reportDraft);
    if (!stored) {
      notify("Le brouillon n’a pas pu être enregistré sur cet appareil.", "error");
      return;
    }
    setReportOpen(false);
    notify("Brouillon enregistré sur cet appareil.", "info");
  };

  const finalizeReport = async () => {
    if (!selected || !reportSigned) return;
    if (!reportDraft.summary.trim() || !reportDraft.signatory.trim()) {
      notify("Le compte-rendu et le nom du signataire sont obligatoires.", "error");
      return;
    }
    if (!online) {
      notify("Une connexion est requise pour finaliser le rapport.", "error");
      return;
    }

    setSaving(true);
    let completed: Intervention | null = null;
    let savedReport: InterventionReport | null = null;
    let responseStatus = 0;
    try {
      if (selected.id.startsWith("demo-")) {
        const success = await updateStatus(selected.id, "completed");
        if (!success) return;
        completed = {
          ...selected,
          status: "completed",
          description: reportDraft.summary.trim(),
        };
        const signedAt = new Date().toISOString();
        savedReport = {
          id: `demo-report-${selected.id}`,
          interventionId: selected.id,
          summary: reportDraft.summary.trim(),
          materials: reportDraft.materials.trim(),
          clientName: reportDraft.signatory.trim(),
          signedAt,
          signatureData: reportSignature,
          createdAt: signedAt,
          demo: true,
        };
        setReports((current) => [
          savedReport as InterventionReport,
          ...current.filter((report) => report.interventionId !== selected.id),
        ]);
      } else {
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interventionId: selected.id,
            summary: reportDraft.summary.trim(),
            materials: reportDraft.materials.trim(),
            clientName: reportDraft.signatory.trim(),
            ...(reportSignature ? { signatureData: reportSignature } : {}),
          }),
        });
        responseStatus = response.status;
        const payload = await readApiPayload(response);
        if (
          !response.ok ||
          !isIntervention(payload.intervention) ||
          !isInterventionReport(payload.report)
        ) {
          if (response.status === 404 || response.status === 409) {
            void refreshInterventions(undefined, false);
          }
          throw new Error(payload.error ?? "Finalisation impossible");
        }
        completed = {
          ...(payload.intervention as Intervention),
          description: reportDraft.summary.trim(),
        };
        savedReport = payload.report as InterventionReport;
        setItems((current) =>
          current.map((item) => (item.id === completed?.id ? completed : item)),
        );
        setReports((current) => [
          payload.report as InterventionReport,
          ...current.filter(
            (report) => report.interventionId !== (payload.report as InterventionReport).interventionId,
          ),
        ]);
        setApiAvailable(true);
      }

      let photoUploadError: string | null = null;
      if (photos.length && savedReport && !selected.id.startsWith("demo-")) {
        try {
          const formData = new FormData();
          formData.set("interventionId", selected.id);
          formData.set("reportId", savedReport.id);
          photos.forEach((photo) => formData.append("photos", photo, photo.name));
          const photoResponse = await fetch("/api/attachments", { method: "POST", body: formData });
          const photoPayload = await readApiPayload(photoResponse);
          const uploaded = Array.isArray(photoPayload.attachments)
            ? photoPayload.attachments.filter(isReportAttachment)
            : [];
          if (!photoResponse.ok || uploaded.length !== photos.length) {
            throw new Error(photoPayload.error ?? "Enregistrement des photos impossible");
          }
          setAttachments((current) => [...current, ...uploaded]);
        } catch (error) {
          photoUploadError = error instanceof Error ? error.message : "Enregistrement des photos impossible";
        }
      }

      removeReportDraft(selected.id);
      setReportOpen(false);
      setSelected(null);
      downloadStoredReport(completed, savedReport);
      notify(
        photoUploadError
          ? `Rapport enregistré, mais les photos n’ont pas été jointes : ${photoUploadError}`
          : photos.length
            ? `Rapport et ${photos.length} photo${photos.length > 1 ? "s" : ""} enregistrés. Le PDF a été téléchargé.`
            : "Rapport finalisé et enregistré. Le PDF a été téléchargé.",
        photoUploadError ? "error" : "success",
      );
    } catch (error) {
      setApiAvailable(responseStatus > 0 && responseStatus < 500);
      notify(error instanceof Error ? error.message : "La finalisation a échoué.", "error");
    } finally {
      setSaving(false);
    }
  };

  const renderView = () => {
    if (role === "manager") {
      if (view === "planning") {
        return <Planning items={items} onSelect={setSelected} onCreate={openCreate} />;
      }
      if (view === "interventions") {
        return <InterventionList items={items} onSelect={setSelected} onCreate={openCreate} />;
      }
      if (view === "clients") {
        return (
          <ClientsView
            items={items}
            clients={clients}
            onSelectIntervention={setSelected}
            onCreateClient={createClient}
            mutationsEnabled={online === true}
          />
        );
      }
      if (view === "reports") {
        return <ReportsView items={items} reports={reports} attachments={attachments} onDownload={downloadStoredReport} />;
      }
      if (view === "billing") {
        return (
          <BillingView
            documents={billingDocuments}
            clients={clients}
            onCreateDocument={createBillingDocument}
            onUpdateStatus={updateBillingStatus}
            mutationsEnabled={online === true}
          />
        );
      }
      return <ManagerDashboard items={items} setView={navigate} onSelect={setSelected} />;
    }

    if (role === "technician") {
      if (view === "interventions") {
        return <InterventionList items={technicianItems} onSelect={setSelected} role="technician" />;
      }
      if (view === "reports") {
        return (
          <ReportsView
            items={technicianItems}
            reports={reports}
            attachments={attachments}
            onDownload={downloadStoredReport}
          />
        );
      }
      return (
        <TechnicianDashboard
          items={technicianItems}
          onSelect={setSelected}
          onReport={openReportFor}
          updateStatus={updateStatus}
          mutationsEnabled={online === true}
        />
      );
    }

    return (
      <ClientPortal
        items={clientItems}
        reports={reports}
        section={view === "reports" ? "reports" : view === "interventions" ? "interventions" : "dashboard"}
        onSelect={setSelected}
      />
    );
  };

  const notifications = items.slice(0, 3).map((item, index) => ({
    title: item.status === "completed"
      ? "Rapport finalisé"
      : item.status === "en_route"
        ? "Technicien en route"
        : item.status === "in_progress"
          ? "Intervention démarrée"
          : "Intervention planifiée",
    detail: `${item.technician.split(" ")[0]} · ${item.customerName}`,
    item,
    time: index === 0 ? "À l’instant" : index === 1 ? "Aujourd’hui" : "Récemment",
  }));

  return (
    <div className="app-shell">
      <aside className={mobileNav ? "sidebar open" : "sidebar"}>
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>axion<small>INTERVENTIONS</small></span>
          <button className="nav-close icon-button" onClick={() => setMobileNav(false)} aria-label="Fermer le menu"><Icon name="x" /></button>
        </div>

        <div className="workspace">
          <div className="workspace-badge">{initialsFor(identity.organizationName)}</div>
          <div><strong>{identity.organizationName}</strong><small>Équipe opérationnelle</small></div>
        </div>

        <nav aria-label="Navigation principale">
          <span className="nav-section-label">Espace de travail</span>
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? "active" : ""}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.id === "interventions" && (
                <em>{role === "manager" ? items.length : role === "technician" ? technicianItems.length : clientItems.length}</em>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="sync-state">
            <span className={online === false ? "offline" : apiAvailable === true ? "online" : "pending"} />
            <div>
              <strong>
                {online === null
                  ? "Connexion…"
                  : !online
                    ? "Mode hors ligne"
                    : loadingData
                      ? "Synchronisation…"
                      : apiAvailable
                        ? hasDemoData
                          ? "API + démonstration"
                          : "Données synchronisées"
                        : "Mode démonstration"}
              </strong>
              <small>
                {!online
                  ? "Consultation uniquement"
                  : apiAvailable
                    ? hasDemoData
                      ? "Serveur disponible · exemples inclus"
                      : "Serveur disponible"
                    : "Données locales actives"}
              </small>
            </div>
          </div>
          <div className="profile">
            <Avatar name={profileName} available={online === true} />
            <div><strong>{profileName}</strong><small>{roleLabel[role]}</small></div>
            <button className="profile-signout" onClick={() => void signOut()} disabled={signingOut} aria-label="Se déconnecter">
              <Icon name="log-out" size={17} />
            </button>
          </div>
        </div>
      </aside>

      {mobileNav && <button className="backdrop" aria-label="Fermer le menu" onClick={() => setMobileNav(false)} />}

      <main>
        <header className="topbar">
          <button className="menu icon-button" onClick={() => setMobileNav(true)} aria-label="Ouvrir le menu"><Icon name="menu" /></button>

          <div className="search-wrap">
            <div className="search">
              <Icon name="search" size={19} />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher une intervention, un client…"
                aria-label="Recherche globale"
              />
              {query ? (
                <button className="search-clear" onClick={() => setQuery("")} aria-label="Effacer la recherche"><Icon name="x" size={16} /></button>
              ) : <kbd>⌘ K</kbd>}
            </div>
            {query.trim() && (
              <div className="search-results" id="global-search-results">
                <div className="search-results-head"><span>Résultats</span><small>{filtered.length} trouvé{filtered.length !== 1 ? "s" : ""}</small></div>
                {filtered.map((item) => (
                  <button key={item.id} onClick={() => { setSelected(item); setQuery(""); }}>
                    <span className="search-result-icon"><Icon name="wrench" size={16} /></span>
                    <span><strong>{item.title}</strong><small>{item.reference} · {item.customerName}</small></span>
                    <StatusBadge status={item.status} />
                  </button>
                ))}
                {!filtered.length && <p>Aucun résultat pour « {query} ».</p>}
              </div>
            )}
          </div>

          <div className="top-actions">
            <span className={online === false ? "sync-chip offline" : apiAvailable === false ? "sync-chip local" : "sync-chip"} role="status">
              <Icon name={online === false ? "wifi-off" : apiAvailable === false ? "sparkles" : "cloud"} size={16} />
              {online === null ? "Connexion" : !online ? "Hors ligne" : loadingData ? "Chargement" : apiAvailable ? hasDemoData ? "Démo + API" : "À jour" : "Démo locale"}
            </span>
            <span className="session-role" title={identity.email}>
              <Icon name="users" size={15} /> {roleLabel[role]}
            </span>
            <div className="notification-wrap">
              {notificationsOpen && <button className="popover-backdrop" aria-label="Fermer les notifications" onClick={() => setNotificationsOpen(false)} />}
              <button
                className="bell icon-button"
                aria-label={`${unread} notification${unread !== 1 ? "s" : ""} non lue${unread !== 1 ? "s" : ""}`}
                aria-expanded={notificationsOpen}
                onClick={() => setNotificationsOpen((value) => !value)}
              >
                <Icon name="bell" />{unread > 0 && <i>{unread}</i>}
              </button>
              {notificationsOpen && (
                <div className="notifications-popover" role="dialog" aria-label="Notifications">
                  <header><div><strong>Notifications</strong><small>{unread} non lues</small></div><button onClick={() => setUnread(0)}>Tout marquer comme lu</button></header>
                  {notifications.map((notification, index) => (
                    <button
                      key={`${notification.title}-${index}`}
                      onClick={() => {
                        if (notification.item) setSelected(notification.item);
                        setUnread((value) => Math.max(0, value - 1));
                        setNotificationsOpen(false);
                      }}
                    >
                      <i className="notification-dot" />
                      <span><strong>{notification.title}</strong><small>{notification.detail}</small></span>
                      <time>{notification.time}</time>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {role === "manager" && (
              <button className="primary-button top-create" onClick={openCreate} disabled={online !== true}>
                <Icon name="plus" /> <span>Nouvelle intervention</span>
              </button>
            )}
          </div>
        </header>

        {online === false && (
          <div className="offline-banner" role="status">
            <Icon name="wifi-off" size={17} />
            <span><strong>Vous êtes hors ligne.</strong> Les données déjà chargées restent consultables ; les modifications sont suspendues.</span>
          </div>
        )}

        <div className="content" aria-busy={loadingData}>{renderView()}</div>
      </main>

      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        {navigation.slice(0, 3).map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>
            <Icon name={item.icon} />
            <span>{item.label.replace("Vue d’ensemble", "Accueil").replace("Mes interventions", "Missions")}</span>
          </button>
        ))}
        <button onClick={() => setMobileNav(true)}><Icon name="menu" /><span>Menu</span></button>
      </nav>

      {role === "manager" && (
        <button className="mobile-quick-add" onClick={openCreate} disabled={online !== true} aria-label="Nouvelle intervention"><Icon name="plus" size={23} /></button>
      )}

      {createOpen && (
        <Modal title="Nouvelle intervention" subtitle="Planifiez, priorisez et affectez la mission." onClose={() => !saving && setCreateOpen(false)} wide>
          <form className="form-grid" onSubmit={createIntervention}>
            <label className="span-2">Objet de l’intervention<input name="title" required maxLength={160} placeholder="Ex. Entretien chaudière annuelle" data-autofocus /></label>
            <label>Client<select name="customerName">{clients.map((client) => <option key={client.id ?? client.name}>{client.name}</option>)}</select></label>
            <label>Site<input name="siteName" required maxLength={120} defaultValue="Atelier principal" /></label>
            <label className="span-2">Adresse<input name="address" required maxLength={300} defaultValue="18 rue du Bac, Lyon 2e" autoComplete="street-address" /></label>
            <label>Date<input name="scheduledDate" type="date" required defaultValue={todayKey} /></label>
            <label>Heure<input name="scheduledTime" type="time" required defaultValue="09:00" /></label>
            <label>Technicien<select name="technician"><option>Nicolas Martin</option><option>Sofia Benali</option><option>Lucas Morel</option></select></label>
            <label>Durée estimée<select name="durationMinutes" defaultValue="60"><option value="30">30 min</option><option value="45">45 min</option><option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option></select></label>
            <label>Priorité<select name="priority"><option value="normal">Normale</option><option value="high">Haute</option><option value="urgent">Urgente</option><option value="low">Basse</option></select></label>
            <label className="span-2">Consignes<textarea name="description" rows={3} maxLength={5000} placeholder="Accès, matériel à prévoir, points de vigilance…" /></label>
            <div className="modal-actions span-2">
              <span className="form-hint"><Icon name="cloud" size={15} /> Enregistrement sécurisé</span>
              <button type="button" className="secondary-button" onClick={() => setCreateOpen(false)} disabled={saving}>Annuler</button>
              <button className="primary-button" disabled={saving}>{saving ? <><span className="spinner" /> Création…</> : <><Icon name="plus" /> Créer et affecter</>}</button>
            </div>
          </form>
        </Modal>
      )}

      {selected && !reportOpen && (
        <Drawer
          item={selected}
          role={role}
          onClose={() => setSelected(null)}
          updateStatus={updateStatus}
          statusDisabled={online !== true}
          report={reports.find((report) => report.interventionId === selected.id)}
          attachments={attachments.filter((attachment) => attachment.interventionId === selected.id)}
          onReport={openReport}
          onDownload={() =>
            downloadStoredReport(
              selected,
              reports.find((report) => report.interventionId === selected.id),
            )
          }
        />
      )}

      {reportOpen && selected && (
        <Modal title="Rapport d’intervention" subtitle={`${selected.reference} · ${selected.customerName}`} onClose={() => !saving && setReportOpen(false)} wide>
          <div className="report-form">
            <div className="report-context"><Icon name="wrench" /><span><strong>{selected.title}</strong><small>{selected.siteName} · {selected.technician}</small></span><StatusBadge status={selected.status} /></div>
            <label>Travaux réalisés<textarea value={reportDraft.summary} onChange={(event) => setReportDraft((current) => ({ ...current, summary: event.target.value }))} rows={5} maxLength={5000} required /></label>
            <label>Matériel utilisé<input value={reportDraft.materials} onChange={(event) => setReportDraft((current) => ({ ...current, materials: event.target.value }))} maxLength={2000} /></label>
            <label>Photos <small className="field-note">jointes au rapport et conservées comme preuve</small><span className="photo-zone"><input type="file" accept="image/jpeg,image/png" multiple disabled={selected.id.startsWith("demo-")} onChange={(event) => selectReportPhotos(event.target.files)} aria-label="Joindre des photos au rapport" /><span className="photo-icon"><Icon name="upload" /></span><strong>{selected.id.startsWith("demo-") ? "Disponible sur une intervention enregistrée" : "Ajouter des photos"}</strong><small>{photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} prête${photos.length > 1 ? "s" : ""} à être enregistrée${photos.length > 1 ? "s" : ""}` : "Jusqu’à 4 photos · JPG ou PNG · 2 Mo chacune"}</small></span></label>
            <label>Nom du signataire<input value={reportDraft.signatory} onChange={(event) => setReportDraft((current) => ({ ...current, signatory: event.target.value }))} maxLength={120} required /></label>
            <fieldset className="signature-field"><legend>Signature</legend><SignaturePad onChange={handleSignatureChange} /></fieldset>
            <div className="modal-actions">
              <span className="form-hint"><Icon name="cloud" size={15} /> Texte enregistré automatiquement en local</span>
              <button className="secondary-button" onClick={saveReportDraft} disabled={saving}>Fermer et garder le brouillon</button>
              <button className="primary-button" disabled={online !== true || saving || !reportSigned || !reportDraft.summary.trim() || !reportDraft.signatory.trim()} onClick={() => void finalizeReport()}>{saving ? <><span className="spinner" /> Finalisation…</> : <><Icon name="check" /> Finaliser et générer le PDF</>}</button>
            </div>
          </div>
        </Modal>
      )}

      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          <span>{toast.tone === "error" ? <Icon name="alert" /> : <Icon name="check" />}</span>
          <p>{toast.message}</p>
          <button onClick={() => setToast(null)} aria-label="Fermer la notification"><Icon name="x" size={15} /></button>
        </div>
      )}
    </div>
  );
}
