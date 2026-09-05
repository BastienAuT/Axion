"use client";

import { Icon } from "../icons";
import {
  formatDate,
  type Intervention,
  type InterventionReport,
  type ReportAttachment,
} from "../model";
import { AttachmentGallery, EmptyState, SignatureProof } from "../primitives";
import { PageHeading } from "./PageHeading";

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

