import { seedClients, type Intervention } from "./model";

export type ReportDraft = { summary: string; materials: string; signatory: string };
export type ReportDocument = ReportDraft & {
  reportId?: string;
  signatureData?: string | null;
  signedAt?: string | null;
};

export const defaultReport: ReportDraft = {
  summary: "",
  materials: "",
  signatory: "",
};

export function initialReportFor(item: Intervention): ReportDraft {
  return {
    ...defaultReport,
    signatory:
      seedClients.find((client) => client.name === item.customerName)?.contact ?? "",
  };
}

function reportDraftKey(id: string) {
  return `axion:demo:report-draft:${id}`;
}

export function readReportDraft(id: string): ReportDraft | null {
  try {
    const raw = window.localStorage.getItem(reportDraftKey(id));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<ReportDraft>;
    if (
      typeof value.summary !== "string" ||
      typeof value.materials !== "string" ||
      typeof value.signatory !== "string"
    ) {
      return null;
    }
    return value as ReportDraft;
  } catch {
    return null;
  }
}

export function writeReportDraft(id: string, value: ReportDraft) {
  try {
    window.localStorage.setItem(reportDraftKey(id), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeReportDraft(id: string) {
  try {
    window.localStorage.removeItem(reportDraftKey(id));
  } catch {
    // Storage may be unavailable in private or restricted browser contexts.
  }
}

