"use client";

import { useEffect, useRef, useState } from "react";
import { promptAndSubmitReport } from "@/helpers/report-actions";
import { clientFetch } from "@/helpers/client-api";

export type OverflowAction = { label: string; onSelect: () => Promise<void> };

export function buildFeedCardActions({
  isOwn,
  broadcastId,
  senderId,
  senderDisplayName,
  onBlocked,
  onRemoved,
}: {
  isOwn: boolean;
  broadcastId: string;
  senderId: string;
  senderDisplayName: string;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
}): OverflowAction[] {
  if (isOwn) {
    return [
      {
        label: "Delete",
        onSelect: async () => {
          const confirmed = window.confirm("Delete this Echo? It will disappear from everyone's feed.");
          if (!confirmed) return;
          try {
            await clientFetch(`/broadcasts/${broadcastId}`, { method: "DELETE" });
            onRemoved(broadcastId);
          } catch {
            window.alert("Couldn't delete this Echo.");
          }
        },
      },
    ];
  }
  return [
    {
      label: "Report",
      onSelect: async () => {
        try {
          await promptAndSubmitReport("broadcast", broadcastId, "this broadcast");
          window.alert("Report submitted.");
        } catch {
          window.alert("Couldn't submit report.");
        }
      },
    },
    {
      label: "Block",
      onSelect: async () => {
        const confirmed = window.confirm(
          `Block ${senderDisplayName}?\n\nYou won't see their posts in your feed, including ones already here. They can still see your broadcasts.`
        );
        if (!confirmed) return;
        try {
          await clientFetch(`/blocks/${senderId}`, { method: "PUT" });
          onBlocked(senderId);
        } catch {
          window.alert("Couldn't block this user.");
        }
      },
    },
    {
      label: "Remove from my feed",
      onSelect: async () => {
        try {
          await clientFetch(`/broadcasts/${broadcastId}/hide`, { method: "PUT" });
          onRemoved(broadcastId);
        } catch {
          window.alert("Couldn't remove this Echo from your feed.");
        }
      },
    },
  ];
}

export function FeedCardOverflowMenu({
  senderName,
  actions,
}: {
  senderName: string;
  actions: OverflowAction[];
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button
        type="button"
        aria-label={`More actions for ${senderName}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-7 w-7 items-center justify-center rounded-beacon border border-dusk-600 bg-dusk-800 text-parchment-300 hover:text-parchment-100 hover:border-parchment-500"
      >
        <span className="text-base leading-none">⋯</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-beacon border border-dusk-600 bg-dusk-800 py-1 shadow-lg">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className="block w-full px-3 py-1.5 text-left text-sm text-parchment-100 hover:bg-dusk-700"
              onClick={async () => {
                setOpen(false);
                await action.onSelect();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
