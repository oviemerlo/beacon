"use client";

import { useEffect, useRef, useState } from "react";
import { echoPreview } from "@/helpers/time";
import { echoShareTitle, echoShareUrl, stripUrls } from "@/helpers/share";

export function ShareButton({
  broadcastId,
  senderName,
  content,
  variant = "action",
  className,
}: {
  broadcastId: string;
  senderName: string;
  content: string;
  variant?: "icon" | "action";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const timeout = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  async function share() {
    const url = echoShareUrl(broadcastId, window.location.origin);
    const title = echoShareTitle(senderName);
    const previewText = stripUrls(content);
    const text = previewText ? echoPreview(previewText) : `${senderName} shared an Echo`;
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    setOpen((value) => !value);
  }

  const url = typeof window === "undefined" ? "" : echoShareUrl(broadcastId, window.location.origin);
  const previewText = stripUrls(content);
  const text = previewText ? echoPreview(previewText) : `${senderName} shared an Echo`;

  return (
    <div className="relative flex shrink-0" ref={menuRef}>
      <button
        type="button"
        aria-label="Share this Echo"
        aria-expanded={open}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void share();
        }}
        className={
          variant === "action"
            ? `${className ?? "feed-card-action"} appearance-none`
            : "flex h-7 w-7 items-center justify-center rounded-beacon border border-dusk-600 bg-dusk-800 text-parchment-300 hover:text-parchment-100 hover:border-parchment-500"
        }
      >
        {variant === "action" ? "Share" : <ShareGlyph />}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-beacon border border-dusk-600 bg-dusk-800 py-1 shadow-lg">
          <ShareMenuLink href={`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`}>
            Share on X
          </ShareMenuLink>
          <ShareMenuLink href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}>
            Share on Facebook
          </ShareMenuLink>
          <ShareMenuLink href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}>
            Share on WhatsApp
          </ShareMenuLink>
          <ShareMenuLink href={`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`}>
            Share on Telegram
          </ShareMenuLink>
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left text-sm text-parchment-100 hover:bg-dusk-700"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setOpen(false);
              } catch {
                window.prompt("Copy this link", url);
              }
            }}
          >
            Copy link
          </button>
        </div>
      )}
      {copied && (
        <p className="absolute right-0 top-full z-30 mt-1 rounded-beacon border border-dusk-600 bg-dusk-800 px-2.5 py-1 text-[11px] font-mono text-signal-400 shadow-lg">
          Copied
        </p>
      )}
    </div>
  );
}

function ShareMenuLink({ href, children }: { href: string; children: string }) {
  return (
    <button
      type="button"
      className="block w-full px-3 py-1.5 text-left text-sm text-parchment-100 hover:bg-dusk-700"
      onClick={() => {
        window.open(href, "_blank", "noopener,noreferrer");
      }}
    >
      {children}
    </button>
  );
}

function ShareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 5l7 7-7 7M21 12H9M9 5H6a2 2 0 00-2 2v10a2 2 0 002 2h3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
