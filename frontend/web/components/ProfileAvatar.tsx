"use client";

import { useEffect, useRef, useState } from "react";
import { getUploadUrl, uploadAvatar, waitForUploadUrl } from "@/helpers/uploads";

const ACCEPT = "image/jpeg,image/png";
const MAX_BYTES = 10 * 1024 * 1024;

export function ProfileAvatar({
  fileId,
  scanStatus,
}: {
  fileId?: string | null;
  scanStatus?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    const load = scanStatus === "pending" ? waitForUploadUrl(fileId) : getUploadUrl(fileId);
    load
      .then((next) => {
        if (!cancelled) setUrl(next);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId, scanStatus]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setError("Use a JPEG or PNG photo.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Photo must be 10 MB or smaller.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploaded = await uploadAvatar(file);
      const nextUrl = await waitForUploadUrl(uploaded.file_id);
      setUrl(nextUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative h-16 w-16 overflow-hidden rounded-full border border-dusk-600 bg-dusk-800 disabled:opacity-50"
        aria-label="Change profile photo"
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xl text-parchment-500">+</span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-dusk-950/70 text-[10px] font-mono text-parchment-100">
            …
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
      <p className="text-[10px] font-mono text-parchment-500">{busy ? "Uploading…" : "Change photo"}</p>
      {error && <p className="text-xs text-rust-400 max-w-[10rem] text-right">{error}</p>}
    </div>
  );
}
