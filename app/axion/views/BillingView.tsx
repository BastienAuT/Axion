"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "../icons";
import {
  formatCurrency,
  formatDate,
  type BillingDocument,
  type BillingStatus,
  type ClientRecord,
  type CreateBillingValues,
} from "../model";
import { Metric, Modal } from "../primitives";
import { PageHeading } from "./PageHeading";

export function BillingView({
  documents,
  clients,
  onCreateDocument,
  onUpdateStatus,
  mutationsEnabled,
}: {
  documents: BillingDocument[];
  clients: ClientRecord[];
  onCreateDocument: (document: CreateBillingValues) => Promise<boolean>;
  onUpdateStatus: (document: BillingDocument, status: BillingStatus) => Promise<boolean>;
  mutationsEnabled: boolean;
}) {
  const [tab, setTab] = useState<"all" | "Facture" | "Devis">("all");
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const visible = documents.filter((document) => tab === "all" || document.kind === tab);
  const labels: Record<BillingStatus, string> = {
    draft: "Brouillon",
    sent: "Envoyée",
    paid: "Payée",
    overdue: "En retard",
    accepted: "Accepté",
    rejected: "Refusé",
  };

  const createDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const document: CreateBillingValues = {
      kind: String(data.get("kind")) as BillingDocument["kind"],
      client: String(data.get("client")),
      amount: Number(data.get("amount")),
    };
    setPendingId("create");
    const created = await onCreateDocument(document);
    setPendingId(null);
    if (created) setOpen(false);
  };

  const updateBillingStatus = async (document: BillingDocument, status: BillingStatus) => {
    setPendingId(document.id);
    await onUpdateStatus(document, status);
    setPendingId(null);
  };

  const statusesFor = (document: BillingDocument): BillingStatus[] => {
    if (document.kind === "Devis") {
      if (document.status === "draft") return ["draft", "sent"];
      if (document.status === "sent") return ["sent", "accepted", "rejected"];
      return [document.status];
    }
    if (document.status === "draft") return ["draft", "sent"];
    if (document.status === "sent") return ["sent", "paid", "overdue"];
    if (document.status === "overdue") return ["overdue", "paid", "sent"];
    return [document.status];
  };

  const paid = documents.filter((document) => document.status === "paid");
  const receivable = documents.filter(
    (document) => document.status === "sent" || document.status === "overdue",
  );

  return (
    <>
      <PageHeading
        eyebrow="Gestion commerciale"
        title="Devis & factures"
        description="Suivez vos documents et vos règlements sans quitter Axion."
        actions={
          <button className="primary-button" onClick={() => setOpen(true)} disabled={!mutationsEnabled || !clients.length}>
            <Icon name="plus" /> Nouveau document
          </button>
        }
      />
      <section className="metrics billing-metrics" aria-label="Indicateurs de facturation">
        <Metric
          label="Encaissé"
          value={formatCurrency(paid.reduce((total, document) => total + document.amount, 0))}
          change={`${paid.length} facture${paid.length !== 1 ? "s" : ""} réglée${paid.length !== 1 ? "s" : ""}`}
          tone="success"
          icon="euro"
        />
        <Metric
          label="À encaisser"
          value={formatCurrency(receivable.reduce((total, document) => total + document.amount, 0))}
          change={`${receivable.length} règlement${receivable.length !== 1 ? "s" : ""} à suivre`}
          tone="warning"
          icon="clock"
        />
        <Metric
          label="Devis ouverts"
          value={String(documents.filter((document) => document.kind === "Devis").length)}
          change="À transformer"
          tone="violet"
          icon="receipt"
        />
      </section>
      <section className="panel billing-table">
        <div className="table-toolbar">
          <div className="filters" role="group" aria-label="Filtrer les documents">
            {(["all", "Facture", "Devis"] as const).map((value) => (
              <button
                key={value}
                className={tab === value ? "filter active" : "filter"}
                aria-pressed={tab === value}
                onClick={() => setTab(value)}
              >
                {value === "all" ? "Tous" : value === "Facture" ? "Factures" : "Devis"}{" "}
                <b>{documents.filter((document) => value === "all" || document.kind === value).length}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="billing-head">
          <span>Document</span><span>Client</span><span>Date</span><span>Montant</span><span>Statut</span>
        </div>
        {visible.map((document) => (
          <div className="billing-row" key={document.id}>
            <span data-label="Document"><strong>{document.number}</strong><small>{document.kind}</small></span>
            <strong data-label="Client">{document.client}</strong>
            <span data-label="Date">{formatDate(document.date, true)}</span>
            <strong data-label="Montant">{formatCurrency(document.amount)}</strong>
            <label className={`invoice-status invoice-${document.status}`}>
              <span className="sr-only">Statut de {document.number}</span>
              <select
                value={document.status}
                onChange={(event) => void updateBillingStatus(document, event.target.value as BillingStatus)}
                aria-label={`Statut de ${document.number}`}
                disabled={!mutationsEnabled || pendingId === document.id}
              >
                {statusesFor(document).map((value) => (
                  <option key={value} value={value}>{labels[value]}</option>
                ))}
              </select>
            </label>
          </div>
        ))}
      </section>

      {open && (
        <Modal
          title="Nouveau document"
          subtitle="Créez un devis ou une facture en quelques secondes."
          onClose={() => setOpen(false)}
        >
          <form className="form-grid" onSubmit={(event) => void createDocument(event)}>
            <label>
              Type de document
              <select name="kind" data-autofocus><option>Facture</option><option>Devis</option></select>
            </label>
            <label>
              Client
              <select name="client">
                {clients.map((client) => <option key={client.id ?? client.name}>{client.name}</option>)}
              </select>
            </label>
            <label className="span-2">
              Montant HT (€)
              <input name="amount" type="number" min="1" step="0.01" required placeholder="1 250" />
            </label>
            <div className="modal-actions span-2">
              <button type="button" className="secondary-button" onClick={() => setOpen(false)} disabled={pendingId === "create"}>Annuler</button>
              <button className="primary-button" disabled={pendingId === "create"}>{pendingId === "create" ? <><span className="spinner" /> Création…</> : <><Icon name="plus" /> Créer le brouillon</>}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
