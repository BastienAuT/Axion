"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "./icons";
import {
  formatCurrency,
  formatDate,
  formatTodayHeading,
  statusLabel,
  todayKey,
  toDateKey,
  type BillingDocument,
  type BillingStatus,
  type ClientRecord,
  type CreateBillingValues,
  type CreateClientValues,
  type Intervention,
  type InterventionFilter,
  type InterventionReport,
  type ReportAttachment,
  type Role,
  type Status,
  type View,
} from "./model";
import {
  Avatar,
  AttachmentGallery,
  EmptyState,
  Metric,
  Modal,
  PriorityBadge,
  SignatureProof,
  StatusBadge,
} from "./primitives";

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      {actions && <div className="heading-actions">{actions}</div>}
    </section>
  );
}

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

export function TechnicianDashboard({
  items,
  onSelect,
  onReport,
  updateStatus,
  mutationsEnabled,
}: {
  items: Intervention[];
  onSelect: (item: Intervention) => void;
  onReport: (item: Intervention) => void;
  updateStatus: (id: string, status: Status) => Promise<boolean>;
  mutationsEnabled: boolean;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const dayItems = items
    .filter((item) => item.scheduledDate === todayKey && item.status !== "cancelled")
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  const next =
    dayItems.find((item) => item.status === "in_progress") ??
    dayItems.find((item) => item.status === "en_route") ??
    dayItems.find((item) => item.status === "scheduled");
  const completed = dayItems.filter((item) => item.status === "completed").length;
  const checklist = ["Sécuriser la zone", "Prendre une photo avant", "Valider le diagnostic"];

  const toggleCheck = (label: string) => {
    setChecked((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label],
    );
  };

  return (
    <>
      <PageHeading
        eyebrow={`Ma tournée · ${formatTodayHeading()}`}
        title="Bonjour Nicolas,"
        description={`${dayItems.length - completed} mission${dayItems.length - completed !== 1 ? "s" : ""} restante${dayItems.length - completed !== 1 ? "s" : ""} aujourd’hui.`}
        actions={
          <div className="day-progress" aria-label={`${completed} missions terminées sur ${dayItems.length}`}>
            <span>
              {completed}/{dayItems.length}
            </span>
            <small>Terminées</small>
          </div>
        }
      />

      {next ? (
        <section className="next-job">
          <div className="next-job-copy">
            <div className="next-top">
              <span>
                <i /> Prochaine intervention
              </span>
              <StatusBadge status={next.status} />
            </div>
            <p className="next-reference">{next.reference}</p>
            <h2>{next.title}</h2>
            <p>
              {next.customerName} · {next.siteName}
            </p>

            <div className="address-card">
              <span className="address-icon">
                <Icon name="map-pin" />
              </span>
              <span>
                {next.address}
                <small>Ouvrez l’itinéraire pour estimer votre trajet.</small>
              </span>
              <a
                target="_blank"
                rel="noreferrer"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(next.address)}`}
              >
                Itinéraire <Icon name="arrow-up-right" size={15} />
              </a>
            </div>

            <div className="field-checklist">
              <span>Checklist de départ</span>
              {checklist.map((label) => (
                <label key={label}>
                  <input
                    type="checkbox"
                    checked={checked.includes(label)}
                    onChange={() => toggleCheck(label)}
                  />
                  <i>
                    <Icon name="check" size={13} />
                  </i>
                  {label}
                </label>
              ))}
            </div>

            <div className="job-actions">
              {next.status === "scheduled" && (
                <button className="light-primary-button" disabled={!mutationsEnabled} onClick={() => void updateStatus(next.id, "en_route")}>
                  <Icon name="route" />
                  Je pars maintenant
                </button>
              )}
              {next.status === "en_route" && (
                <button
                  className="light-primary-button"
                  disabled={!mutationsEnabled}
                  onClick={() => void updateStatus(next.id, "in_progress")}
                >
                  <Icon name="activity" />
                  Démarrer l’intervention
                </button>
              )}
              {next.status === "in_progress" && (
                <button className="light-primary-button" onClick={() => onReport(next)}>
                  <Icon name="file" />
                  Ouvrir le rapport
                </button>
              )}
              <button className="dark-secondary-button" onClick={() => onSelect(next)}>
                Voir la fiche
              </button>
            </div>
          </div>
          <iframe
            className="map-frame"
            title={`Carte vers ${next.address}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://www.google.com/maps?q=${encodeURIComponent(next.address)}&output=embed`}
          />
        </section>
      ) : (
        <EmptyState
          icon="check"
          title="Tournée terminée"
          description="Toutes les missions du jour sont clôturées. Beau travail."
        />
      )}

      <section className="mobile-list daily-missions">
        <div className="section-title">
          <div>
            <span className="panel-kicker">Agenda</span>
            <h2>Ma journée</h2>
          </div>
          <span>{dayItems.length} missions</span>
        </div>
        {dayItems.map((item) => (
          <button key={item.id} className="mobile-job" onClick={() => onSelect(item)}>
            <time>{item.scheduledTime}</time>
            <span className="mobile-job-copy">
              <strong>{item.title}</strong>
              <span>{item.customerName}</span>
              <small>
                <Icon name="map-pin" size={13} /> {item.address}
              </small>
            </span>
            <StatusBadge status={item.status} />
            <Icon name="chevron-right" size={17} />
          </button>
        ))}
      </section>
    </>
  );
}

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

