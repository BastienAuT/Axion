import { formatDate, type Intervention, type InterventionReport } from "./model";
import { parseSignatureData } from "./primitives";
import type { ReportDocument } from "./report-drafts";

function ascii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("€", "EUR")
    .replace(/[^\x20-\x7E]/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

function wrapPdfText(value: string, maxLength = 78) {
  const words = ascii(value)
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((word) =>
      Array.from(
        { length: Math.ceil(word.length / maxLength) },
        (_, index) => word.slice(index * maxLength, (index + 1) * maxLength),
      ),
    );
  if (!words.length) return [""];
  return words.reduce<string[]>((lines, word) => {
    const current = lines.at(-1);
    if (!current || current.length + word.length + 1 > maxLength) lines.push(word);
    else lines[lines.length - 1] = `${current} ${word}`;
    return lines;
  }, []);
}

function formatPdfTimestamp(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

function downloadReportPdf(item: Intervention, report?: ReportDocument) {
  const summary =
    report?.summary.trim() ||
    item.description ||
    "Diagnostic, remise en etat et controle de fonctionnement.";
  const materials = report?.materials.trim();
  const signatory = report?.signatory.trim();
  const signatureStrokes = parseSignatureData(report?.signatureData);
  const lines = [
    { text: "AXION", size: 12, gap: 28 },
    { text: "Rapport d'intervention", size: 24, gap: 38 },
    { text: item.reference, size: 11, gap: 28 },
    { text: `Intervention : ${item.title}`, size: 13, gap: 24 },
    { text: `Client : ${item.customerName} - ${item.siteName}`, size: 11, gap: 20 },
    { text: `Adresse : ${item.address}`, size: 11, gap: 20 },
    { text: `Date : ${formatDate(item.scheduledDate)} à ${item.scheduledTime}`, size: 11, gap: 20 },
    { text: `Technicien : ${item.technician}`, size: 11, gap: 28 },
    { text: "Compte-rendu", size: 14, gap: 24 },
    ...wrapPdfText(summary).map((text) => ({ text, size: 10, gap: 17 })),
    ...(materials
      ? [
          { text: "Materiel utilise", size: 14, gap: 24 },
          ...wrapPdfText(materials).map((text) => ({ text, size: 10, gap: 17 })),
        ]
      : []),
    ...(signatory ? [{ text: `Signe par : ${signatory}`, size: 11, gap: 24 }] : []),
    { text: "Rapport finalise et valide electroniquement dans Axion.", size: 9, gap: 20 },
  ];
  const pageCommands: string[][] = [[]];
  let y = 790;
  lines.forEach((line) => {
    if (y - line.gap < 54 && pageCommands.at(-1)?.length) {
      pageCommands.push([]);
      y = 790;
    }
    pageCommands.at(-1)?.push(
      `BT /F1 ${line.size} Tf 52 ${y} Td (${ascii(line.text)}) Tj ET`,
    );
    y -= line.gap;
  });
  const signedAtLabel = formatPdfTimestamp(report?.signedAt);
  if (signatory && signedAtLabel) {
    const proofCommands = [
      "BT /F1 18 Tf 52 790 Td (Preuve de signature) Tj ET",
      `BT /F1 11 Tf 52 752 Td (${ascii(`Signataire : ${signatory}`)}) Tj ET`,
      `BT /F1 10 Tf 52 730 Td (${ascii(`Valide le : ${signedAtLabel}`)}) Tj ET`,
      ...(report?.reportId
        ? [`BT /F1 9 Tf 52 710 Td (${ascii(`Identifiant : ${report.reportId}`)}) Tj ET`]
        : []),
      "0.75 0.78 0.86 RG 52 548 420 128 re S",
    ];
    if (signatureStrokes.length) {
      proofCommands.push(
        "q 1.8 w 0.12 0.16 0.27 RG 1 J 1 j",
        ...signatureStrokes.map((stroke) =>
          `${stroke
            .map(([x, pointY], index) =>
              `${(52 + x * 0.6).toFixed(1)} ${(656 - pointY * 0.6).toFixed(1)} ${index ? "l" : "m"}`,
            )
            .join(" ")} S`,
        ),
        "Q",
        "BT /F1 9 Tf 52 528 Td (Signature manuscrite enregistree avec le rapport.) Tj ET",
      );
    } else {
      proofCommands.push(
        "BT /F1 14 Tf 120 607 Td (CONFIRMATION ELECTRONIQUE) Tj ET",
        "BT /F1 9 Tf 137 582 Td (Validation accessible sans trace manuscrite) Tj ET",
      );
    }
    pageCommands.push(proofCommands);
  }
  const pageStreams = pageCommands.map((commands, index) =>
    [
      ...commands,
      `BT /F1 8 Tf 500 28 Td (Page ${index + 1} / ${pageCommands.length}) Tj ET`,
    ].join("\n"),
  );
  const pageIds = pageStreams.map((_, index) => 3 + index * 2);
  const fontId = 3 + pageStreams.length * 2;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
  ];
  pageStreams.forEach((commands, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
      `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`,
    );
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  const link = document.createElement("a");
  const url = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
  link.href = url;
  link.download = `${item.reference}-rapport.pdf`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export const downloadStoredReport = (item: Intervention, report?: InterventionReport) => {
  downloadReportPdf(
    item,
    report
      ? {
          reportId: report.id,
          summary: report.summary,
          materials: report.materials,
          signatory: report.clientName,
          signatureData: report.signatureData,
          signedAt: report.signedAt,
        }
      : undefined,
  );
};

