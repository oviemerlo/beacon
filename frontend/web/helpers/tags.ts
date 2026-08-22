import type { Tag, TagGroups, TagType } from "@/types/api";

export const TAG_SECTIONS: Array<{ key: TagType; title: string }> = [
  { key: "nationality", title: "Nationality" },
  { key: "continent", title: "Continent" },
  { key: "hobby", title: "Hobby" },
  { key: "community", title: "Community" },
];

export const EMPTY_TAG_GROUPS: TagGroups = {
  nationality: [],
  continent: [],
  hobby: [],
  community: [],
};

export type SectionQueries = Record<TagType, string>;

export const EMPTY_SECTION_QUERIES: SectionQueries = {
  nationality: "",
  continent: "",
  hobby: "",
  community: "",
};

export function toggleTagId(selectedIds: number[], tagId: number): number[] {
  return selectedIds.includes(tagId) ? selectedIds.filter((id) => id !== tagId) : [...selectedIds, tagId];
}

export function updateSectionQuery(queries: SectionQueries, section: TagType, value: string): SectionQueries {
  return { ...queries, [section]: value };
}

export function filterTagGroupsBySectionQuery(groups: TagGroups, queries: SectionQueries): TagGroups {
  const filtered: TagGroups = { nationality: [], continent: [], hobby: [], community: [] };
  for (const { key } of TAG_SECTIONS) {
    const needle = queries[key].trim().toLowerCase();
    filtered[key] = needle
      ? groups[key].filter((tag) => tag.label.toLowerCase().includes(needle))
      : groups[key];
  }
  return filtered;
}

export function isAutosuggestOnlySection(section: TagType): boolean {
  return section === "nationality" || section === "hobby";
}

export function autosuggestHint(section: TagType): string | null {
  if (section === "nationality") return "Start typing to search all countries.";
  if (section === "hobby") return "Start typing to search hobbies.";
  return null;
}

export function visibleTagsForSection(
  section: TagType,
  filteredGroups: TagGroups,
  queries: SectionQueries,
  selectedTagIds: number[] = []
) {
  const selectedSet = new Set(selectedTagIds);
  if (isAutosuggestOnlySection(section) && !queries[section].trim()) {
    return [];
  }
  return filteredGroups[section].filter((tag) => !selectedSet.has(tag.id));
}

export function selectedTagsForSection(
  section: TagType,
  groups: TagGroups,
  selectedTagIds: number[]
) {
  const selectedSet = new Set(selectedTagIds);
  return groups[section].filter((tag) => selectedSet.has(tag.id));
}

export function mergeOwnedTags(profileTags: Tag[], catalog: TagGroups, followedIds: number[]): Tag[] {
  const byId = new Map<number, Tag>();
  for (const tag of profileTags) byId.set(tag.id, tag);
  const followed = new Set(followedIds);
  for (const group of Object.values(catalog)) {
    for (const tag of group) {
      if (followed.has(tag.id)) byId.set(tag.id, tag);
    }
  }
  return [...byId.values()];
}
