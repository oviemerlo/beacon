"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { BroadcastAttachments } from "@/components/BroadcastAttachments";
import { EchoMediaLayout } from "@/components/EchoAttachments";
import { SenderAvatar } from "@/components/SenderAvatar";
import { VerifiedMark } from "@/components/VerifiedMark";
import { reachBadgeColors, reachBadgeLabel } from "@/helpers/broadcast-reach";
import { clientFetch } from "@/helpers/client-api";
import { splitMentionParts } from "@/helpers/mentions";
import { echoAudienceLabels } from "@/helpers/tags";
import { formatBroadcastSentAt } from "@/helpers/time";
import { canAttachFiles, REPLY_MEDIA_LOCKED_MESSAGE, uploadBroadcastAttachment } from "@/helpers/uploads";
import { usePolling } from "@/helpers/usePolling";
import type { BroadcastThread, FeedBroadcast, UserProfile } from "@/types/api";

export default function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<BroadcastThread | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [reply, setReply] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  const canAttach = canAttachFiles(Boolean(me?.is_verified), Boolean(me?.is_admin));

  useEffect(() => {
    clientFetch<UserProfile>("/users/me").then(setMe).catch(() => setMe(null));
  }, []);

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
      const body = reply.trim();
      const created = await clientFetch<{ id: string; created_at: string }>("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          content: body,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          is_global: thread.parent.is_global,
          radius_meters: thread.parent.is_global ? undefined : thread.parent.radius_meters ?? 8000,
          tag_match_mode: "any",
          tag_ids: [],
          reply_to_broadcast_id: thread.parent.id,
        }),
      });
      try {
        for (const file of attachments) {
          await uploadBroadcastAttachment(created.id, file);
        }
      } catch {
        // Reply is already live.
      }
      setReply("");
      setAttachments([]);
      setThread((current) => {
        if (!current) return current;
        if (current.replies.some((item) => item.id === created.id)) return current;
        return {
          ...current,
          replies: [
            {
              ...current.parent,
              id: created.id,
              sender_id: me?.id ?? "",
              sender_display_name: "You",
              sender_avatar_file_id: me?.avatar_file_id ?? null,
              content: body,
              distance_m: 0,
              created_at: created.created_at,
              reply_count: 0,
              attachments: [],
            },
            ...current.replies,
          ],
        };
      });
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
          <div className="mt-3">
            <BroadcastAttachments
              files={attachments}
              onChange={setAttachments}
              canAttach={canAttach}
              compact
              onLocked={() => setError(REPLY_MEDIA_LOCKED_MESSAGE)}
              onError={setError}
            />
          </div>
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
  const reachColors = reachBadgeColors(item.is_global, item.radius_meters);
  const audienceLabels = echoAudienceLabels(item.tags, item.course_codes, item.course_code);

  return (
    <div className={isParent ? "" : "border border-dusk-700 rounded-beacon p-3"}>
      <EchoMediaLayout attachments={item.attachments}>
        <div className="flex items-center flex-wrap gap-x-5 gap-y-2">
          <p className="text-parchment-500 text-xs inline-flex items-center gap-1.5">
            <SenderAvatar fileId={item.sender_avatar_file_id} name={item.sender_display_name} />
            {item.sender_display_name}
            <VerifiedMark verified={item.sender_is_verified} />
          </p>
          {isParent &&
            audienceLabels.map((label) => (
              <span key={label} className="tag-pill">
                {label}
              </span>
            ))}
        </div>
        <p className="text-parchment-100 mt-1">
          {splitMentionParts(item.content).map((part, index) =>
            part.mention ? (
              <span key={`${item.id}-${index}`} className="mention-text">
                {part.text}
              </span>
            ) : (
              <span key={`${item.id}-${index}`}>{part.text}</span>
            )
          )}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-parchment-500 text-xs font-mono">{formatBroadcastSentAt(item.created_at)}</span>
          {isParent && (
            <span className="tag-pill" style={reachColors}>
              {reachLabel}
            </span>
          )}
        </div>
      </EchoMediaLayout>
    </div>
  );
}
