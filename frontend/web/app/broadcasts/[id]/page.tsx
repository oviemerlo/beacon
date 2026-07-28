"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/lib/client-api";

export default function BroadcastDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendFirstMessage() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await clientFetch<{ conversation_id: string }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ broadcast_id: id, first_message: message }),
      });
      router.push(`/conversations/${res.conversation_id}`);
    } catch {
      // Most likely cause: this broadcast was never actually served into
      // your feed (can_initiate_conversation in the backend enforces this).
      setError("Couldn't start a conversation from this broadcast.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        {/* Barebone: fetch the single broadcast (GET /broadcasts/{id} —
            not yet in the API, add it) to render content/sender/tags here.
            For now this focuses on the reply flow, which is the part with
            product logic worth scaffolding carefully. */}
        <div className="card mb-4">
          <textarea
            className="input-field min-h-[100px] resize-none"
            placeholder="Say hello…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <p className="text-rust-400 text-sm mt-2">{error}</p>}
          <button onClick={sendFirstMessage} disabled={sending} className="btn-primary w-full mt-3">
            {sending ? "Sending…" : "Send message"}
          </button>
        </div>
      </main>
    </div>
  );
}
