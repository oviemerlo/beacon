"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getUploadUrl, isImageAttachment } from "@/helpers/uploads";
import type { BroadcastAttachment } from "@/types/api";

export function EchoMediaLayout({
  attachments,
  corner,
  children,
}: {
  attachments?: BroadcastAttachment[];
  corner?: ReactNode;
  children: ReactNode;
}) {
  const count = attachments?.length ?? 0;
  const railMedia = count === 1;
  const stripMedia = count > 1;
  if (count === 0 && !corner) return children;
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {corner || railMedia ? (
          <div className={`shrink-0 flex flex-col items-end gap-2 ${railMedia ? "w-[7.5rem]" : ""}`}>
            {corner}
            {railMedia ? <EchoAttachments attachments={attachments} /> : null}
          </div>
        ) : null}
      </div>
      {stripMedia ? <EchoAttachments attachments={attachments} /> : null}
    </div>
  );
}

export function EchoAttachments({ attachments }: { attachments?: BroadcastAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
      {attachments.map((file) => (
        <AttachmentTile key={file.file_id} file={file} />
      ))}
    </div>
  );
}

function AttachmentTile({ file }: { file: BroadcastAttachment }) {
  const [url, setUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const image = isImageAttachment(file.content_type, file.original_filename);

  useEffect(() => {
    let cancelled = false;
    getUploadUrl(file.file_id)
      .then((next) => {
        if (!cancelled) {
          setUrl(next.url);
          setThumbnailUrl(next.thumbnail_url);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUrl(null);
          setThumbnailUrl(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [file.file_id, file.has_thumbnail]);

  const className =
    "relative block h-[7.5rem] w-[7.5rem] shrink-0 overflow-hidden rounded-beacon border border-dusk-600 bg-dusk-800";

  if (image && url) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={file.original_filename} className="absolute inset-0 h-full w-full object-contain" />
      </a>
    );
  }

  if (file.has_thumbnail && thumbnailUrl) {
    const tile = (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnailUrl} alt={file.original_filename} className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute left-2 top-2 rounded-beacon border border-dusk-600 bg-dusk-900 px-1.5 py-0.5 text-[10px] font-mono text-parchment-300">
          {fileKind(file.content_type, file.original_filename)}
        </span>
      </>
    );
    if (!url) return <span className={className}>{tile}</span>;
    return (
      <a href={url} target="_blank" rel="noreferrer" className={className}>
        {tile}
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
