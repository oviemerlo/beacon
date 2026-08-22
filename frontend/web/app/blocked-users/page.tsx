"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import type { BlockedUser, BlockedUsersList } from "@/types/api";

export default function BlockedUsersPage() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<BlockedUsersList>("/blocks")
      .then((data) => setBlockedUsers(data.blocked_users))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load blocked users"))
      .finally(() => setLoading(false));
  }, []);

  async function unblock(userId: string) {
    setUnblockingId(userId);
    setError(null);
    const previous = blockedUsers;
    setBlockedUsers((rows) => rows.filter((row) => row.id !== userId));
    try {
      await clientFetch(`/blocks/${userId}`, { method: "DELETE" });
    } catch (err) {
      setBlockedUsers(previous);
      setError(err instanceof Error ? err.message : "Couldn't unblock this user");
    } finally {
      setUnblockingId(null);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-xl font-bold">Blocked users</h1>
          <Link href="/profile" className="text-sm text-signal-400 hover:text-signal-300">
            Back to profile
          </Link>
        </div>

        {loading ? (
          <p className="text-parchment-500 font-mono text-sm">Loading blocked users…</p>
        ) : (
          <div className="card">
            {error && <p className="text-rust-400 text-sm mb-3">{error}</p>}
            {blockedUsers.length === 0 ? (
              <p className="text-parchment-500 text-sm">You haven't blocked anyone.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {blockedUsers.map((blocked) => (
                  <li key={blocked.id} className="flex items-center justify-between gap-3">
                    <p className="text-parchment-100 font-mono text-sm">@{blocked.username}</p>
                    <button
                      type="button"
                      className="text-sm text-signal-400 hover:text-signal-300 disabled:opacity-50"
                      disabled={unblockingId === blocked.id}
                      onClick={() => void unblock(blocked.id)}
                    >
                      Unblock
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
