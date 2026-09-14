"use client";

import { useEffect, useRef, useState } from "react";
import {
  ATTACHMENT_ACCEPT,
  isAllowedAttachment,
  isImageAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
} from "@/helpers/uploads";

export function BroadcastAttachments({
  files,
  onChange,
  onError,
  compact = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  onError: (message: string) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) {
        onError(`You can attach up to ${MAX_ATTACHMENTS} files.`);
        break;
      }
      if (!isAllowedAttachment(file.type, file.name)) {
        onError("Use a JPEG, PNG, PDF, DOCX, or XLSX file.");
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        onError("Attachments must be 20 MB or smaller.");
        continue;
      }
      if (next.some((existing) => existing.name === file.name && existing.size === file.size)) continue;
      next.push(file);
    }
    onChange(next);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={compact ? "" : "mb-8"}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Attach a file"
          disabled={files.length >= MAX_ATTACHMENTS}
          onClick={() => inputRef.current?.click()}
          className="flex h-9 w-9 items-center justify-center rounded-beacon border border-dusk-600 bg-dusk-800 text-parchment-300 hover:text-parchment-100 hover:border-parchment-500"
        >
          <PaperclipIcon />
        </button>
        {!compact && (
          <p className="text-parchment-500 text-xs font-mono">JPEG, PNG, PDF, DOCX, or XLSX — 20 MB max</p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />
      {files.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {files.map((file) => (
            <li key={`${file.name}-${file.size}`} className="flex items-center gap-3 text-sm">
              <AttachmentThumb file={file} />
              <span className="min-w-0 flex-1 truncate text-parchment-300 font-mono text-xs">{file.name}</span>
              <button type="button" className="feed-card-action shrink-0" onClick={() => onChange(files.filter((item) => item !== file))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AttachmentThumb({ file }: { file: File }) {
  if (isImageAttachment(file.type, file.name)) {
    return <ImageThumb file={file} />;
  }
  return (
    <div
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-beacon border border-dusk-600 bg-dusk-800"
      aria-hidden
    >
      <FileTypeIcon type={file.type} name={file.name} />
    </div>
  );
}

function ImageThumb({ file }: { file: File }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!src) {
    return <div className="h-11 w-11 shrink-0 rounded-beacon border border-dusk-600 bg-dusk-800" aria-hidden />;
  }

  return (
    <img
      src={src}
      alt=""
      className="h-11 w-11 shrink-0 rounded-beacon border border-dusk-600 bg-dusk-800 object-cover"
    />
  );
}

function FileTypeIcon({ type, name }: { type: string; name: string }) {
  const kind = fileKind(type, name);
  const color = kind === "PDF" ? "#D9714E" : kind === "DOCX" ? "#F2B25C" : kind === "XLSX" ? "#5B9A7F" : "#D9D5C9";
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 3.5h7.2L19 8.5V20a1.5 1.5 0 01-1.5 1.5h-10A1.5 1.5 0 016 20V5a1.5 1.5 0 011.5-1.5z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M14.2 3.5V8h4.8" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <text x="12" y="17" textAnchor="middle" fill={color} fontSize="5.5" fontFamily="ui-monospace, monospace" fontWeight="700">
        {kind === "FILE" ? "FILE" : kind.slice(0, 3)}
      </text>
    </svg>
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

function PaperclipIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21.44 11.05l-8.49 8.49a6 6 0 01-8.49-8.49l8.49-8.49a4 4 0 015.66 5.66l-8.49 8.49a2 2 0 01-2.83-2.83l8.49-8.49"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
