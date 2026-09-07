"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import type { GroupCreateResult } from "@/types/api";

export default function NewGroupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<GroupCreateResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name is required.");
      return;
    }
    const maxValue = maxParticipants.trim();
    const max_participants = maxValue === "" ? null : Number(maxValue);
    if (max_participants !== null && (!Number.isInteger(max_participants) || max_participants < 2)) {
      setError("Max participants must be at least 2, or left blank for no limit.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await clientFetch<GroupCreateResult>("/groups", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, max_participants }),
      });
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create this group.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInvite() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.invite_url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this link", created.invite_url);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-xl font-bold">Create a group chat</h1>
          <Link href="/groups" className="text-sm text-signal-400 hover:text-signal-300">
            Open group chats
          </Link>
        </div>

        {created ? (
          <div className="card">
            <p className="font-medium">Group created.</p>
            <p className="text-parchment-500 text-sm mt-1">Share this invite link so people can join.</p>
            <p className="mt-4 break-all font-mono text-sm text-parchment-100">{created.invite_url}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary" onClick={() => void copyInvite()}>
                {copied ? "Copied" : "Copy link"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => router.push(`/conversations/${created.conversation_id}`)}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="card flex flex-col gap-4">
            {error && <p className="text-rust-400 text-sm">{error}</p>}
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-parchment-300">Group name</span>
              <input
                className="input-field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={200}
                required
                autoFocus
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-parchment-300">Max participants (optional)</span>
              <input
                className="input-field"
                type="number"
                min={2}
                inputMode="numeric"
                value={maxParticipants}
                onChange={(event) => setMaxParticipants(event.target.value)}
                placeholder="No limit"
              />
            </label>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create group"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
