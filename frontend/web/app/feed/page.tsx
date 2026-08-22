"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { LocationDriftBanner } from "@/components/LocationDriftBanner";
import { promptAndSubmitReport } from "@/helpers/report-actions";
import { reachBadgeLabel } from "@/helpers/broadcast-reach";
import { clientFetch } from "@/helpers/client-api";
import { formatBroadcastSentAt } from "@/helpers/time";
import { usePolling } from "@/helpers/usePolling";
import type { FeedBroadcast, UserProfile } from "@/types/api";

export default function FeedPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async ({ silent }: { silent: boolean }) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const rows = await clientFetch<FeedBroadcast[]>("/feed/for-you");
      setBroadcasts(rows);
      await clientFetch("/feed/mark-seen", { method: "POST" });
    } catch {
      if (!silent) setError("Couldn't load your feed. Try refreshing.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clientFetch<UserProfile>("/users/me").then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    const markSeen = async () => {
      try {
        await clientFetch("/feed/mark-seen", { method: "POST" });
      } catch {
        // Keep feed rendering stable on network failures.
      }
    };
    void markSeen();
  }, []);

  usePolling(loadFeed, [loadFeed], 5000);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <LocationDriftBanner
          registeredLatitude={user?.latitude ?? null}
          registeredLongitude={user?.longitude ?? null}
          onConfirmUpdate={async (latitude, longitude) => {
            await clientFetch("/users/me", {
              method: "PATCH",
              body: JSON.stringify({ latitude, longitude }),
            });
            const refreshed = await clientFetch<UserProfile>("/users/me");
            setUser(refreshed);
          }}
        />

        {loading && <p className="text-parchment-500 font-mono text-sm">Loading nearby broadcasts…</p>}
        {error && <p className="text-rust-400 text-sm">{error}</p>}

        {!loading && !error && broadcasts.length === 0 && <EmptyState />}

        <div className="flex flex-col gap-3">
          {broadcasts.map((b) => (
            <BroadcastCard
              key={b.id}
              broadcast={b}
              currentUserId={user?.id ?? null}
              onOpenConversation={(id) => router.push(`/conversations/${id}`)}
              onBlocked={(senderId) => setBroadcasts((rows) => rows.filter((row) => row.sender_id !== senderId))}
              onRemoved={(broadcastId) => setBroadcasts((rows) => rows.filter((row) => row.id !== broadcastId))}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

function BroadcastCard({
  broadcast,
  currentUserId,
  onOpenConversation,
  onBlocked,
  onRemoved,
}: {
  broadcast: FeedBroadcast;
  currentUserId: string | null;
  onOpenConversation: (conversationId: string) => void;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
}) {
  const km = (broadcast.distance_m / 1000).toFixed(1);
  const reachLabel = reachBadgeLabel(broadcast.is_global, broadcast.radius_meters);
  const isOwn = currentUserId === broadcast.sender_id;
  const isLocalReach = reachLabel === "Local";
  const isGlobalReach = reachLabel === "Global";
  const [showPrivateComposer, setShowPrivateComposer] = useState(false);
  const [privateMessage, setPrivateMessage] = useState("");
  const [sendingPrivate, setSendingPrivate] = useState(false);

  async function sendPrivateReply() {
    const firstMessage = privateMessage.trim();
    if (!firstMessage || sendingPrivate) return;
    setSendingPrivate(true);
    try {
      const res = await clientFetch<{ conversation_id: string }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ broadcast_id: broadcast.id, first_message: firstMessage }),
      });
      setPrivateMessage("");
      setShowPrivateComposer(false);
      onOpenConversation(res.conversation_id);
    } catch {
      window.alert("Couldn't start private reply.");
    } finally {
      setSendingPrivate(false);
    }
  }

  return (
    <div className="card block hover:border-signal-500/50 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center flex-wrap gap-2 min-w-0">
          <p className="text-parchment-500 text-sm">{isOwn ? "You" : broadcast.sender_display_name}</p>
          {broadcast.tags.map((tag) => (
            <span key={tag.id} className="tag-pill">
              {tag.label}
            </span>
          ))}
        </div>
        {currentUserId && (
          <FeedCardOverflowMenu
            senderName={isOwn ? "your post" : broadcast.sender_display_name}
            actions={
              isOwn
                ? [
                    {
                      label: "Delete",
                      onSelect: async () => {
                        const confirmed = window.confirm("Delete this Echo? It will disappear from everyone's feed.");
                        if (!confirmed) return;
                        try {
                          await clientFetch(`/broadcasts/${broadcast.id}`, { method: "DELETE" });
                          onRemoved(broadcast.id);
                        } catch {
                          window.alert("Couldn't delete this Echo.");
                        }
                      },
                    },
                  ]
                : [
                    {
                      label: "Report",
                      onSelect: async () => {
                        try {
                          await promptAndSubmitReport("broadcast", broadcast.id, "this broadcast");
                          window.alert("Report submitted.");
                        } catch {
                          window.alert("Couldn't submit report.");
                        }
                      },
                    },
                    {
                      label: "Block",
                      onSelect: async () => {
                        const confirmed = window.confirm(
                          `Block ${broadcast.sender_display_name}?\n\nYou won't see their posts in your feed, including ones already here. They can still see your broadcasts.`
                        );
                        if (!confirmed) return;
                        try {
                          await clientFetch(`/blocks/${broadcast.sender_id}`, { method: "PUT" });
                          onBlocked(broadcast.sender_id);
                        } catch {
                          window.alert("Couldn't block this user.");
                        }
                      },
                    },
                    {
                      label: "Remove from my feed",
                      onSelect: async () => {
                        try {
                          await clientFetch(`/broadcasts/${broadcast.id}/hide`, { method: "PUT" });
                          onRemoved(broadcast.id);
                        } catch {
                          window.alert("Couldn't remove this Echo from your feed.");
                        }
                      },
                    },
                  ]
            }
          />
        )}
      </div>
      <p className="text-parchment-100">{broadcast.content}</p>
      <p className="text-parchment-500 text-xs font-mono mt-2">
        {formatBroadcastSentAt(broadcast.created_at)}
      </p>
      <div className="flex items-center flex-wrap gap-1.5 mt-3 text-[10px] leading-tight font-mono text-parchment-500">
        {!isOwn && <span>{km} km away</span>}
        <span
          className="feed-card-meta"
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
        {typeof broadcast.shared_tag_count === "number" && broadcast.shared_tag_count > 0 && (
          <span className="feed-card-meta tag-pill-active">{broadcast.shared_tag_count} shared tag{broadcast.shared_tag_count > 1 ? "s" : ""}</span>
        )}
        <span className="feed-card-meta tag-pill-active">
          {broadcast.reply_count ?? 0} repl{(broadcast.reply_count ?? 0) === 1 ? "y" : "ies"}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {!isOwn && (
          <>
            <Link href={`/broadcasts/${broadcast.id}`} className="feed-card-action">
              Reply in feed
            </Link>
            <button onClick={() => setShowPrivateComposer((v) => !v)} className="feed-card-action">
              Reply privately
            </button>
          </>
        )}
        <Link href={`/broadcasts/${broadcast.id}`} className="feed-card-action">
          View thread
        </Link>
      </div>
      {showPrivateComposer && !isOwn && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            className="input-field"
            placeholder="Private message"
            value={privateMessage}
            onChange={(e) => setPrivateMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void sendPrivateReply();
              }
            }}
          />
          <div className="flex gap-2">
            <button
              className="btn-primary px-4 py-2 disabled:opacity-50"
              onClick={() => void sendPrivateReply()}
              disabled={sendingPrivate || !privateMessage.trim()}
            >
              {sendingPrivate ? "Sending..." : "Send privately"}
            </button>
            <button
              className="btn-secondary px-4 py-2"
              onClick={() => {
                setShowPrivateComposer(false);
                setPrivateMessage("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeedCardOverflowMenu({
  senderName,
  actions,
}: {
  senderName: string;
  actions: { label: string; onSelect: () => Promise<void> }[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        aria-label={`More actions for ${senderName}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 w-7 items-center justify-center rounded-beacon border border-dusk-600 bg-dusk-800 text-parchment-300 hover:text-parchment-100 hover:border-parchment-500"
      >
        <span className="text-base leading-none">⋯</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-beacon border border-dusk-600 bg-dusk-800 py-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm text-parchment-100 hover:bg-dusk-700"
              onClick={async () => {
                setOpen(false);
                await action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card text-center py-10">
      <p className="font-medium">Nothing nearby yet.</p>
      <p className="text-parchment-500 text-sm mt-1">
        Broadcasts from people and businesses within your radius will show up here.
      </p>
    </div>
  );
}
