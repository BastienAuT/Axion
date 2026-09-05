"use client";

import { useState } from "react";
import { Icon } from "../icons";
import { formatDate, type Intervention, type InterventionFilter, type Role } from "../model";
import { Avatar, EmptyState, PriorityBadge, StatusBadge } from "../primitives";
import { PageHeading } from "./PageHeading";

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

