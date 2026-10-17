import { useCallback, useEffect, useRef } from "react";
import type { View, ViewToken } from "react-native";
import { apiFetch } from "./api";

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
    void apiFetch("/broadcasts/views", { method: "POST", body: JSON.stringify({ broadcast_ids: batch }) }).catch(() => {
      for (const id of batch) sent.delete(id);
    });
  }, FLUSH_MS);
}

export const broadcastViewabilityConfig = { itemVisiblePercentThreshold: 50, minimumViewTime: DWELL_MS };

/** FlatList wiring: pass the result straight to `onViewableItemsChanged` (it must stay referentially stable). */
export function useFlatListBroadcastViews<T>(idsForItem: (item: T) => (string | null | undefined)[]) {
  const idsRef = useRef(idsForItem);
  idsRef.current = idsForItem;
  return useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const token of viewableItems) {
      if (token.isViewable && token.item) queueBroadcastViews(idsRef.current(token.item as T));
    }
  }).current;
}

/** ScrollView wiring for screens that render items with `.map` instead of a FlatList. */
export function useScrollViewBroadcastViews() {
  const viewportRef = useRef<View>(null);
  const nodes = useRef(new Map<string, View>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const lastCheck = useRef(0);

  const check = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.measureInWindow((_vx, viewTop, _vw, viewHeight) => {
      const viewBottom = viewTop + viewHeight;
      nodes.current.forEach((node, id) => {
        node.measureInWindow((_x, y, _w, height) => {
          if (height <= 0) return;
          const visible = Math.max(0, Math.min(viewBottom, y + height) - Math.max(viewTop, y));
          const timer = timers.current.get(id);
          if (visible / height >= 0.5) {
            if (!timer) {
              timers.current.set(
                id,
                setTimeout(() => {
                  timers.current.delete(id);
                  queueBroadcastViews([id]);
                }, DWELL_MS)
              );
            }
          } else if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
          }
        });
      });
    });
  }, []);

  const onScroll = useCallback(() => {
    const now = Date.now();
    if (now - lastCheck.current < 200) return;
    lastCheck.current = now;
    check();
  }, [check]);

  const register = useCallback(
    (id: string) => (node: View | null) => {
      if (node) nodes.current.set(id, node);
      else nodes.current.delete(id);
    },
    []
  );

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => pendingTimers.forEach(clearTimeout);
  }, []);

  return { viewportRef, register, check, onScroll };
}
