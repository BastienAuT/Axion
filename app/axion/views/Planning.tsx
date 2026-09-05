"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "../icons";
import { formatDate, todayKey, toDateKey, type Intervention } from "../model";
import { Avatar, StatusBadge } from "../primitives";
import { PageHeading } from "./PageHeading";

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

