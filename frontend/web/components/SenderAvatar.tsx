"use client";

import { useEffect, useState } from "react";
import { getUploadUrl } from "@/helpers/uploads";

export function SenderAvatar({
  fileId,
  name,
  className,
}: {
  fileId?: string | null;
  name?: string | null;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    getUploadUrl(fileId)
      .then((next) => {
        if (!cancelled) setUrl(next.url);
      })
      .catch(() => {
        if (!cancelled) setUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  const initial = (name ?? "?").trim().charAt(0).toUpperCase() || "?";
  const frame = className ?? "h-6 w-6 shrink-0 rounded-full border border-dusk-600";

  if (!fileId || !url) {
    return (
      <span className={`${frame} inline-flex items-center justify-center bg-dusk-800 text-[10px] font-medium text-parchment-300`}>
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${frame} object-cover`} />
  );
}
