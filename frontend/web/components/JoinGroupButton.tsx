"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClientApiError, clientFetch } from "@/helpers/client-api";

export function JoinGroupButton({
  token,
  loggedIn,
  isFull,
}: {
  token: string;
  loggedIn: boolean;
  isFull: boolean;
}) {
  const router = useRouter();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isFull) {
    return (
      <p className="btn-secondary w-full text-center mt-5 opacity-60 pointer-events-none">
        This group is full
      </p>
    );
  }

  if (!loggedIn) {
    return (
      <a href={`/login?next=${encodeURIComponent(`/join/${token}`)}`} className="btn-primary w-full inline-block text-center mt-5">
        Join group
      </a>
    );
  }

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const result = await clientFetch<{ conversation_id: string }>(`/join/${token}`, { method: "POST" });
      router.push(`/conversations/${result.conversation_id}`);
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Couldn't join this group.");
      setJoining(false);
    }
  }

  return (
    <>
      {error && <p className="text-rust-400 text-sm text-center mt-3">{error}</p>}
      <button type="button" className="btn-primary w-full mt-5" disabled={joining} onClick={() => void join()}>
        {joining ? "Joining…" : "Join group"}
      </button>
    </>
  );
}
