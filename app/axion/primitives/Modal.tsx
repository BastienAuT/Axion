"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "../icons";
import { useAccessibleLayer } from "./use-accessible-layer";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const containerRef = useAccessibleLayer(onClose);

  return (
    <div className="modal-layer">
      <button className="modal-backdrop" aria-label="Fermer la fenêtre" onClick={onClose} />
      <section
        ref={containerRef}
        className={wide ? "modal modal-wide" : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <header>
          <div>
            <span className="modal-kicker">Axion</span>
            <h2 id={titleId}>{title}</h2>
            <p id={descriptionId}>{subtitle}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

