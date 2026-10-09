"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Icon } from "../icons";

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

