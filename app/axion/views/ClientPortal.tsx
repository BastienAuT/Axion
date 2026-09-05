"use client";

import { Icon } from "../icons";
import { formatDate, type Intervention, type InterventionReport } from "../model";
import { EmptyState, StatusBadge } from "../primitives";
import { PageHeading } from "./PageHeading";

export function ClientPortal({
  items,
  reports,
  section,
  onSelect,
}: {
  items: Intervention[];
  reports: InterventionReport[];
  section: "dashboard" | "interventions" | "reports";
  onSelect: (item: Intervention) => void;
}) {
  const sorted = [...items].sort((a, b) =>
    `${b.scheduledDate}${b.scheduledTime}`.localeCompare(`${a.scheduledDate}${a.scheduledTime}`),
  );
  const active = sorted.find(
    (item) => item.status === "in_progress" || item.status === "en_route",
  );
  const reportInterventionIds = new Set(reports.map((report) => report.interventionId));
  const completed = sorted.filter(
    (item) => item.status === "completed" && reportInterventionIds.has(item.id),
  );

  if (section === "interventions") {
    return (
      <>
        <PageHeading
          eyebrow="Espace client"
          title="Mes interventions"
          description="Suivez vos demandes passées et à venir."
        />
        <ClientDocuments items={sorted} onSelect={onSelect} />
      </>
    );
  }

  if (section === "reports") {
    return (
      <>
        <PageHeading
          eyebrow="Documents"
          title="Mes rapports"
          description="Retrouvez tous vos comptes-rendus finalisés."
        />
        <ClientDocuments items={completed} onSelect={onSelect} reportsOnly />
      </>
    );
  }

  return (
    <>
      <PageHeading
        eyebrow="Espace client sécurisé"
        title={sorted[0]?.customerName ?? "Mon espace"}
        description="Suivez vos demandes et retrouvez vos documents."
        actions={
          <span className="secure-pill">
            <Icon name="check" size={14} />
            <span className="secure-pill-label">Données à jour</span>
          </span>
        }
      />

      {active ? (
        <button className="client-hero" onClick={() => onSelect(active)}>
          <div className="client-live-label">
            <span className="live-dot" /> Intervention en cours
          </div>
          <div className="client-hero-main">
            <div>
              <span>{active.reference}</span>
              <h2>{active.title}</h2>
              <p>
                {active.technician.split(" ")[0]} intervient actuellement sur votre site.
              </p>
            </div>
            <span className="client-hero-action">
              Voir le détail <Icon name="arrow-right" />
            </span>
          </div>
          <div className="client-progress">
            <span className="done">
              Demande créée<small>Reçue</small>
            </span>
            <span className="done">
              Planifiée<small>{formatDate(active.scheduledDate, true)}</small>
            </span>
            <span className="current">
              En cours<small>Suivi en direct</small>
            </span>
            <span>
              Rapport<small>À venir</small>
            </span>
          </div>
        </button>
      ) : (
        <EmptyState
          icon="calendar"
          title="Aucune intervention en cours"
          description="Vos prochaines interventions apparaîtront ici."
        />
      )}

      <section className="client-summary-grid">
        <article>
          <span className="summary-icon summary-primary">
            <Icon name="calendar" />
          </span>
          <div>
            <strong>{items.filter((item) => item.status === "scheduled").length}</strong>
            <small>Intervention à venir</small>
          </div>
        </article>
        <article>
          <span className="summary-icon summary-success">
            <Icon name="file" />
          </span>
          <div>
            <strong>{completed.length}</strong>
            <small>Rapports disponibles</small>
          </div>
        </article>
        <article>
          <span className="summary-icon summary-violet">
            <Icon name="building" />
          </span>
          <div>
            <strong>2</strong>
            <small>Sites suivis</small>
          </div>
        </article>
      </section>

      <div className="panel client-latest">
        <div className="panel-head">
          <div>
            <span className="panel-kicker">Historique</span>
            <h2>Dernières interventions</h2>
            <p>Les dernières mises à jour de votre compte</p>
          </div>
        </div>
        <ClientDocuments items={sorted.slice(0, 4)} onSelect={onSelect} embedded />
      </div>
    </>
  );
}

function ClientDocuments({
  items,
  onSelect,
  reportsOnly = false,
  embedded = false,
}: {
  items: Intervention[];
  onSelect: (item: Intervention) => void;
  reportsOnly?: boolean;
  embedded?: boolean;
}) {
  const body = items.length ? (
    items.map((item) => (
      <button className="doc-row" key={item.id} onClick={() => onSelect(item)}>
        <span className="doc-icon">
          <Icon name={item.status === "completed" ? "file" : "wrench"} size={18} />
        </span>
        <span>
          <strong>{item.title}</strong>
          <small>
            {item.reference} · {item.siteName} · {formatDate(item.scheduledDate, true)}
          </small>
        </span>
        <StatusBadge status={item.status} />
        <Icon name="chevron-right" size={17} />
      </button>
    ))
  ) : (
    <EmptyState
      icon="file"
      title={reportsOnly ? "Aucun rapport disponible" : "Aucune intervention"}
      description={
        reportsOnly
          ? "Les rapports signés apparaîtront ici après chaque intervention."
          : "Votre historique d’intervention est vide."
      }
    />
  );

  if (embedded) return <div className="client-documents">{body}</div>;
  return <section className="panel client-documents">{body}</section>;
}

