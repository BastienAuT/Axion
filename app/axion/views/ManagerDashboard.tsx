"use client";

import { Icon } from "../icons";
import { formatTodayHeading, statusLabel, todayKey, type Intervention, type View } from "../model";
import { Avatar, EmptyState, Metric, PriorityBadge, StatusBadge } from "../primitives";
import { PageHeading } from "./PageHeading";

function downloadCsv(items: Intervention[]) {
  const rows = [
    ["Référence", "Client", "Intervention", "Technicien", "Date", "Statut"],
    ...items.map((item) => [
      item.reference,
      item.customerName,
      item.title,
      item.technician,
      item.scheduledDate,
      statusLabel[item.status],
    ]),
  ];
  const csv = rows
    .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  link.download = `interventions-axion-${todayKey}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ManagerDashboard({
  items,
  setView,
  onSelect,
}: {
  items: Intervention[];
  setView: (view: View) => void;
  onSelect: (item: Intervention) => void;
}) {
  const today = items
    .filter((item) => item.scheduledDate === todayKey)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const active = items.filter(
    (item) => item.status === "in_progress" || item.status === "en_route",
  );
  const completed = items.filter((item) => item.status === "completed");
  const actionable = items.filter(
    (item) => item.priority === "urgent" && item.status !== "completed" && item.status !== "cancelled",
  );
  const resolvedRate = Math.round(
    (completed.length / Math.max(1, completed.length + active.length)) * 100,
  );
  const technicians = [
    { name: "Nicolas Martin", label: "En intervention", tone: "active" },
    { name: "Sofia Benali", label: "En route", tone: "route" },
    { name: "Lucas Morel", label: "Disponible à 11:00", tone: "available" },
  ];

  return (
    <>
      <PageHeading
        eyebrow={formatTodayHeading()}
        title="Bonjour Claire,"
        description="Votre activité terrain en un coup d’œil."
        actions={
          <button className="secondary-button" onClick={() => downloadCsv(items)}>
            <Icon name="download" />
            Exporter
          </button>
        }
      />

      {actionable.length > 0 && (
        <button className="attention-banner" onClick={() => onSelect(actionable[0])}>
          <span className="attention-icon">
            <Icon name="alert" />
          </span>
          <span>
            <strong>À traiter maintenant</strong>
            <small>
              {actionable[0].reference} · {actionable[0].title} chez {actionable[0].customerName}
            </small>
          </span>
          <span className="attention-action">
            Voir l’intervention <Icon name="arrow-right" size={15} />
          </span>
        </button>
      )}

      <section className="metrics" aria-label="Indicateurs clés">
        <Metric
          label="Interventions aujourd’hui"
          value={String(today.length)}
          change={`${today.filter((item) => item.status !== "completed").length} à suivre`}
          tone="primary"
          icon="calendar"
        />
        <Metric
          label="Équipe sur le terrain"
          value={String(active.length)}
          change="Mises à jour en direct"
          tone="warning"
          icon="activity"
        />
        <Metric
          label="Interventions terminées"
          value={String(completed.length)}
          change="Progression ce mois"
          tone="success"
          icon="check"
          positive
        />
        <Metric
          label="Points d’attention"
          value={String(actionable.length)}
          change={actionable.length ? "Priorité urgente" : "Aucune urgence"}
          tone="violet"
          icon="alert"
        />
      </section>

      <section className="dashboard-grid">
        <div className="panel schedule-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Aujourd’hui</span>
              <h2>Planning du jour</h2>
              <p>
                {today.length} intervention{today.length !== 1 ? "s" : ""} ·{" "}
                {new Set(today.map((item) => item.technician)).size} techniciens
              </p>
            </div>
            <button className="text-button" onClick={() => setView("planning")}>
              Voir le planning <Icon name="arrow-right" size={15} />
            </button>
          </div>
          <div className="timeline">
            {today.map((item) => (
              <button className="timeline-row" key={item.id} onClick={() => onSelect(item)}>
                <time>
                  {item.scheduledTime}
                  <small>{item.durationMinutes} min</small>
                </time>
                <span className={`timeline-dot dot-${item.status}`} aria-hidden="true" />
                <span className="job">
                  <span className="job-title">
                    <strong>{item.title}</strong>
                    {item.priority === "urgent" && <PriorityBadge priority="urgent" />}
                  </span>
                  <small>
                    {item.customerName} · {item.siteName}
                  </small>
                </span>
                <span className="assigned">
                  <Avatar name={item.technician} />
                  {item.technician.split(" ")[0]}
                </span>
                <StatusBadge status={item.status} />
                <Icon name="chevron-right" size={16} />
              </button>
            ))}
            {!today.length && (
              <EmptyState
                icon="calendar"
                title="Journée dégagée"
                description="Aucune intervention n’est prévue aujourd’hui."
              />
            )}
          </div>
        </div>

        <div className="right-stack">
          <div className="panel team-panel">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Temps réel</span>
                <h2>Équipe terrain</h2>
                <p>Disponibilités et missions en cours</p>
              </div>
              <span className="live-pill">
                <i /> Live
              </span>
            </div>
            <div className="team-list">
              {technicians.map((technician) => (
                <div className="team-row" key={technician.name}>
                  <Avatar name={technician.name} available={technician.tone === "available"} />
                  <span>
                    <strong>{technician.name}</strong>
                    <small>{technician.label}</small>
                  </span>
                  <i className={`team-status team-status-${technician.tone}`} />
                </div>
              ))}
            </div>
          </div>

          <div
            className="panel performance"
            style={{ "--progress": `${resolvedRate * 3.6}deg` } as React.CSSProperties}
          >
            <div>
              <span className="panel-kicker">Qualité de service</span>
              <h3>
                {resolvedRate}
                <span>%</span>
              </h3>
              <p>Taux de résolution des missions engagées</p>
            </div>
            <div className="progress-ring" aria-label={`${resolvedRate}% de résolution`}>
              <span>{resolvedRate}%</span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

