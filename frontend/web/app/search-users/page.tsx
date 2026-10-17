"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";
import { FollowButton } from "@/components/FollowButton";
import { SenderAvatar } from "@/components/SenderAvatar";
import { VerifiedMark } from "@/components/VerifiedMark";
import { clientFetch } from "@/helpers/client-api";
import type { FollowingListItem, FollowTarget, UserProfile } from "@/types/api";

type Tab = "search" | "following";

export default function SearchUsersPage() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FollowTarget[]>([]);
  const [following, setFollowing] = useState<FollowTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientFetch<UserProfile>("/users/me")
      .then((me) => setCurrentUserId(me.id))
      .catch(() => setCurrentUserId(null));
  }, []);

  useEffect(() => {
    if (tab !== "search") return;
    const keyword = query.trim();
    if (!keyword) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      clientFetch<FollowTarget[]>(`/users/search?q=${encodeURIComponent(keyword)}`)
        .then((rows) => {
          if (!cancelled) {
            setResults(rows);
            setError(null);
          }
        })
        .catch((err) => !cancelled && setError(err instanceof Error ? err.message : "Couldn't search"))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, tab]);

  useEffect(() => {
    if (tab !== "following") return;
    setLoading(true);
    clientFetch<FollowingListItem[]>("/users/me/following")
      .then((rows) => {
        setFollowing(rows.map((row) => ({ ...row, is_following: true })));
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load who you follow"))
      .finally(() => setLoading(false));
  }, [tab]);

  const rows = tab === "search" ? results : following;

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-xl font-bold">Find people &amp; businesses</h1>
          <Link href="/profile" className="text-sm text-signal-400 hover:text-signal-300">
            Back to profile
          </Link>
        </div>

        <div className="flex gap-2 mb-4" role="tablist">
          {(["search", "following"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={`flex-1 rounded-beacon border py-2 text-sm font-semibold ${
                tab === value ? "border-signal-500 text-signal-400" : "border-dusk-600 text-parchment-500"
              }`}
            >
              {value === "search" ? "Search" : "Following"}
            </button>
          ))}
        </div>

        {tab === "search" && (
          <input
            className="input-field w-full mb-4"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by @handle or name"
            autoComplete="off"
            autoFocus
          />
        )}

        {error && <p className="text-rust-400 text-sm mb-3">{error}</p>}
        {loading && <p className="text-parchment-500 font-mono text-sm mb-3">Loading…</p>}

        {!loading && rows.length === 0 ? (
          <p className="text-parchment-500 text-sm">
            {tab === "following" ? "You aren't following anyone yet." : query.trim() ? "No matches." : "Find people and businesses to follow."}
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.id} className="card flex items-center gap-3">
                <SenderAvatar fileId={row.avatar_file_id} name={row.display_name} className="h-9 w-9 shrink-0 rounded-full border border-dusk-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-parchment-100 font-semibold inline-flex items-center gap-1.5 truncate">
                    {row.display_name}
                    <VerifiedMark verified={row.is_verified} />
                  </p>
                  <p className="text-parchment-500 font-mono text-xs truncate">
                    @{row.username}
                    {row.account_type === "business" ? "  ·  Business" : ""}
                  </p>
                </div>
                <FollowButton userId={row.id} initialFollowing={row.is_following} currentUserId={currentUserId} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
