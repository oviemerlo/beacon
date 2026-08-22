"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import { promptAndSubmitReport } from "@/helpers/report-actions";
import { formatMessageSentAt } from "@/helpers/time";
import { usePolling } from "@/helpers/usePolling";
import type { ConversationThread } from "@/types/api";

export default function ConversationsPage() {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async ({ silent }: { silent: boolean }) => {
    const rows = await clientFetch<ConversationThread[]>("/conversations");
    setThreads(rows);
    if (!silent) setLoading(false);
    try {
      await clientFetch("/conversations/mark-seen", { method: "POST" });
      setThreads((current) => current.map((thread) => ({ ...thread, unread_count: 0 })));
    } catch {
      // Keep inbox rendering even if read-state update fails.
    }
  }, []);

  usePolling(loadConversations, [loadConversations], 5000);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <h1 className="font-display text-xl font-bold mb-5">Messages</h1>
        {loading ? (
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
              <div key={t.id} className="card hover:border-signal-500/50 transition-colors">
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
                              {t.last_message || "No messages yet."}
                            </p>
                            <p className="text-parchment-500 text-[10px] font-mono mt-1">
                              {formatMessageSentAt(t.last_message_at)}
                            </p>
                          </div>
                        ) : (
                          <div className="max-w-[62%] ml-auto text-right">
                            <p className="font-normal">You:</p>
                            <p className="text-parchment-100 text-sm font-normal mt-1">
                              {t.last_message || "No messages yet."}
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