function startOfWeek(date: Date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return copy;
}

export function Planning({
  items,
  onSelect,
  onCreate,
}: {
  items: Intervention[];
  onSelect: (item: Intervention) => void;
  onCreate: () => void;
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [mode, setMode] = useState<"week" | "agenda">("week");
  const technicians = ["Nicolas Martin", "Sofia Benali", "Lucas Morel"];

  useEffect(() => {
    const responsiveModeTimer = window.setTimeout(() => {
      if (window.matchMedia("(max-width: 820px)").matches) setMode("agenda");
    }, 0);
    return () => window.clearTimeout(responsiveModeTimer);
  }, []);

  const days = useMemo(() => {
    const monday = startOfWeek(new Date());
    monday.setDate(monday.getDate() + weekOffset * 7);
    return Array.from({ length: 5 }, (_, index) => {
      const date = new Date(monday);
      date.setDate(date.getDate() + index);
      return date;
    });
  }, [weekOffset]);

  const rangeLabel = `${formatDate(toDateKey(days[0]), true)} – ${formatDate(toDateKey(days[4]))}`;

  return (
    <>
      <PageHeading
        eyebrow="Organisation"
        title="Planning de l’équipe"
        description={`Semaine du ${rangeLabel}.`}
        actions={
          <button className="primary-button" onClick={onCreate}>
            <Icon name="plus" /> Planifier
          </button>
        }
      />

      <div className="planning-toolbar">
        <div className="date-navigation">
          <button className="icon-button" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Semaine précédente">
            <Icon name="chevron-right" className="rotate-180" />
          </button>
          <button className="secondary-button compact" onClick={() => setWeekOffset(0)}>
            Aujourd’hui
          </button>
          <button className="icon-button" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Semaine suivante">
            <Icon name="chevron-right" />
          </button>
        </div>
        <div className="segmented" role="group" aria-label="Affichage du planning">
          <button className={mode === "week" ? "active" : ""} aria-pressed={mode === "week"} onClick={() => setMode("week")}>
            <Icon name="calendar" size={15} /> Semaine
          </button>
          <button className={mode === "agenda" ? "active" : ""} aria-pressed={mode === "agenda"} onClick={() => setMode("agenda")}>
            <Icon name="activity" size={15} /> Agenda
          </button>
        </div>
      </div>

      {mode === "week" ? (
        <section className="calendar panel" aria-label={`Planning ${rangeLabel}`}>
          <div className="calendar-head">
            <div>Technicien</div>
            {days.map((date) => {
              const key = toDateKey(date);
              return (
                <div key={key} className={key === todayKey ? "today" : ""}>
                  <span>{new Intl.DateTimeFormat("fr-FR", { weekday: "short" }).format(date)}</span>
                  <strong>{date.getDate()}</strong>
                  {key === todayKey && <small>Aujourd’hui</small>}
                </div>
              );
            })}
          </div>
          {technicians.map((technician) => (
            <div className="calendar-row" key={technician}>
              <div className="calendar-tech">
                <Avatar name={technician} available />
                <span>
                  {technician}
                  <small>
                    {items.filter((item) => item.technician === technician && days.some((day) => toDateKey(day) === item.scheduledDate)).length} missions
                  </small>
                </span>
              </div>
              {days.map((date) => {
                const key = toDateKey(date);
                const events = items
                  .filter((item) => item.technician === technician && item.scheduledDate === key)
                  .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
                return (
                  <div className={key === todayKey ? "calendar-cell today" : "calendar-cell"} key={key}>
                    {events.map((item) => (
                      <button
                        key={item.id}
                        className={`calendar-event event-${item.status}`}
                        onClick={() => onSelect(item)}
                      >
                        <span>
                          <time>{item.scheduledTime}</time>
                          {item.priority === "urgent" && <i>Urgent</i>}
                        </span>
                        <strong>{item.customerName}</strong>
                        <small>{item.title}</small>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      ) : (
        <section className="agenda-view">
          {days.map((date) => {
            const key = toDateKey(date);
            const events = items
              .filter((item) => item.scheduledDate === key)
              .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
            return (
              <div className="agenda-day" key={key}>
                <div className={key === todayKey ? "agenda-date today" : "agenda-date"}>
                  <strong>{date.getDate()}</strong>
                  <span>
                    {new Intl.DateTimeFormat("fr-FR", { weekday: "long", month: "short" }).format(date)}
                  </span>
                </div>
                <div className="agenda-events">
                  {events.map((item) => (
                    <button key={item.id} className="agenda-event" onClick={() => onSelect(item)}>
                      <time>{item.scheduledTime}</time>
                      <span>
                        <strong>{item.title}</strong>
                        <small>
                          {item.customerName} · {item.technician}
                        </small>
                      </span>
                      <StatusBadge status={item.status} />
                      <Icon name="chevron-right" size={17} />
                    </button>
                  ))}
                  {!events.length && <span className="agenda-empty">Aucune intervention</span>}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

export function InterventionList({
  items,
  onSelect,
  onCreate,
  role = "manager",
}: {
  items: Intervention[];
  onSelect: (item: Intervention) => void;
  onCreate?: () => void;
  role?: Role;
}) {
  const [filter, setFilter] = useState<InterventionFilter>("all");
  const [sort, setSort] = useState<"date" | "priority">("date");
  const matches = (item: Intervention, value: InterventionFilter) =>
    value === "all" ||
    (value === "active" && (item.status === "en_route" || item.status === "in_progress")) ||
    (value === "scheduled" && item.status === "scheduled") ||
    (value === "completed" && item.status === "completed");
  const rank = { urgent: 4, high: 3, normal: 2, low: 1 };
  const visible = items
    .filter((item) => matches(item, filter))
    .sort((a, b) =>
      sort === "priority"
        ? rank[b.priority] - rank[a.priority]
        : `${b.scheduledDate}${b.scheduledTime}`.localeCompare(`${a.scheduledDate}${a.scheduledTime}`),
    );
  const filters: { id: InterventionFilter; label: string }[] = [
    { id: "all", label: "Toutes" },
    { id: "active", label: "En cours" },
    { id: "scheduled", label: "Planifiées" },
    { id: "completed", label: "Terminées" },
  ];
  const title = role === "technician" ? "Mes interventions" : "Toutes les interventions";

  return (
    <>
      <PageHeading
        eyebrow={role === "technician" ? "Mes missions" : "Opérations"}
        title={title}
        description={`${visible.length} résultat${visible.length !== 1 ? "s" : ""} affiché${visible.length !== 1 ? "s" : ""}.`}
        actions={
          onCreate && (
            <button className="primary-button" onClick={onCreate}>
              <Icon name="plus" /> Nouvelle intervention
            </button>
          )
        }
      />
      <section className="panel table-panel">
        <div className="table-toolbar">
          <div className="filters" role="group" aria-label="Filtrer les interventions">
            {filters.map((option) => (
              <button
                key={option.id}
                className={filter === option.id ? "filter active" : "filter"}
                aria-pressed={filter === option.id}
                onClick={() => setFilter(option.id)}
              >
                {option.label} <b>{items.filter((item) => matches(item, option.id)).length}</b>
              </button>
            ))}
          </div>
          <label className="sort-control">
            <span>Trier par</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
              <option value="date">Date récente</option>
              <option value="priority">Priorité</option>
            </select>
          </label>
        </div>
        <div className="data-table">
          <div className="table-head">
            <span>Intervention</span>
            <span>Client & site</span>
            <span>Date</span>
            <span>Technicien</span>
            <span>Priorité</span>
            <span>Statut</span>
            <span />
          </div>
          {visible.map((item) => (
            <button className="table-row" key={item.id} onClick={() => onSelect(item)}>
              <span className="table-main">
                <strong>{item.title}</strong>
                <small>{item.reference}</small>
              </span>
              <span>
                <strong>{item.customerName}</strong>
                <small>{item.siteName}</small>
              </span>
              <span>
                <strong>{formatDate(item.scheduledDate, true)}</strong>
                <small>
                  {item.scheduledTime} · {item.durationMinutes} min
                </small>
              </span>
              <span className="tech-cell">
                <Avatar name={item.technician} />
                {item.technician}
              </span>
              <PriorityBadge priority={item.priority} />
              <StatusBadge status={item.status} />
              <Icon name="chevron-right" size={17} />
            </button>
          ))}
          {!visible.length && (
            <EmptyState
              icon="search"
              title="Aucun résultat"
              description="Essayez un autre filtre pour retrouver vos interventions."
            />
          )}
        </div>
      </section>
    </>
  );
}

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

export function ReportsView({
  items,
  reports,
  attachments,
  onDownload,
}: {
  items: Intervention[];
  reports: InterventionReport[];
  attachments: ReportAttachment[];
  onDownload: (item: Intervention, report?: InterventionReport) => void;
}) {
  const reportByIntervention = new Map(
    reports.map((report) => [report.interventionId, report]),
  );
  const documents = items.flatMap((item) => {
    const report = reportByIntervention.get(item.id);
    return item.status === "completed" && report ? [{ item, report }] : [];
  });
  const signed = documents.filter(({ report }) => Boolean(report.signedAt)).length;
  const pending = items.filter((item) => item.status === "in_progress").length;
  return (
    <>
      <PageHeading
        eyebrow="Documents"
        title="Rapports d’intervention"
        description="Comptes-rendus réellement finalisés ; les exemples de démonstration sont signalés."
      />
      <section className="report-summary">
        <article>
          <span className="summary-icon summary-primary"><Icon name="file" /></span>
          <div><strong>{documents.length}</strong><small>Rapports disponibles</small></div>
        </article>
        <article>
          <span className="summary-icon summary-success"><Icon name="check" /></span>
          <div><strong>{signed}</strong><small>Signatures présentes</small></div>
        </article>
        <article>
          <span className="summary-icon summary-violet"><Icon name="clock" /></span>
          <div><strong>{pending}</strong><small>À finaliser</small></div>
        </article>
      </section>
      <section className="panel reports-panel">
        <div className="reports-head">
          <span>Rapport</span><span>Client</span><span>Validation</span><span />
        </div>
        {documents.map(({ item, report }) => (
          <div className="report-row" key={report.id}>
            <span className="report-title">
              <i>PDF</i>
              <span><strong>{item.title}</strong><small>{item.reference}</small></span>
            </span>
            <span><strong>{item.customerName}</strong><small>{formatDate(item.scheduledDate)}</small></span>
            <div className={report.demo ? "sent report-proof demo" : "sent report-proof"}>
              <SignatureProof
                compact
                signatureData={report.signatureData}
                signatory={report.clientName}
                signedAt={report.signedAt}
              />
              <AttachmentGallery
                compact
                attachments={attachments.filter(
                  (attachment) => attachment.interventionId === item.id,
                )}
              />
              {report.demo && <small><Icon name="sparkles" size={12} /> Exemple de démo</small>}
            </div>
            <button className="secondary-button compact" onClick={() => onDownload(item, report)}>
              <Icon name="download" size={16} /> Télécharger
            </button>
          </div>
        ))}
        {!documents.length && (
          <EmptyState
            icon="file"
              title="Aucun rapport finalisé"
            description="Un rapport apparaîtra ici après sa finalisation et sa signature."
          />
        )}
      </section>
    </>
  );
}

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
