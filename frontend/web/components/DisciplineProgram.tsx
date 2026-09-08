"use client";

import { useEffect, useState } from "react";

import { clientFetch } from "@/helpers/client-api";
import type { UserProfile } from "@/types/api";

const PROGRAM_MAX_LEN = 100;

export function DisciplineProgram() {
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = input.trim().length > 0 && !submitting;

  useEffect(() => {
    clientFetch<UserProfile>("/users/me")
      .then((me) => {
        const current = me.tags?.find((tag) => tag.tag_type === "discipline");
        setSavedLabel(current?.label ?? null);
        setEditing(!current);
      })
      .catch(() => {
        setSavedLabel(null);
        setEditing(true);
      });
  }, []);

  async function saveProgram() {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await clientFetch<{ tag_id: number; label: string }>("/users/me/discipline", {
        method: "PUT",
        body: JSON.stringify({ program_name: input.trim() }),
      });
      setSavedLabel(saved.label);
      setInput("");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your program");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="text-sm font-medium mb-1">Your department or program</p>
      <p className="text-parchment-500 text-xs mb-3">
        Just the subject — e.g. &quot;Nursing,&quot; &quot;Computer Science,&quot; &quot;Business&quot; — not the full degree title.
      </p>
      {savedLabel && !editing ? (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="tag-pill tag-pill-active">{savedLabel}</span>
          <button type="button" className="btn-secondary text-sm py-2" onClick={() => { setInput(savedLabel); setEditing(true); }}>
            Edit
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="text"
            className="input-field text-sm py-2"
            placeholder="e.g. Nursing"
            value={input}
            maxLength={PROGRAM_MAX_LEN}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                saveProgram();
              }
            }}
          />
          <button type="button" className="btn-primary text-sm" onClick={saveProgram} disabled={!canSave}>
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      )}
      {error && <p className="text-rust-400 text-sm mt-2">{error}</p>}
    </div>
  );
}
