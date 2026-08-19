"use client";

import { useCallback, useEffect, useState } from "react";
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

type Tab = "for-you" | "opt-in";

export default function FeedPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("for-you");
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
      const rows = await clientFetch<FeedBroadcast[]>(`/feed/${tab}`);
      setBroadcasts(rows);
    } catch {
      if (!silent) setError("Couldn't load your feed. Try refreshing.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    clientFetch<UserProfile>("/users/me").then(setUser).catch(() => setUser(null));
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
        <div className="flex gap-2 mb-6">
          <TabButton active={tab === "for-you"} onClick={() => setTab("for-you")}>
            For You
          </TabButton>
          <TabButton active={tab === "opt-in"} onClick={() => setTab("opt-in")}>
            Opt-in
          </TabButton>
        </div>

        {loading && <p className="text-parchment-500 font-mono text-sm">Loading nearby broadcasts…</p>}
        {error && <p className="text-rust-400 text-sm">{error}</p>}

        {!loading && !error && broadcasts.length === 0 && (
          <EmptyState tab={tab} />
        )}

        <div className="flex flex-col gap-3">
          {broadcasts.map((b) => (
            <BroadcastCard key={b.id} broadcast={b} currentUserId={user?.id ?? null} onOpenConversation={(id) => router.push(`/conversations/${id}`)} />
          ))}
        </div>
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-beacon text-sm font-medium transition-colors ${
        active ? "bg-signal-500 text-dusk-950" : "bg-dusk-800 text-parchment-500 hover:text-parchment-100"
      }`}
    >
      {children}
    </button>
  );
}

function BroadcastCard({
  broadcast,
  currentUserId,
  onOpenConversation,
}: {
  broadcast: FeedBroadcast;
  currentUserId: string | null;
  onOpenConversation: (conversationId: string) => void;
}) {
  const km = (broadcast.distance_m / 1000).toFixed(1);
  const reachLabel = reachBadgeLabel(broadcast.is_global, broadcast.radius_meters);
  const isOwn = currentUserId === broadcast.sender_id;
  const isLocalReach = reachLabel === "Local";
  const isGlobalReach = reachLabel === "Global";

  async function startPrivateReply() {
    const firstMessage = window.prompt("Private message");
    if (!firstMessage || !firstMessage.trim()) return;
    try {
      const res = await clientFetch<{ conversation_id: string }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ broadcast_id: broadcast.id, first_message: firstMessage.trim() }),
      });
      onOpenConversation(res.conversation_id);
    } catch {
      window.alert("Couldn't start private reply.");
    }
  }

  return (
    <div className="card block hover:border-signal-500/50 transition-colors">
      <p className="text-parchment-500 text-sm mb-2">{broadcast.sender_display_name}</p>
      <p className="text-parchment-100">{broadcast.content}</p>
      <p className="text-parchment-500 text-xs font-mono mt-2">
        {formatBroadcastSentAt(broadcast.created_at)}
      </p>
      {broadcast.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {broadcast.tags.map((tag) => (
            <span key={tag.id} className="tag-pill">
              {tag.label}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 mt-3 text-xs font-mono text-parchment-500">
        {!isOwn && <span>{km} km away</span>}
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
        {typeof broadcast.shared_tag_count === "number" && broadcast.shared_tag_count > 0 && (
          <span className="tag-pill tag-pill-active">{broadcast.shared_tag_count} shared tag{broadcast.shared_tag_count > 1 ? "s" : ""}</span>
        )}
        <span className="tag-pill tag-pill-active">
          {broadcast.reply_count ?? 0} repl{(broadcast.reply_count ?? 0) === 1 ? "y" : "ies"}
        </span>
      </div>
      <div className="flex gap-2 mt-3">
        {!isOwn && (
          <>
            <Link href={`/broadcasts/${broadcast.id}`} className="tag-pill">
              Reply in feed
            </Link>
            <button onClick={startPrivateReply} className="tag-pill">
              Reply privately
            </button>
          </>
        )}
        <Link href={`/broadcasts/${broadcast.id}`} className="tag-pill">
          View thread
        </Link>
        {!isOwn && (
          <button
            onClick={async () => {
              try {
                await promptAndSubmitReport("broadcast", broadcast.id, "this broadcast");
                window.alert("Report submitted.");
              } catch {
                window.alert("Couldn't submit report.");
              }
            }}
            className="tag-pill"
          >
            Report
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="card text-center py-10">
      {tab === "for-you" ? (
        <>
          <p className="font-medium">Nothing nearby yet.</p>
          <p className="text-parchment-500 text-sm mt-1">
            Broadcasts from people and businesses within your radius will show up here.
          </p>
        </>
      ) : (
        <>
          <p className="font-medium">You haven't followed any tags yet.</p>
          <p className="text-parchment-500 text-sm mt-1">
            Follow a nationality or hobby tag from your profile to see a dedicated feed for it.
          </p>
        </>
      )}
    </div>
  );
}
