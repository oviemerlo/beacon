"use client";

import { useEffect, useRef } from "react";
import { clientFetch } from "@/helpers/client-api";

const DWELL_MS = 1000;
const FLUSH_MS = 2000;
const MAX_BATCH = 50;

const sent = new Set<string>();
const pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function queueBroadcastViews(ids: (string | null | undefined)[]) {
  for (const id of ids) {
    if (id && !sent.has(id)) pending.add(id);
  }
  if (flushTimer || pending.size === 0) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    const batch = Array.from(pending).slice(0, MAX_BATCH);
    for (const id of batch) {
      pending.delete(id);
      sent.add(id);
    }
    if (pending.size > 0) queueBroadcastViews([]);
    void clientFetch("/broadcasts/views", { method: "POST", body: JSON.stringify({ broadcast_ids: batch }) }).catch(() => {
      for (const id of batch) sent.delete(id);
    });
  }, FLUSH_MS);
}

/** Attach the returned ref to a card; its ids are queued after it stays ≥50% visible for 1s. */
export function useBroadcastViewTracking<T extends Element>(ids: (string | null | undefined)[]) {
  const ref = useRef<T | null>(null);
  const key = ids.filter(Boolean).join(",");

  useEffect(() => {
    const element = ref.current;
    if (!element || !key || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (timer == null) {
            timer = setTimeout(() => {
              timer = null;
              queueBroadcastViews(key.split(","));
            }, DWELL_MS);
          }
        } else if (timer != null) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(element);
    return () => {
      observer.disconnect();
      if (timer != null) clearTimeout(timer);
    };
  }, [key]);

  return ref;
}
