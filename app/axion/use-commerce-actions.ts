"use client";

import {
  isClientRecord,
  isBillingDocument,
  type ClientRecord,
  type BillingDocument,
  type BillingStatus,
  type CreateClientValues,
  type CreateBillingValues,
} from "./model";
import { readApiPayload } from "./api-response";
import type { AxionData } from "./use-axion-data";
import type { Notify } from "./ui-types";

type Options = Pick<AxionData, "online" | "setApiAvailable" | "setClients" | "setBillingDocuments"> & { notify: Notify };

export function useCommerceActions({ online, setApiAvailable, setClients, setBillingDocuments, notify }: Options) {
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

  return { createClient, createBillingDocument, updateBillingStatus };
}
