"use client";

import type { Tag } from "@/types/api";

export function TagChip({
  tag,
  selected,
  onToggle,
  locked = false,
}: {
  tag: Tag;
  selected: boolean;
  onToggle: () => void;
  locked?: boolean;
}) {
  const countries = tag.countries ?? [];
  const button = (
    <button
      type="button"
      onClick={onToggle}
      className={`tag-pill ${selected ? "tag-pill-active" : ""} ${locked ? "opacity-40" : ""}`}
      aria-describedby={countries.length > 0 ? `region-countries-${tag.id}` : undefined}
    >
      {tag.label}
    </button>
  );

  if (countries.length === 0) return button;

  return (
    <span className="relative inline-flex group/region">
      {button}
      <span
        id={`region-countries-${tag.id}`}
        role="tooltip"
        className="invisible opacity-0 group-hover/region:visible group-hover/region:opacity-100 group-focus-within/region:visible group-focus-within/region:opacity-100 absolute left-0 top-full z-30 pt-1"
      >
        <span className="block w-64 max-h-48 overflow-y-auto rounded-beacon border border-dusk-600 bg-dusk-800 p-2.5 text-[11px] leading-relaxed text-parchment-300 shadow-lg">
          <span className="block font-medium text-parchment-100 mb-1.5">{tag.label}</span>
          {countries.length > 12 ? (
            <ul className="space-y-0.5">
              {countries.map((country) => (
                <li key={country}>{country}</li>
              ))}
            </ul>
          ) : (
            <span className="block">{countries.join(", ")}</span>
          )}
        </span>
      </span>
    </span>
  );
}

export function TagChipRow({
  tags,
  selectedIds,
  onToggle,
  locked = false,
}: {
  tags: Tag[];
  selectedIds: number[];
  onToggle: (tagId: number) => void;
  locked?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <TagChip
          key={tag.id}
          tag={tag}
          selected={selectedIds.includes(tag.id)}
          onToggle={() => onToggle(tag.id)}
          locked={locked}
        />
      ))}
    </div>
  );
}
