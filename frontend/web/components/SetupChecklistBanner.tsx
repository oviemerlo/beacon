"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { clientFetch } from "@/helpers/client-api";
import type { SetupStatus } from "@/types/api";

export function SetupChecklistBanner() {
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    clientFetch<SetupStatus>("/users/me/setup-status")
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  if (dismissed || !status || status.all_required_done) return null;

  const incompleteRequired = status.items.filter((item) => !item.optional && !item.done);
  const optionalIncomplete = status.items.find((item) => item.optional && !item.done);

  return (
    <div className="card mb-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">
          Finish setting up — {status.completed_required}/{status.total_required} done
        </p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-parchment-500 hover:text-parchment-100 text-sm leading-none px-1"
          aria-label="Dismiss setup checklist"
        >
          ×
        </button>
      </div>
      <ul className="mt-3 space-y-2">
        {incompleteRequired.map((item) => (
          <li key={item.key}>
            <Link href={item.action_href} className="text-sm text-signal-400 hover:text-signal-300">
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
      {optionalIncomplete && (
        <>
          <div className="border-t border-dusk-800 my-3" />
          <Link href={optionalIncomplete.action_href} className="flex items-center gap-2 text-sm text-signal-400 hover:text-signal-300">
            <span>{optionalIncomplete.label}</span>
            <span className="text-[10px] font-mono uppercase tracking-wide text-signal-400 border border-signal-500/50 rounded-full px-2 py-0.5 shrink-0">
              Optional
            </span>
          </Link>
        </>
      )}
    </div>
  );
}
