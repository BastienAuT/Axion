"use client";

import Image from "next/image";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "./icons";
import {
  formatDate,
  priorityLabel,
  statusLabel,
  type Intervention,
  type InterventionReport,
  type Priority,
  type ReportAttachment,
  type Role,
  type Status,
} from "./model";

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

function useAccessibleLayer(onClose: () => void) {
  const containerRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const layer = containerRef.current;
    const layerRoot = layer?.parentElement;
    const backgroundElements = Array.from(layerRoot?.parentElement?.children ?? [])
      .filter((element): element is HTMLElement => element instanceof HTMLElement && element !== layerRoot)
      .map((element) => ({
        element,
        inert: element.inert,
        ariaHidden: element.getAttribute("aria-hidden"),
      }));
    backgroundElements.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    const focusable = () =>
      Array.from(
        layer?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));

    const focusTimer = window.setTimeout(() => {
      const preferred = layer?.querySelector<HTMLElement>("[data-autofocus]");
      (preferred ?? focusable()[0] ?? layer)?.focus();
    }, 0);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (!elements.length) {
        event.preventDefault();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach(({ element, inert, ariaHidden }) => {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      previousFocus?.focus();
    };
  }, []);

  return containerRef;
}

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

export type SignaturePoint = [number, number];
export type SignatureStroke = SignaturePoint[];

export function parseSignatureData(value: string | null | undefined): SignatureStroke[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as {
      version?: unknown;
      width?: unknown;
      height?: unknown;
      strokes?: unknown;
    };
    if (
      parsed.version !== 1 ||
      parsed.width !== 700 ||
      parsed.height !== 180 ||
      !Array.isArray(parsed.strokes)
    ) {
      return [];
    }
    const strokes: SignatureStroke[] = [];
    for (const stroke of parsed.strokes) {
      if (!Array.isArray(stroke)) return [];
      const points: SignatureStroke = [];
      for (const point of stroke) {
        if (
          !Array.isArray(point) ||
          point.length !== 2 ||
          typeof point[0] !== "number" ||
          typeof point[1] !== "number" ||
          !Number.isFinite(point[0]) ||
          !Number.isFinite(point[1])
        ) {
          return [];
        }
        points.push([point[0], point[1]]);
      }
      if (points.length) strokes.push(points);
    }
    return strokes;
  } catch {
    return [];
  }
}

