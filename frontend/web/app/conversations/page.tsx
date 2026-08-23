"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import { promptAndSubmitReport } from "@/helpers/report-actions";
import { splitMentionParts } from "@/helpers/mentions";
import { formatMessageSentAt } from "@/helpers/time";
import { usePolling } from "@/helpers/usePolling";
import type { ConversationSearchHit, ConversationThread, MentionNotification } from "@/types/api";

export default function ConversationsPage() {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchHits, setSearchHits] = useState<ConversationSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const isSearching = debouncedQuery.trim().length > 0;

  const loadConversations = useCallback(async ({ silent }: { silent: boolean }) => {
    if (debouncedQuery.trim()) return;
    const [rows, mentionRows] = await Promise.all([
      clientFetch<ConversationThread[]>("/conversations"),
      clientFetch<MentionNotification[]>("/conversations/mentions").catch(() => []),
    ]);
    setThreads(rows);
    setMentions(mentionRows);
    if (!silent) setLoading(false);
    try {
      await clientFetch("/conversations/mark-seen", { method: "POST" });
      setThreads((current) => current.map((thread) => ({ ...thread, unread_count: 0 })));
    } catch {
      // Keep inbox rendering even if read-state update fails.
    }
  }, [debouncedQuery]);

  usePolling(loadConversations, [loadConversations], 5000);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (!isSearching) {
      setSearchHits([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    clientFetch<ConversationSearchHit[]>(`/conversations/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then((hits) => {
        if (!cancelled) setSearchHits(hits);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchHits([]);
        setSearchError("Couldn't search your messages.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isSearching]);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <h1 className="font-display text-xl font-bold mb-5">Messages</h1>
        <div className="mb-5">
          <input
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your messages"
            aria-label="Search your messages"
          />
        </div>
        {!isSearching && mentions.length > 0 && (
          <div className="flex flex-col gap-2 mb-5">
            {mentions.map((mention) => (
              <div key={mention.id} className="card border-signal-500">
                <p className="text-signal-400 text-[10px] font-mono mb-1">You were mentioned</p>
                <p className="text-sm">
                  <span className="text-signal-400">@{mention.actor_username}</span> mentioned you
                </p>
                <p className="text-parchment-300 text-sm italic mt-1">{mention.origin_broadcast_preview}</p>
                <p className="text-parchment-100 text-sm mt-2">
                  <MentionBody text={mention.body} />
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {mention.is_own_conversation ? (
                    <Link href={`/conversations/${mention.conversation_id}`} className="feed-card-action">
                      Open conversation
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="feed-card-action"
                      onClick={async () => {
                        await clientFetch(`/conversations/mentions/${mention.id}/read`, { method: "POST" });
                        setMentions((rows) => rows.filter((row) => row.id !== mention.id));
                      }}
                    >
                      Dismiss mention
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {isSearching ? (
          <>
            {searching && <p className="text-parchment-500 text-sm font-mono">Searching…</p>}
            {searchError && <p className="text-rust-400 text-sm">{searchError}</p>}
            {!searching && !searchError && searchHits.length === 0 && (
              <div className="card text-center py-10">
                <p className="font-medium">No matching messages.</p>
                <p className="text-parchment-500 text-sm mt-1">Try a different keyword.</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {searchHits.map((hit) => (
                <SearchHitCard key={hit.id} hit={hit} />
              ))}
            </div>
          </>
        ) : loading ? (
          <p className="text-parchment-500 text-sm font-mono">Loading conversations…</p>
        ) : threads.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium">No conversations yet.</p>
            <p className="text-parchment-500 text-sm mt-1">
              Reply privately from a broadcast in your feed to start one.
            </p>
            <Link href="/feed" className="btn-secondary inline-block mt-4">
              Back to feed
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {threads.map((t) => (
              <div key={t.id} className={`card hover:border-signal-500/50 transition-colors ${t.has_mention ? "border-signal-500" : ""}`}>
                {t.has_mention && <p className="text-signal-400 text-[10px] font-mono mb-2">You were mentioned</p>}
                <Link href={`/conversations/${t.id}`} className="block">
                  {(() => {
                    const isIncomingLatest = t.last_message_sender_id === t.other_participant.id;
                    const isUnread = (t.unread_count ?? 0) > 0;
                    const originWasMine = t.is_reply_to_you;
                    const quotePrefix = originWasMine
                      ? "Your broadcast: "
                      : `Broadcast from ${t.origin_broadcast_sender_display_name}: `;
                    return (
                      <>
                        <div
                          className={`mt-1 mb-2 max-w-[62%] rounded-md border border-dusk-600 border-l-4 border-l-signal-500 bg-dusk-800/70 px-2.5 py-2 ${
                            originWasMine ? "ml-auto" : "mr-auto"
                          }`}
                        >
                          <p className="text-parchment-300 text-sm italic">
                            {quotePrefix}
                            {t.origin_broadcast_preview}
                          </p>
                        </div>
                        {isIncomingLatest ? (
                          <div className="max-w-[62%] mr-auto">
                            <p className={isUnread ? "font-semibold" : "font-normal"}>{t.other_participant.display_name}:</p>
                            <p className={`text-parchment-100 text-sm mt-1 ${isUnread ? "font-semibold" : "font-normal"}`}>
                              {t.last_message ? <MentionBody text={t.last_message} /> : "No messages yet."}
                            </p>
                            <p className="text-parchment-500 text-[10px] font-mono mt-1">
                              {formatMessageSentAt(t.last_message_at)}
                            </p>
                          </div>
                        ) : (
                          <div className="max-w-[62%] ml-auto text-right">
                            <p className="font-normal">You:</p>
                            <p className="text-parchment-100 text-sm font-normal mt-1">
                              {t.last_message ? <MentionBody text={t.last_message} /> : "No messages yet."}
                            </p>
                            <p className="text-parchment-500 text-[10px] font-mono mt-1">
                              {formatMessageSentAt(t.last_message_at)}
                            </p>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </Link>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Link href={`/conversations/${t.id}`} className="feed-card-action">
                    View conversation
                  </Link>
                  <button
                    className="feed-card-action"
                    onClick={async () => {
                      try {
                        await promptAndSubmitReport("user", t.other_participant.id, "this profile");
                        window.alert("Report submitted.");
                      } catch {
                        window.alert("Couldn't submit report.");
                      }
                    }}
                  >
                    Report profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function MentionBody({ text }: { text: string }) {
  return (
    <>
      {splitMentionParts(text).map((part, index) =>
        part.mention ? (
          <span key={index} className="mention-text">
            {part.text}
          </span>
        ) : (
          <span key={index}>{part.text}</span>
        )
      )}
    </>
  );
}

function SearchHitCard({ hit }: { hit: ConversationSearchHit }) {
  const originWasMine = hit.is_reply_to_you;
  const quotePrefix = originWasMine
    ? "Your broadcast: "
    : `Broadcast from ${hit.origin_broadcast_sender_display_name}: `;
  return (
    <div className="card">
      <p className="text-parchment-500 text-sm mb-2">{hit.other_participant.display_name}</p>
      <div
        className={`mt-1 mb-2 max-w-[62%] rounded-md border border-dusk-600 border-l-4 border-l-signal-500 bg-dusk-800/70 px-2.5 py-2 ${
          originWasMine ? "ml-auto" : "mr-auto"
        }`}
      >
        <p className="text-parchment-300 text-sm italic">
          {quotePrefix}
          {hit.origin_broadcast_preview}
        </p>
      </div>
      <div className="mt-3 ml-3 border-l border-dusk-600 pl-3 flex flex-col gap-3">
        {hit.matches.map((match) => (
          <div key={match.id}>
            <p className="text-parchment-100 text-sm">
              <MentionBody text={match.body} />
            </p>
            <p className="text-parchment-500 text-xs font-mono mt-1">{formatMessageSentAt(match.created_at)}</p>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <Link href={`/conversations/${hit.id}`} className="feed-card-action">
          Open conversation
        </Link>
      </div>
    </div>
  );
}
