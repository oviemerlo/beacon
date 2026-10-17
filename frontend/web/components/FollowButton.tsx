"use client";

import { useEffect, useState } from "react";
import { clientFetch } from "@/helpers/client-api";

export async function toggleFollow(userId: string, currentlyFollowing: boolean) {
  await clientFetch(`/users/${userId}/follow`, { method: currentlyFollowing ? "DELETE" : "POST" });
}

export function FollowButton({
  userId,
  initialFollowing,
  currentUserId,
}: {
  userId: string;
  initialFollowing: boolean;
  currentUserId: string | null;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  if (!currentUserId || currentUserId === userId) return null;

  async function onClick() {
    if (busy) return;
    const previous = following;
    setFollowing(!previous);
    setBusy(true);
    try {
      await toggleFollow(userId, previous);
    } catch {
      setFollowing(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-pressed={following}
      onClick={() => void onClick()}
      className={`rounded-beacon border px-2 py-0.5 text-[11px] font-semibold leading-tight transition-colors ${
        following
          ? "border-parchment-500/60 text-parchment-500 hover:text-parchment-100"
          : "border-signal-500 text-signal-400 hover:text-signal-300"
      }`}
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
