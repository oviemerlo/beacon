"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import { formatMessageSentAt } from "@/helpers/time";
import type { GroupSummary } from "@/types/api";

export default function GroupsPage() {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<GroupSummary[]>("/groups")
      .then((rows) => setGroups(rows))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load groups."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-xl font-bold">Group chats</h1>
          <Link href="/groups/new" className="text-sm text-signal-400 hover:text-signal-300">
            Create a group chat
          </Link>
        </div>

        {loading ? (
          <p className="text-parchment-500 text-sm font-mono">Loading groups…</p>
        ) : error ? (
          <p className="text-rust-400 text-sm">{error}</p>
        ) : groups.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium">You haven&apos;t joined any groups yet.</p>
            <Link href="/groups/new" className="btn-secondary inline-block mt-4">
              Create a group chat
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groups.map((group) => {
              const countLabel =
                group.max_participants == null
                  ? `${group.participant_count} joined`
                  : `${group.participant_count}/${group.max_participants} joined`;
              return (
                <Link
                  key={group.id}
                  href={`/conversations/${group.id}`}
                  className="card block hover:border-signal-500/50 transition-colors"
                >
                  <p className="font-medium text-parchment-100">{group.name || "Untitled group"}</p>
                  <p className="text-parchment-500 text-sm mt-1">{countLabel}</p>
                  <p className="text-parchment-100 text-sm mt-2">
                    {group.last_message || "No messages yet."}
                  </p>
                  <p className="text-parchment-500 text-[10px] font-mono mt-1">
                    {formatMessageSentAt(group.last_message_at)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
