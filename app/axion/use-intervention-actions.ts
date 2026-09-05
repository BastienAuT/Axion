"use client";

import { useRef, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  isIntervention,
  statusLabel,
  type Intervention,
  type Priority,
  type Status,
} from "./model";
import { readApiPayload } from "./api-response";
import type { AxionData } from "./use-axion-data";
import type { Notify } from "./ui-types";

type Options = Pick<AxionData, "items" | "setItems" | "online" | "setApiAvailable" | "refreshInterventions"> & {
  notify: Notify;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setCreateOpen: Dispatch<SetStateAction<boolean>>;
  setSelected: Dispatch<SetStateAction<Intervention | null>>;
};

export function useInterventionActions({ items, setItems, online, setApiAvailable, refreshInterventions, notify, setSaving, setCreateOpen, setSelected }: Options) {
  const statusLocks = useRef(new Set<string>());

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

  return { createIntervention, updateStatus };
}
