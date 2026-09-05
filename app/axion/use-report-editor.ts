"use client";

import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import {
  isIntervention,
  isInterventionReport,
  isReportAttachment,
  type Intervention,
  type InterventionReport,
  type Status,
} from "./model";
import {
  defaultReport,
  initialReportFor,
  readReportDraft,
  writeReportDraft,
  removeReportDraft,
} from "./report-drafts";
import { downloadStoredReport } from "./report-pdf";
import { readApiPayload } from "./api-response";
import type { AxionData } from "./use-axion-data";
import type { Notify } from "./ui-types";

type Options = Pick<AxionData, "online" | "setApiAvailable" | "refreshInterventions" | "setItems" | "setReports" | "setAttachments"> & {
  selected: Intervention | null;
  setSelected: Dispatch<SetStateAction<Intervention | null>>;
  setSaving: Dispatch<SetStateAction<boolean>>;
  notify: Notify;
  updateStatus: (id: string, status: Status) => Promise<boolean>;
};

export function useReportEditor({ online, setApiAvailable, refreshInterventions, setItems, setReports, setAttachments, selected, setSelected, setSaving, notify, updateStatus }: Options) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSigned, setReportSigned] = useState(false);
  const [reportSignature, setReportSignature] = useState<string | null>(null);
  const [reportDraft, setReportDraft] = useState(defaultReport);
  const [photos, setPhotos] = useState<File[]>([]);

  const handleSignatureChange = useCallback((signed: boolean, signatureData: string | null) => {
    setReportSigned(signed);
    setReportSignature(signatureData);
  }, []);

  useEffect(() => {
    if (!reportOpen || !selected) return;
    const timer = window.setTimeout(() => {
      writeReportDraft(selected.id, reportDraft);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [reportDraft, reportOpen, selected]);

  const openReportFor = (item: Intervention) => {
    setSelected(item);
    setReportDraft(readReportDraft(item.id) ?? initialReportFor(item));
    setReportSigned(false);
    setReportSignature(null);
    setPhotos([]);
    setReportOpen(true);
  };

  const openReport = () => {
    if (selected) openReportFor(selected);
  };

  const selectReportPhotos = (files: FileList | null) => {
    const selectedFiles = Array.from(files ?? []);
    if (selectedFiles.length > 4) {
      setPhotos([]);
      notify("Vous pouvez joindre jusqu’à 4 photos par envoi.", "error");
      return;
    }
    const invalid = selectedFiles.find(
      (file) => !["image/jpeg", "image/png"].includes(file.type) || file.size <= 0 || file.size > 2 * 1024 * 1024,
    );
    if (invalid) {
      setPhotos([]);
      notify("Chaque photo doit être un JPEG ou PNG de 2 Mo maximum.", "error");
      return;
    }
    setPhotos(selectedFiles);
  };

  const saveReportDraft = () => {
    if (!selected) return;
    const stored = writeReportDraft(selected.id, reportDraft);
    if (!stored) {
      notify("Le brouillon n’a pas pu être enregistré sur cet appareil.", "error");
      return;
    }
    setReportOpen(false);
    notify("Brouillon enregistré sur cet appareil.", "info");
  };

  const finalizeReport = async () => {
    if (!selected || !reportSigned) return;
    if (!reportDraft.summary.trim() || !reportDraft.signatory.trim()) {
      notify("Le compte-rendu et le nom du signataire sont obligatoires.", "error");
      return;
    }
    if (!online) {
      notify("Une connexion est requise pour finaliser le rapport.", "error");
      return;
    }

    setSaving(true);
    let completed: Intervention | null = null;
    let savedReport: InterventionReport | null = null;
    let responseStatus = 0;
    try {
      if (selected.id.startsWith("demo-")) {
        const success = await updateStatus(selected.id, "completed");
        if (!success) return;
        completed = {
          ...selected,
          status: "completed",
          description: reportDraft.summary.trim(),
        };
        const signedAt = new Date().toISOString();
        savedReport = {
          id: `demo-report-${selected.id}`,
          interventionId: selected.id,
          summary: reportDraft.summary.trim(),
          materials: reportDraft.materials.trim(),
          clientName: reportDraft.signatory.trim(),
          signedAt,
          signatureData: reportSignature,
          createdAt: signedAt,
          demo: true,
        };
        setReports((current) => [
          savedReport as InterventionReport,
          ...current.filter((report) => report.interventionId !== selected.id),
        ]);
      } else {
        const response = await fetch("/api/reports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            interventionId: selected.id,
            summary: reportDraft.summary.trim(),
            materials: reportDraft.materials.trim(),
            clientName: reportDraft.signatory.trim(),
            ...(reportSignature ? { signatureData: reportSignature } : {}),
          }),
        });
        responseStatus = response.status;
        const payload = await readApiPayload(response);
        if (
          !response.ok ||
          !isIntervention(payload.intervention) ||
          !isInterventionReport(payload.report)
        ) {
          if (response.status === 404 || response.status === 409) {
            void refreshInterventions(undefined, false);
          }
          throw new Error(payload.error ?? "Finalisation impossible");
        }
        completed = {
          ...(payload.intervention as Intervention),
          description: reportDraft.summary.trim(),
        };
        savedReport = payload.report as InterventionReport;
        setItems((current) =>
          current.map((item) => (item.id === completed?.id ? completed : item)),
        );
        setReports((current) => [
          payload.report as InterventionReport,
          ...current.filter(
            (report) => report.interventionId !== (payload.report as InterventionReport).interventionId,
          ),
        ]);
        setApiAvailable(true);
      }

      let photoUploadError: string | null = null;
      if (photos.length && savedReport && !selected.id.startsWith("demo-")) {
        try {
          const formData = new FormData();
          formData.set("interventionId", selected.id);
          formData.set("reportId", savedReport.id);
          photos.forEach((photo) => formData.append("photos", photo, photo.name));
          const photoResponse = await fetch("/api/attachments", { method: "POST", body: formData });
          const photoPayload = await readApiPayload(photoResponse);
          const uploaded = Array.isArray(photoPayload.attachments)
            ? photoPayload.attachments.filter(isReportAttachment)
            : [];
          if (!photoResponse.ok || uploaded.length !== photos.length) {
            throw new Error(photoPayload.error ?? "Enregistrement des photos impossible");
          }
          setAttachments((current) => [...current, ...uploaded]);
        } catch (error) {
          photoUploadError = error instanceof Error ? error.message : "Enregistrement des photos impossible";
        }
      }

      removeReportDraft(selected.id);
      setReportOpen(false);
      setSelected(null);
      downloadStoredReport(completed, savedReport);
      notify(
        photoUploadError
          ? `Rapport enregistré, mais les photos n’ont pas été jointes : ${photoUploadError}`
          : photos.length
            ? `Rapport et ${photos.length} photo${photos.length > 1 ? "s" : ""} enregistrés. Le PDF a été téléchargé.`
            : "Rapport finalisé et enregistré. Le PDF a été téléchargé.",
        photoUploadError ? "error" : "success",
      );
    } catch (error) {
      setApiAvailable(responseStatus > 0 && responseStatus < 500);
      notify(error instanceof Error ? error.message : "La finalisation a échoué.", "error");
    } finally {
      setSaving(false);
    }
  };

  return { reportOpen, setReportOpen, reportSigned, reportDraft, setReportDraft, photos, handleSignatureChange, openReportFor, openReport, selectReportPhotos, saveReportDraft, finalizeReport };
}
