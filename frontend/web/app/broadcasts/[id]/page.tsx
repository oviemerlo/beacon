"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { reachBadgeLabel } from "@/helpers/broadcast-reach";
import { clientFetch } from "@/helpers/client-api";
import { formatBroadcastSentAt } from "@/helpers/time";
import { usePolling } from "@/helpers/usePolling";
import type { BroadcastThread, FeedBroadcast } from "@/types/api";

export default function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<BroadcastThread | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  const loadThread = useCallback(async ({ silent }: { silent: boolean }) => {
    if (!silent) {
      setLoadingThread(true);
      setThreadError(null);
    }
    try {
      const res = await clientFetch<BroadcastThread>(`/broadcasts/${id}/thread`);
      setThread(res);
    } catch {
      if (!silent) setThreadError("Couldn't load this thread.");
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, [id]);

  usePolling(loadThread, [loadThread], 5000);

  async function postReplyInFeed() {
    if (!reply.trim() || !thread) return;
    setSending(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      await clientFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          content: reply.trim(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          is_global: false,
          radius_meters: 8000,
          tag_match_mode: "any",
          tag_ids: [],
          reply_to_broadcast_id: thread.parent.id,
        }),
      });
      setReply("");
      await loadThread({ silent: true });
    } catch {
      setError("Couldn't post your reply in feed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        {loadingThread && <p className="text-parchment-500 text-sm font-mono mb-4">Loading thread…</p>}
        {threadError && <p className="text-rust-400 text-sm mb-4">{threadError}</p>}
        {thread && (
          <div className="card mb-4">
            <ThreadItem item={thread.parent} isParent />
            <div className="mt-4 border-t border-dusk-700 pt-4 flex flex-col gap-3">
              <p className="text-parchment-500 text-xs font-mono">Replies ({thread.replies.length})</p>
              {thread.replies.length === 0 ? (
                <p className="text-parchment-500 text-sm">No public replies yet.</p>
              ) : (
                thread.replies.map((item) => <ThreadItem key={item.id} item={item} />)
              )}
            </div>
          </div>
        )}
        <div className="card mb-4">
          <textarea
            className="input-field min-h-[100px] resize-none"
            placeholder="Write your public reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {error && <p className="text-rust-400 text-sm mt-2">{error}</p>}
          <button onClick={postReplyInFeed} disabled={sending || !thread} className="btn-primary w-full mt-3">
            {sending ? "Posting…" : "Reply in feed"}
          </button>
          <p className="text-parchment-500 text-xs mt-2">This creates a public broadcast reply.</p>
          <button onClick={() => router.push("/feed")} className="tag-pill mt-3">
            Back to feed
          </button>
        </div>
      </main>
    </div>
  );
}

function ThreadItem({ item, isParent = false }: { item: FeedBroadcast; isParent?: boolean }) {
  const reachLabel = reachBadgeLabel(item.is_global, item.radius_meters);
  const isLocalReach = reachLabel === "Local";
  const isGlobalReach = reachLabel === "Global";

  return (
    <div className={isParent ? "" : "border border-dusk-700 rounded-beacon p-3"}>
      <p className="text-parchment-500 text-xs">{item.sender_display_name}</p>
      <p className="text-parchment-100 mt-1">{item.content}</p>
      <div className="flex items-center gap-2 mt-2">
        <span className="text-parchment-500 text-xs font-mono">{formatBroadcastSentAt(item.created_at)}</span>
        <span
          className="tag-pill"
          style={
            isLocalReach
              ? { backgroundColor: "#7F1D1D", borderColor: "#991B1B", color: "#F5F2EA" }
              : isGlobalReach
                ? { backgroundColor: "#FFFFFF", borderColor: "#D1D5DB", color: "#111827" }
                : undefined
          }
        >
          {reachLabel}
        </span>
      </div>
    </div>
  );
}
