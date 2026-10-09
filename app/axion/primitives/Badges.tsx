"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons";
import { priorityLabel, statusLabel, type Priority, type Status } from "../model";

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`status status-${status}`}>
      <i aria-hidden="true" />
      {statusLabel[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`priority priority-${priority}`}>
      {priority === "urgent" && <Icon name="alert" size={13} />}
      {priorityLabel[priority]}
    </span>
  );
}

export function Avatar({ name, available = false }: { name: string; available?: boolean }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase("fr");

  return (
    <span className="avatar" aria-label={name} title={name}>
      {initials}
      {available && <i aria-label="Disponible" />}
    </span>
  );
}

export function Metric({
  label,
  value,
  change,
  tone,
  icon,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  tone: "primary" | "warning" | "success" | "violet";
  icon: IconName;
  positive?: boolean;
}) {
  return (
    <article className="metric">
      <div className={`metric-icon metric-icon-${tone}`}>
        <Icon name={icon} size={20} />
      </div>
      <div className="metric-copy">
        <p>{label}</p>
        <h2>{value}</h2>
        <small className={positive ? "metric-positive" : undefined}>
          {positive && <Icon name="trending" size={13} />}
          {change}
        </small>
      </div>
    </article>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon name={icon} size={24} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

