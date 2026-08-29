"use client";

import { useRef } from "react";
import {
  ATTACHMENT_ACCEPT,
  ATTACHMENT_LOCKED_MESSAGE,
  isAllowedAttachment,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
} from "@/helpers/uploads";

export function BroadcastAttachments({
  files,
  onChange,
  canAttach,
  onLocked,
  onError,
  compact = false,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  canAttach: boolean;
  onLocked: () => void;
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
          onClick={() => {
            if (!canAttach) {
              onLocked();
              return;
            }
            inputRef.current?.click();
          }}
          className={`flex h-9 w-9 items-center justify-center rounded-beacon border border-dusk-600 bg-dusk-800 text-parchment-300 hover:text-parchment-100 hover:border-parchment-500 ${!canAttach ? "opacity-40" : ""}`}
        >
          <PaperclipIcon />
        </button>
        {!compact && (
          <p className="text-parchment-500 text-xs font-mono">
            {canAttach ? "JPEG, PNG, PDF, DOCX, or XLSX — 20 MB max" : ATTACHMENT_LOCKED_MESSAGE}
          </p>
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
            <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-parchment-300 font-mono text-xs">{file.name}</span>
              <button type="button" className="feed-card-action" onClick={() => onChange(files.filter((item) => item !== file))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
