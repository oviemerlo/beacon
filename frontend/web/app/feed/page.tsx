"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { LocationDriftBanner } from "@/components/LocationDriftBanner";
import { clientFetch } from "@/lib/client-api";
import type { FeedBroadcast, UserProfile } from "@/types/api";

type Tab = "for-you" | "opt-in";

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>("for-you");
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<UserProfile>("/users/me").then(setUser).catch(() => setUser(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    clientFetch<FeedBroadcast[]>(`/feed/${tab}`)
      .then(setBroadcasts)
      .catch(() => setError("Couldn't load your feed. Try refreshing."))
      .finally(() => setLoading(false));
  }, [tab]);

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
            <BroadcastCard key={b.id} broadcast={b} />
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

function BroadcastCard({ broadcast }: { broadcast: FeedBroadcast }) {
  const km = (broadcast.distance_m / 1000).toFixed(1);
  return (
    <Link href={`/broadcasts/${broadcast.id}`} className="card block hover:border-signal-500/50 transition-colors">
      <p className="text-parchment-100">{broadcast.content}</p>
      <div className="flex items-center gap-3 mt-3 text-xs font-mono text-parchment-500">
        <span>{km} km away</span>
        {typeof broadcast.shared_tag_count === "number" && broadcast.shared_tag_count > 0 && (
          <span className="tag-pill tag-pill-active">{broadcast.shared_tag_count} shared tag{broadcast.shared_tag_count > 1 ? "s" : ""}</span>
        )}
      </div>
    </Link>
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
