"use client";

import { useState, type FormEvent } from "react";
import { Icon } from "../icons";
import {
  formatDate,
  type ClientRecord,
  type CreateClientValues,
  type Intervention,
} from "../model";
import { EmptyState, Modal, StatusBadge } from "../primitives";
import { PageHeading } from "./PageHeading";

export function ClientsView({
  items,
  clients,
  onSelectIntervention,
  onCreateClient,
  mutationsEnabled,
}: {
  items: Intervention[];
  clients: ClientRecord[];
  onSelectIntervention: (item: Intervention) => void;
  onCreateClient: (client: CreateClientValues) => Promise<boolean>;
  mutationsEnabled: boolean;
}) {
  const [selectedClient, setSelectedClient] = useState<ClientRecord | null>(null);
  const [clientOpen, setClientOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const createClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const client: CreateClientValues = {
      name: String(data.get("name")).trim(),
      contact: String(data.get("contact")).trim(),
      email: String(data.get("email")).trim(),
      phone: String(data.get("phone")).trim(),
      siteName: String(data.get("siteName")).trim(),
      address: String(data.get("address")).trim(),
      city: String(data.get("city")).trim(),
    };
    setSubmitting(true);
    const created = await onCreateClient(client);
    setSubmitting(false);
    if (created) setClientOpen(false);
  };

  return (
    <>
      <PageHeading
        eyebrow="Portefeuille"
        title="Clients & sites"
        description={`${clients.length} clients actifs et ${clients.reduce((count, client) => count + client.sites.length, 0)} sites suivis.`}
        actions={
          <button className="primary-button" onClick={() => setClientOpen(true)} disabled={!mutationsEnabled}>
            <Icon name="plus" /> Ajouter un client
          </button>
        }
      />
      <div className="client-grid">
        {clients.map((client) => {
          const related = items.filter((item) => item.customerName === client.name);
          const active = related.filter(
            (item) => item.status === "in_progress" || item.status === "en_route",
          ).length;
          return (
            <button className="client-card" key={client.id ?? client.name} onClick={() => setSelectedClient(client)}>
              <div className="client-card-top">
                <span className="client-logo">
                  {client.name
                    .split(" ")
                    .map((part) => part[0])
                    .slice(0, 2)
                    .join("")}
                </span>
                {active > 0 && <span className="active-client">{active} en cours</span>}
              </div>
              <div>
                <h3>{client.name}</h3>
                <p>{client.contact}</p>
              </div>
              <div className="client-meta">
                <span>
                  <Icon name="map-pin" size={14} /> {client.sites.length} site{client.sites.length > 1 ? "s" : ""}
                </span>
                <span>
                  <Icon name="wrench" size={14} /> {related.length} intervention{related.length !== 1 ? "s" : ""}
                </span>
              </div>
              <strong className="card-link">
                Voir la fiche <Icon name="arrow-right" size={15} />
              </strong>
            </button>
          );
        })}
      </div>

      {clientOpen && (
        <Modal
          title="Ajouter un client"
          subtitle="Créez le contact et son premier site."
          onClose={() => setClientOpen(false)}
        >
          <form className="form-grid" onSubmit={(event) => void createClient(event)}>
            <label>
              Entreprise
              <input name="name" required data-autofocus autoComplete="organization" />
            </label>
            <label>
              Contact principal
              <input name="contact" required autoComplete="name" />
            </label>
            <label>
              E-mail
              <input name="email" type="email" required autoComplete="email" />
            </label>
            <label>
              Téléphone
              <input name="phone" type="tel" required autoComplete="tel" />
            </label>
            <label>
              Nom du site
              <input name="siteName" required maxLength={120} />
            </label>
            <label>
              Adresse
              <input name="address" required maxLength={300} autoComplete="street-address" />
            </label>
            <label className="span-2">
              Ville
              <input name="city" required maxLength={100} autoComplete="address-level2" />
            </label>
            <div className="modal-actions span-2">
              <button type="button" className="secondary-button" onClick={() => setClientOpen(false)} disabled={submitting}>
                Annuler
              </button>
              <button className="primary-button" disabled={submitting}>
                {submitting ? <><span className="spinner" /> Enregistrement…</> : <><Icon name="plus" /> Ajouter le client</>}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {selectedClient && (
        <Modal
          title={selectedClient.name}
          subtitle={`Contact principal · ${selectedClient.contact}`}
          onClose={() => setSelectedClient(null)}
          wide
        >
          <div className="client-detail">
            <div className="contact-strip">
              <a href={`mailto:${selectedClient.email}`}>
                <Icon name="mail" /> {selectedClient.email}
              </a>
              <a href={`tel:${selectedClient.phone.replaceAll(" ", "")}`}>
                <Icon name="activity" /> {selectedClient.phone}
              </a>
            </div>
            <h3>Sites</h3>
            {selectedClient.sites.map((site) => (
              <div className="site-row" key={site.address}>
                <span>
                  <strong>{site.name}</strong>
                  <small>{site.address}</small>
                </span>
                <a
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(site.address)}`}
                >
                  Carte <Icon name="arrow-up-right" size={14} />
                </a>
              </div>
            ))}
            <h3>Dernières interventions</h3>
            {items
              .filter((item) => item.customerName === selectedClient.name)
              .map((item) => (
                <button
                  className="related-job"
                  key={item.id}
                  onClick={() => {
                    setSelectedClient(null);
                    onSelectIntervention(item);
                  }}
                >
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      {item.reference} · {formatDate(item.scheduledDate, true)}
                    </small>
                  </span>
                  <StatusBadge status={item.status} />
                </button>
              ))}
            {!items.some((item) => item.customerName === selectedClient.name) && (
              <EmptyState
                icon="wrench"
                title="Aucune intervention"
                description="Ce client n’a pas encore d’historique."
              />
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

