"use client";

import { useState } from "react";
import { Icon } from "../icons";
import { formatTodayHeading, todayKey, type Intervention, type Status } from "../model";
import { EmptyState, StatusBadge } from "../primitives";
import { PageHeading } from "./PageHeading";

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

