"use client";

import { useState } from "react";
import { TagChipRow } from "@/components/TagChip";
import { clientFetch } from "@/helpers/client-api";
import type { Tag } from "@/types/api";

type DmPermission = "everyone" | "tag_match" | "no_one";

const OPTIONS: { value: DmPermission; label: string }[] = [
  { value: "everyone", label: "Everyone" },
  { value: "tag_match", label: "Someone who shares a tag I pick" },
  { value: "no_one", label: "No one" },
];

export function DmSettingsCard({
  initialPermission,
  initialTagIds,
  ownedTags,
}: {
  initialPermission: DmPermission;
  initialTagIds: number[];
  ownedTags: Tag[];
}) {
  const [dmPermission, setDmPermission] = useState<DmPermission>(initialPermission ?? "no_one");
  const [dmTagIds, setDmTagIds] = useState<number[]>(initialTagIds ?? []);
  const [savingDm, setSavingDm] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);

  async function saveDmSettings(nextPermission: DmPermission, nextTagIds: number[]) {
    setSavingDm(true);
    setDmError(null);
    try {
      await clientFetch("/users/me/dm-settings", {
        method: "PATCH",
        body: JSON.stringify({
          dm_permission: nextPermission,
          tag_ids: nextPermission === "tag_match" ? nextTagIds : [],
        }),
      });
    } catch (error) {
      setDmError(error instanceof Error ? error.message : "Could not save DM settings.");
    } finally {
      setSavingDm(false);
    }
  }

  return (
    <div className="card mb-4">
      <p className="font-medium mb-2">Who can message you directly</p>
      <p className="text-parchment-500 text-sm mb-2">Without needing to reply to one of your echoes first.</p>
      <div role="radiogroup" aria-label="Who can message you directly">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={dmPermission === option.value}
            className="flex w-full items-center gap-3 py-2 text-left"
            onClick={() => {
              setDmPermission(option.value);
              void saveDmSettings(option.value, dmTagIds);
            }}
          >
            <span
              className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 ${
                dmPermission === option.value ? "border-signal-500" : "border-dusk-600"
              }`}
            >
              {dmPermission === option.value && <span className="h-2.5 w-2.5 rounded-full bg-signal-500" />}
            </span>
            <span className="text-sm text-parchment-100">{option.label}</span>
          </button>
        ))}
      </div>
      {dmPermission === "tag_match" && (
        <div className="mt-3">
          {ownedTags.length === 0 ? (
            <p className="text-parchment-500 text-sm">Add Echo Tags first — you can only gate on tags you hold.</p>
          ) : (
            <TagChipRow
              tags={ownedTags}
              selectedIds={dmTagIds}
              onToggle={(tagId) => {
                const next = dmTagIds.includes(tagId) ? dmTagIds.filter((id) => id !== tagId) : [...dmTagIds, tagId];
                setDmTagIds(next);
                void saveDmSettings("tag_match", next);
              }}
            />
          )}
        </div>
      )}
      {savingDm && <p className="text-parchment-500 text-xs font-mono mt-2">Saving…</p>}
      {dmError && <p className="text-rust-400 text-sm mt-2">{dmError}</p>}
    </div>
  );
}
