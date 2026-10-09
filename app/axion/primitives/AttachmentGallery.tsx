"use client";

import Image from "next/image";
import type { ReportAttachment } from "../model";

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

