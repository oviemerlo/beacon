"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import { promptAndSubmitReport } from "@/helpers/report-actions";
import { formatMessageSentAt } from "@/helpers/time";
import type { ConversationContext, Message, UserProfile } from "@/types/api";

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const [me, details, data] = await Promise.all([
      clientFetch<UserProfile>("/users/me"),
      clientFetch<ConversationContext>(`/conversations/${id}`),
      clientFetch<Message[]>(`/conversations/${id}/messages`),
    ]);
    setCurrentUserId(me.id);
    setContext(details);
    setMessages(data);
  }

  useEffect(() => {
    load();
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

  const originWasMine = context?.origin_broadcast_sender_id === currentUserId;

  return (
    <div className="min-h-screen flex flex-col">
      <AppNav />
      <main className="max-w-2xl mx-auto w-full px-5 py-6 flex-1 flex flex-col min-h-0">
        <div className="flex items-center gap-1 mb-5">
          <h1 className="px-3 py-1.5 rounded-beacon text-sm font-medium text-parchment-100">Conversation</h1>
          <Link
            href="/conversations"
            className="px-3 py-1.5 rounded-beacon text-sm font-medium text-parchment-500 hover:text-parchment-100 whitespace-nowrap"
          >
            Back to messages
          </Link>
        </div>
        {context && (
          <div className={`mb-4 flex w-full ${originWasMine ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[min(75%,28rem)] rounded-beacon border border-dusk-600 border-l-4 border-l-signal-500 bg-dusk-800/70 px-3 py-2.5">
              <p className="text-signal-400 font-semibold text-xs">
                {originWasMine
                  ? "Your broadcast:"
                  : `Broadcast from ${context.origin_broadcast_sender_display_name}:`}
              </p>
              <p className="text-parchment-300 text-sm mt-1 italic">{context.origin_broadcast_preview}</p>
            </div>
          </div>
        )}
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto mb-4 w-full min-h-0">
          {!currentUserId ? (
            <p className="text-parchment-500 text-sm font-mono">Loading conversation…</p>
          ) : (
            messages.map((m) => {
              const isMine = String(m.sender_id) === String(currentUserId);
              const isUnread = !isMine && m.read_at == null;
              return (
                <div key={m.id} className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
                  <div className="card py-2.5 px-3.5 w-fit max-w-[75%]">
                    <p className={`text-sm mb-1 ${isUnread ? "font-semibold" : "font-normal"}`}>
                      {isMine ? "You:" : `${context?.other_participant_display_name ?? "Unknown"}:`}
                    </p>
                    <p className={`text-sm break-words ${isUnread ? "font-semibold" : "font-normal"}`}>{m.body}</p>
                    <div className="flex items-center justify-between gap-4 mt-2">
                      {!isMine ? (
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
                      ) : (
                        <span />
                      )}
                      <p className="text-parchment-500 text-[10px] font-mono">
                        {formatMessageSentAt(m.sent_at)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex gap-2 w-full">
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
