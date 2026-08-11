"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/lib/client-api";
import { promptAndSubmitReport } from "@/lib/report-actions";
import type { Message } from "@/types/api";

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const data = await clientFetch<Message[]>(`/conversations/${id}/messages`);
    setMessages(data);
  }

  useEffect(() => {
    load();
    // Barebone polling — swap for a WebSocket subscription once the
    // backend adds real-time chat (noted as a next step in the backend README).
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await clientFetch(`/conversations/${id}/messages`, { method: "POST", body: JSON.stringify({ body: draft }) });
      setDraft("");
      await load();
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="max-w-2xl mx-auto w-full px-5 py-6 flex-1 flex flex-col">
        <div className="flex-1 flex flex-col gap-2 overflow-y-auto mb-4">
          {messages.map((m) => (
            <div key={m.id} className="card py-2.5 px-3.5 max-w-[80%] self-start">
              <p className="text-sm">{m.body}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-parchment-500 text-[10px] font-mono">
                  {new Date(m.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                <button
                  className="text-[10px] font-mono text-rust-400 hover:text-rust-300"
                  onClick={async () => {
                    try {
                      await promptAndSubmitReport("message", m.id, "this message");
                      window.alert("Report submitted.");
                    } catch {
                      window.alert("Couldn't submit report.");
                    }
                  }}
                >
                  Report
                </button>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2">
          <input
            className="input-field"
            placeholder="Message…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button onClick={send} disabled={sending} className="btn-primary px-5">
            Send
          </button>
        </div>
      </main>
    </div>
  );
}
