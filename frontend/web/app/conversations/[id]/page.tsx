"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import { applyMention, mentionTriggerFromInput, splitMentionParts } from "@/helpers/mentions";
import { promptAndSubmitReport } from "@/helpers/report-actions";
import { formatMessageSentAt } from "@/helpers/time";
import type { ConversationContext, MentionCandidate, Message, UserProfile } from "@/types/api";

export default function ConversationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const mentionFetchedFor = useRef<string | null>(null);
  const mentionFetchInFlight = useRef(false);
  const conversationId = typeof id === "string" ? id : Array.isArray(id) ? id[0] : undefined;

  async function load() {
    const [me, details, data] = await Promise.all([
      clientFetch<UserProfile>("/users/me"),
      clientFetch<ConversationContext>(`/conversations/${conversationId}`),
      clientFetch<Message[]>(`/conversations/${conversationId}/messages`),
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

  async function loadMentionCandidates(reason: string) {
    if (!conversationId) {
      console.warn("[mentions] fetch skipped: missing conversation id", { reason });
      return [];
    }
    const echoId = context?.origin_broadcast_id ?? null;
    const path = `/conversations/${conversationId}/mention-candidates`;
    if (mentionFetchInFlight.current && reason !== "mount") {
      console.log("[mentions] fetch skipped: already in flight", { reason, conversationId, echoId });
      return candidates;
    }
    mentionFetchInFlight.current = true;
    console.log("[mentions] fetch called", { reason, conversationId, echoId, path });
    setMentionLoading(true);
    try {
      const rows = await clientFetch<MentionCandidate[]>(path);
      const responseEchoId = rows[0]?.echo_id ?? echoId;
      console.log("[mentions] response received", {
        conversationId,
        echoId: responseEchoId,
        count: rows.length,
        usernames: rows.map((row) => row.username),
      });
      setCandidates(rows);
      mentionFetchedFor.current = conversationId;
      return rows;
    } catch (error) {
      console.error("[mentions] fetch failed", { conversationId, echoId, path, error });
      setCandidates([]);
      return [];
    } finally {
      mentionFetchInFlight.current = false;
      setMentionLoading(false);
    }
  }

  useEffect(() => {
    mentionFetchedFor.current = null;
    void loadMentionCandidates("mount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  function updateMentionState(value: string, cursor: number) {
    const active = mentionTriggerFromInput(value, cursor);
    if (!active) {
      setMentionOpen(false);
      return;
    }
    const echoId = context?.origin_broadcast_id ?? null;
    console.log("[mentions] trigger detected", {
      query: active.query,
      start: active.start,
      cursor,
      conversationId,
      echoId,
      attachedToInput: inputRef.current instanceof HTMLInputElement,
    });
    setMentionStart(active.start);
    setMentionQuery(active.query);
    setMentionOpen(true);
    const shouldFetch = mentionFetchedFor.current !== conversationId || candidates.length === 0;
    if (shouldFetch) {
      void loadMentionCandidates("trigger").then((rows) => {
        const filteredCount = rows.filter((candidate) => {
          const q = active.query.toLowerCase();
          return candidate.username.toLowerCase().startsWith(q) || candidate.display_name.toLowerCase().startsWith(q);
        }).length;
        console.log("[mentions] dropdown state updated", {
          mentionOpen: true,
          query: active.query,
          candidateCount: filteredCount,
          fetchedCount: rows.length,
        });
      });
      return;
    }
    const filteredCount = candidates.filter((candidate) => {
      const q = active.query.toLowerCase();
      return candidate.username.toLowerCase().startsWith(q) || candidate.display_name.toLowerCase().startsWith(q);
    }).length;
    console.log("[mentions] dropdown state updated", {
      mentionOpen: true,
      query: active.query,
      candidateCount: filteredCount,
      cachedTotal: candidates.length,
    });
  }

  const filteredCandidates = candidates.filter((candidate) => {
    const q = mentionQuery.toLowerCase();
    return candidate.username.toLowerCase().startsWith(q) || candidate.display_name.toLowerCase().startsWith(q);
  });

  function insertMention(candidate: MentionCandidate) {
    const cursor = inputRef.current?.selectionStart ?? draft.length;
    const next = applyMention(draft, mentionStart, cursor, candidate.username);
    setDraft(next);
    setMentionOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await clientFetch(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body: draft }) });
      setDraft("");
      setMentionOpen(false);
      await load();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Couldn't send that message.");
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
              const mentionedMe = (m.mentioned_user_ids ?? []).includes(currentUserId);
              return (
                <div key={m.id} className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`card py-2.5 px-3.5 w-fit max-w-[75%] ${
                      mentionedMe ? "border-signal-500 bg-signal-500/10" : ""
                    }`}
                  >
                    {mentionedMe && (
                      <p className="text-signal-400 text-[10px] font-mono mb-1">You were mentioned</p>
                    )}
                    <p className={`text-sm mb-1 ${isUnread ? "font-semibold" : "font-normal"}`}>
                      {isMine ? "You:" : `${context?.other_participant_display_name ?? "Unknown"}:`}
                    </p>
                    <p className={`text-sm break-words ${isUnread ? "font-semibold" : "font-normal"}`}>
                      {splitMentionParts(m.body).map((part, index) =>
                        part.mention ? (
                          <span key={`${m.id}-${index}`} className="mention-text">
                            {part.text}
                          </span>
                        ) : (
                          <span key={`${m.id}-${index}`}>{part.text}</span>
                        )
                      )}
                    </p>
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

        <div className="relative w-full overflow-visible">
          {mentionOpen && (
            <div
              role="listbox"
              aria-label="Mention suggestions"
              className="absolute bottom-full mb-2 w-full max-h-48 overflow-y-auto rounded-beacon border border-dusk-600 bg-dusk-800 shadow-lg z-50"
            >
              {mentionLoading && (
                <p className="px-3 py-2 text-sm text-parchment-500">Looking up people in this Echo…</p>
              )}
              {!mentionLoading && filteredCandidates.length === 0 && (
                <p className="px-3 py-2 text-sm text-parchment-500">No matching people in this Echo&apos;s thread.</p>
              )}
              {filteredCandidates.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-dusk-700"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => insertMention(candidate)}
                >
                  <span className="mention-text">@{candidate.username}</span>
                  <span className="text-parchment-500 ml-2">{candidate.display_name}</span>
                </button>
              ))}
            </div>
          )}
          {sendError && <p className="text-rust-400 text-sm mb-2">{sendError}</p>}
          <div className="flex gap-2 w-full">
            <input
              ref={inputRef}
              className="input-field"
              placeholder="Message… Use @ to mention someone in this Echo"
              value={draft}
              onChange={(e) => {
                const value = e.target.value;
                setDraft(value);
                updateMentionState(value, e.target.selectionStart ?? value.length);
              }}
              onSelect={(e) => {
                const value = e.currentTarget.value;
                updateMentionState(value, e.currentTarget.selectionStart ?? value.length);
              }}
              onKeyUp={(e) => {
                const value = e.currentTarget.value;
                updateMentionState(value, e.currentTarget.selectionStart ?? value.length);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (mentionOpen && filteredCandidates[0]) insertMention(filteredCandidates[0]);
                  else void send();
                }
              }}
              onClick={(e) => {
                const value = e.currentTarget.value;
                updateMentionState(value, e.currentTarget.selectionStart ?? value.length);
              }}
            />
            <button onClick={send} disabled={sending} className="btn-primary px-5">
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
