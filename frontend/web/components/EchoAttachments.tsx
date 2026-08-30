"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getUploadUrl, isImageAttachment } from "@/helpers/uploads";
import type { BroadcastAttachment } from "@/types/api";

export function EchoMediaLayout({
  attachments,
  children,
}: {
  attachments?: BroadcastAttachment[];
  children: ReactNode;
}) {
  if (!attachments?.length) return children;
  return (
    <div className="flex items-stretch gap-3">
      <div className="min-w-0 flex-1 flex flex-col">{children}</div>
      <div className="w-[42%] max-w-[11.5rem] shrink-0">
        <EchoAttachments attachments={attachments} />
      </div>
    </div>
  );
}

export function EchoAttachments({ attachments }: { attachments?: BroadcastAttachment[] }) {
  if (!attachments?.length) return null;
  const many = attachments.length > 1;
  return (
    <div
      className={`aspect-square w-full overflow-hidden rounded-beacon border border-dusk-600 bg-dusk-800 grid gap-px ${
        many ? "grid-cols-2" : "grid-cols-1"
      } ${attachments.length > 2 ? "grid-rows-2" : ""}`}
    >
      {attachments.map((file) => (
        <AttachmentTile key={file.file_id} file={file} />
      ))}
    </div>
  );
}

function AttachmentTile({ file }: { file: BroadcastAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const image = isImageAttachment(file.content_type, file.original_filename);

  useEffect(() => {
    let cancelled = false;
    getUploadUrl(file.file_id)
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [file.file_id]);

  const className = "relative block h-full w-full bg-dusk-800";

  if (image && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={file.original_filename} className="absolute inset-0 h-full w-full object-contain" />
      </a>
    );
  }

  const inner = (
    <span className="flex h-full flex-col items-start justify-end gap-1 p-3">
      <span className="rounded-beacon border border-dusk-600 bg-dusk-900 px-1.5 py-0.5 text-[10px] font-mono text-parchment-300">
        {fileKind(file.content_type, file.original_filename)}
      </span>
      <span className="line-clamp-2 break-all text-xs font-mono text-parchment-100">{file.original_filename}</span>
    </span>
  );

  if (!url) return <span className={className}>{inner}</span>;

  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${className} hover:bg-dusk-700`}>
      {inner}
    </a>
  );
}

function fileKind(contentType: string, name: string): string {
  const ext = name.split(".").pop()?.toUpperCase() ?? "";
  if (contentType.includes("pdf") || ext === "PDF") return "PDF";
  if (contentType.includes("word") || ext === "DOCX") return "DOCX";
  if (contentType.includes("sheet") || ext === "XLSX") return "XLSX";
  if (ext) return ext;
  return "FILE";
}
