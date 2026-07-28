"use client";

import Link from "next/link";
import { AppNav } from "@/components/AppNav";

export default function ConversationsPage() {
  // Barebone: GET /conversations (list-for-me) isn't in the API yet —
  // the backend currently only exposes /conversations/{id}/messages.
  // Add a GET /conversations endpoint returning the current user's threads
  // (id, other participant's PublicProfile, origin broadcast snippet,
  // last message preview) and wire it in here.
  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <h1 className="font-display text-xl font-bold mb-5">Messages</h1>
        <div className="card text-center py-10">
          <p className="font-medium">No conversations yet.</p>
          <p className="text-parchment-500 text-sm mt-1">
            Reply to a broadcast in your feed to start one.
          </p>
          <Link href="/feed" className="btn-secondary inline-block mt-4">
            Back to feed
          </Link>
        </div>
      </main>
    </div>
  );
}
