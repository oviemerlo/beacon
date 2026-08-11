"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/lib/client-api";

export default function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postReplyInFeed() {
    if (!reply.trim()) return;
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
        }),
      });
      router.push("/feed");
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
        <div className="card mb-4">
          <textarea
            className="input-field min-h-[100px] resize-none"
            placeholder="Write your public reply…"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
          />
          {error && <p className="text-rust-400 text-sm mt-2">{error}</p>}
          <button onClick={postReplyInFeed} disabled={sending} className="btn-primary w-full mt-3">
            {sending ? "Posting…" : "Reply in feed"}
          </button>
          <p className="text-parchment-500 text-xs mt-2">This creates a public broadcast reply.</p>
        </div>
      </main>
    </div>
  );
}
