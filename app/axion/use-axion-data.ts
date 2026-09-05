"use client";

import { useCallback, useEffect, useState } from "react";
import {
  isBillingDocument,
  isClientRecord,
  isIntervention,
  isInterventionReport,
  isReportAttachment,
  seedBillingDocuments,
  seedClients,
  seedInterventions,
  seedReports,
  type AxionIdentity,
  type Intervention,
  type InterventionReport,
  type ClientRecord,
  type BillingDocument,
  type ReportAttachment,
} from "./model";
import type { Notify } from "./ui-types";

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

export function useAxionData(identity: AxionIdentity, demoEnabled: boolean, notify: Notify) {
  const role = identity.role;
  const initialDemoItems = demoItemsForIdentity(identity, demoEnabled);
  const initialDemoItemIds = new Set(initialDemoItems.map((item) => item.id));
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
  const [online, setOnline] = useState<boolean | null>(null);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const [loadingData, setLoadingData] = useState(true);
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

  return { items, setItems, reports, setReports, clients, setClients, billingDocuments, setBillingDocuments, attachments, setAttachments, online, apiAvailable, setApiAvailable, loadingData, refreshInterventions };
}

export type AxionData = ReturnType<typeof useAxionData>;