export function SignaturePad({
  onChange,
}: {
  onChange: (signed: boolean, signatureData: string | null) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<readonly [number, number] | null>(null);
  const inkDistance = useRef(0);
  const hasValidInk = useRef(false);
  const strokes = useRef<SignatureStroke[]>([]);
  const activeStroke = useRef<SignatureStroke | null>(null);
  const pointCount = useRef(0);
  const [hasInk, setHasInk] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  useEffect(
    () => onChange(confirmed || (hasInk && Boolean(signatureData)), hasInk ? signatureData : null),
    [confirmed, hasInk, onChange, signatureData],
  );

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = canvas.current;
    if (!current) return [0, 0] as const;
    const bounds = current.getBoundingClientRect();
    return [
      (event.clientX - bounds.left) * (current.width / bounds.width),
      (event.clientY - bounds.top) * (current.height / bounds.height),
    ] as const;
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const current = canvas.current;
    if (!current) return;
    const [x, y] = point(event);
    current.setPointerCapture(event.pointerId);
    const context = current.getContext("2d");
    if (!context) return;
    context.beginPath();
    context.moveTo(x, y);
    drawing.current = true;
    lastPoint.current = [x, y];
    if (strokes.current.length < 40 && pointCount.current < 1_500) {
      const stroke: SignatureStroke = [[
        Math.round(x * 10) / 10,
        Math.round(y * 10) / 10,
      ]];
      strokes.current.push(stroke);
      activeStroke.current = stroke;
      pointCount.current += 1;
    } else {
      activeStroke.current = null;
    }
  };

  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canvas.current) return;
    const [x, y] = point(event);
    const context = canvas.current.getContext("2d");
    if (!context) return;
    context.lineWidth = 4;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#1f2a44";
    context.lineTo(x, y);
    context.stroke();
    if (lastPoint.current) {
      inkDistance.current += Math.hypot(x - lastPoint.current[0], y - lastPoint.current[1]);
      if (inkDistance.current >= 18) {
        hasValidInk.current = true;
        setHasInk(true);
      }
    }
    if (activeStroke.current && pointCount.current < 1_500) {
      activeStroke.current.push([
        Math.round(x * 10) / 10,
        Math.round(y * 10) / 10,
      ]);
      pointCount.current += 1;
    }
    lastPoint.current = [x, y];
  };

  const stop = () => {
    drawing.current = false;
    lastPoint.current = null;
    activeStroke.current = null;
    if (hasValidInk.current) {
      setSignatureData(JSON.stringify({
        version: 1,
        width: 700,
        height: 180,
        strokes: strokes.current,
      }));
    }
  };
  const clear = () => {
    const current = canvas.current;
    if (current) current.getContext("2d")?.clearRect(0, 0, current.width, current.height);
    inkDistance.current = 0;
    hasValidInk.current = false;
    strokes.current = [];
    activeStroke.current = null;
    pointCount.current = 0;
    lastPoint.current = null;
    setHasInk(false);
    setSignatureData(null);
  };

  return (
    <div className="signature-wrap">
      <div className="signature-canvas-wrap">
        <canvas
          ref={canvas}
          width={700}
          height={180}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={stop}
          onPointerCancel={stop}
          onPointerLeave={stop}
          aria-label="Zone de signature client"
        />
        {!hasInk && <span>Signer dans cette zone</span>}
      </div>
      <div className="signature-toolbar">
        <span>Signature du client</span>
        <button type="button" className="text-button" onClick={clear} disabled={!hasInk}>
          Effacer
        </button>
      </div>
      <label className="signature-consent">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>
          Je confirme électroniquement l’exactitude du rapport
          <small>Alternative accessible à la signature manuscrite.</small>
        </span>
      </label>
    </div>
  );
}

export function SignatureProof({
  signatureData,
  signatory,
  signedAt,
  compact = false,
}: {
  signatureData: string | null;
  signatory: string;
  signedAt: string | null;
  compact?: boolean;
}) {
  const strokes = parseSignatureData(signatureData);
  const parsedDate = signedAt ? new Date(signedAt) : null;
  const signedAtLabel = parsedDate && !Number.isNaN(parsedDate.getTime())
    ? new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsedDate)
    : "Date non disponible";

  return (
    <div className={compact ? "signature-proof compact" : "signature-proof"}>
      {strokes.length ? (
        <svg
          className="signature-preview"
          viewBox="0 0 700 180"
          role="img"
          aria-label={`Signature manuscrite de ${signatory}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {strokes.map((stroke, index) => (
            <polyline
              key={index}
              points={stroke.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      ) : (
        <span className="electronic-proof">
          <Icon name="check" size={15} /> Confirmation électronique
        </span>
      )}
      <span className="signature-proof-meta">
        <strong>{signatory}</strong>
        <small>Signé le {signedAtLabel}</small>
      </span>
    </div>
  );
}

export function AttachmentGallery({
  attachments,
  compact = false,
}: {
  attachments: ReportAttachment[];
  compact?: boolean;
}) {
  if (!attachments.length) return null;
  return (
    <div className={compact ? "attachment-gallery compact" : "attachment-gallery"}>
      {attachments.map((attachment, index) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          title={attachment.filename}
          aria-label={`Ouvrir la photo ${index + 1} : ${attachment.filename}`}
        >
          <Image
            src={attachment.url}
            alt={`Photo d’intervention ${index + 1}`}
            width={compact ? 44 : 112}
            height={compact ? 38 : 82}
            unoptimized
          />
        </a>
      ))}
      <small>{attachments.length} photo{attachments.length > 1 ? "s" : ""} enregistrée{attachments.length > 1 ? "s" : ""}</small>
    </div>
  );
}

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
