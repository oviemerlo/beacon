"use client";

import type { LinkPreview } from "@/types/api";

export function LinkPreviewList({ previews }: { previews?: LinkPreview[] }) {
  const rows = (previews ?? []).filter((preview) => preview.status !== "failed");
  if (!rows.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {rows.map((preview) => (
        <LinkPreviewCard key={preview.id} preview={preview} />
      ))}
    </div>
  );
}

export function LinkPreviewCard({ preview }: { preview: LinkPreview }) {
  const host = hostname(preview.normalized_url);
  const meta = preview.site_name || host;
  const title = preview.title || host || preview.normalized_url;

  if (preview.image_url) {
    return (
      <a
        href={preview.normalized_url}
        target="_blank"
        rel="noreferrer"
        className="flex overflow-hidden rounded-beacon border border-dusk-600 bg-dusk-800 hover:border-signal-500"
      >
        <div className="relative h-24 w-32 shrink-0 bg-dusk-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1 p-2.5">
          {meta && <p className="text-[10px] font-mono text-parchment-500 truncate">{meta}</p>}
          <p className="text-sm text-parchment-100 line-clamp-2">{title}</p>
          {preview.description && (
            <p className="text-xs text-parchment-500 line-clamp-2 mt-0.5">{preview.description}</p>
          )}
        </div>
      </a>
    );
  }

  return (
    <a
      href={preview.normalized_url}
      target="_blank"
      rel="noreferrer"
      className="block overflow-hidden rounded-beacon border border-dusk-600 bg-dusk-800 px-3 py-2 hover:border-signal-500"
    >
      <p className="text-[10px] font-mono text-parchment-500 truncate inline-flex items-center gap-1.5">
        {preview.favicon_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview.favicon_url} alt="" className="h-3 w-3 rounded-sm" />
        ) : null}
        {meta}
      </p>
      <p className="text-sm text-parchment-100 line-clamp-2">{title}</p>
      {preview.description && (
        <p className="text-xs text-parchment-500 line-clamp-2 mt-0.5">{preview.description}</p>
      )}
    </a>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
