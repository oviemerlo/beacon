"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/lib/client-api";
import { promptAndSubmitReport } from "@/lib/report-actions";
import { usePolling } from "@/lib/usePolling";
import type { ConversationThread } from "@/types/api";

export default function ConversationsPage() {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async ({ silent }: { silent: boolean }) => {
    const rows = await clientFetch<ConversationThread[]>("/conversations");
    setThreads(rows);
    if (!silent) setLoading(false);
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
                  <p className="font-medium">{t.other_participant.display_name}</p>
                  <p className="text-parchment-500 text-sm mt-1">{t.last_message || "No messages yet."}</p>
                </Link>
                <div className="mt-3">
                  <button
                    className="tag-pill"
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
