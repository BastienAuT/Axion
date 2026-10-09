"use client";

import { useId, useState } from "react";
import { Icon } from "../icons";
import { formatDate, priorityLabel, statusLabel, type Intervention, type InterventionReport, type ReportAttachment, type Role, type Status } from "../model";
import { useAccessibleLayer } from "./use-accessible-layer";
import { PriorityBadge, StatusBadge } from "./Badges";
import { SignatureProof } from "./Signature";
import { AttachmentGallery } from "./AttachmentGallery";

const statusProgress: Status[] = ["scheduled", "en_route", "in_progress", "completed"];

export function Drawer({
  item,
  role,
  onClose,
  updateStatus,
  onReport,
  onDownload,
  statusDisabled = false,
  report,
  attachments = [],
}: {
  item: Intervention;
  role: Role;
  onClose: () => void;
  updateStatus: (id: string, status: Status) => Promise<boolean>;
  onReport: () => void;
  onDownload: () => void;
  statusDisabled?: boolean;
  report?: InterventionReport;
  attachments?: ReportAttachment[];
}) {
  const titleId = useId();
  const containerRef = useAccessibleLayer(onClose);
  const progressIndex = statusProgress.indexOf(item.status);
  const [updating, setUpdating] = useState(false);

  const changeStatus = async (status: Status) => {
    setUpdating(true);
    try {
      await updateStatus(item.id, status);
    } finally {
      setUpdating(false);
    }
  };

  const primaryAction = () => {
    if (item.status === "completed") {
      return (
        <button className="primary-button" onClick={onDownload}>
          <Icon name="download" />
          Télécharger le rapport
        </button>
      );
    }
    if (role === "client") return null;
    if (item.status === "scheduled") {
      return (
        <button className="primary-button" disabled={statusDisabled || updating} onClick={() => void changeStatus("en_route")}>
          {updating ? <span className="spinner" /> : <Icon name="route" />}
          {updating ? "Mise à jour…" : role === "technician" ? "Je pars maintenant" : "Passer en route"}
        </button>
      );
    }
    if (item.status === "en_route") {
      return (
        <button className="primary-button" disabled={statusDisabled || updating} onClick={() => void changeStatus("in_progress")}>
          {updating ? <span className="spinner" /> : <Icon name="activity" />}
          {updating ? "Mise à jour…" : "Démarrer l’intervention"}
        </button>
      );
    }
    if (item.status === "in_progress") {
      return (
        <button className="primary-button" onClick={onReport}>
          <Icon name="file" />
          Remplir le rapport
        </button>
      );
    }
    return null;
  };

  const action = primaryAction();

  return (
    <div className="drawer-layer">
      <button className="modal-backdrop" aria-label="Fermer la fiche" onClick={onClose} />
      <aside
        ref={containerRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header>
          <div>
            <span>{item.reference}</span>
            <h2 id={titleId}>{item.title}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Fermer">
            <Icon name="x" />
          </button>
        </header>
        <div className="drawer-body">
          <div className="drawer-badges">
            <StatusBadge status={item.status} />
            <PriorityBadge priority={item.priority} />
          </div>

          {item.status !== "cancelled" && (
            <ol className="status-stepper" aria-label="Progression de l’intervention">
              {statusProgress.map((status, index) => (
                <li
                  key={status}
                  className={index < progressIndex ? "done" : index === progressIndex ? "current" : ""}
                  aria-current={index === progressIndex ? "step" : undefined}
                >
                  <i>{index < progressIndex ? <Icon name="check" size={12} /> : index + 1}</i>
                  <span>{statusLabel[status]}</span>
                </li>
              ))}
            </ol>
          )}

          <section className="detail-section">
            <span className="detail-label">Client & site</span>
            <h3>{item.customerName}</h3>
            <p>{item.siteName}</p>
          </section>

          <section className="detail-section">
            <span className="detail-label">Adresse</span>
            <p>{item.address}</p>
            <a
              target="_blank"
              rel="noreferrer"
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(item.address)}`}
            >
              <Icon name="route" size={15} />
              Ouvrir l’itinéraire
              <Icon name="arrow-up-right" size={14} />
            </a>
          </section>

          <dl className="detail-grid">
            <div>
              <dt>Date</dt>
              <dd>{formatDate(item.scheduledDate)}</dd>
            </div>
            <div>
              <dt>Créneau</dt>
              <dd>
                {item.scheduledTime} · {item.durationMinutes} min
              </dd>
            </div>
            <div>
              <dt>Technicien</dt>
              <dd>{item.technician}</dd>
            </div>
            <div>
              <dt>Priorité</dt>
              <dd>{priorityLabel[item.priority]}</dd>
            </div>
          </dl>

          <section className="detail-section">
            <span className="detail-label">Description</span>
            <p>
              {item.description ??
                "Contrôle de l’équipement, diagnostic et remise en état. Vérifier les paramètres de sécurité avant clôture."}
            </p>
          </section>

          {report && (
            <section className="detail-section signature-detail">
              <span className="detail-label">Preuve de signature</span>
              <SignatureProof
                signatureData={report.signatureData}
                signatory={report.clientName}
                signedAt={report.signedAt}
              />
            </section>
          )}

          {attachments.length > 0 && (
            <section className="detail-section attachment-detail">
              <span className="detail-label">Photos enregistrées</span>
              <AttachmentGallery attachments={attachments} />
            </section>
          )}

          <section className="history">
            <h3>Historique</h3>
            <div>
              <i />
              <span>
                <strong>Intervention {statusLabel[item.status].toLocaleLowerCase("fr")}</strong>
                <small>Aujourd’hui · {item.scheduledTime}</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <strong>Affectée à {item.technician}</strong>
                <small>Lors de la planification</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <strong>Intervention créée</strong>
                <small>Depuis l’espace responsable</small>
              </span>
            </div>
          </section>
        </div>
        {action && <footer aria-busy={updating}>{action}</footer>}
      </aside>
    </div>
  );
}
