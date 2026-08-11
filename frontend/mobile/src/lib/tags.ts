import type { TagGroups, TagType } from "../types/api";

export const TAG_SECTIONS: Array<{ key: TagType; title: string }> = [
  { key: "nationality", title: "Nationality" },
  { key: "hobby", title: "Hobby" },
  { key: "community", title: "Community" },
];

export const EMPTY_TAG_GROUPS: TagGroups = {
  nationality: [],
  hobby: [],
  community: [],
};

export type SectionQueries = Record<TagType, string>;

export const EMPTY_SECTION_QUERIES: SectionQueries = {
  nationality: "",
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
  const filtered: TagGroups = { nationality: [], hobby: [], community: [] };
  for (const { key } of TAG_SECTIONS) {
    const needle = queries[key].trim().toLowerCase();
    filtered[key] = needle
      ? groups[key].filter((tag) => tag.label.toLowerCase().includes(needle))
      : groups[key];
  }
  return filtered;
}

export function isAutosuggestOnlySection(section: TagType): boolean {
  return section === "nationality";
}

export function visibleTagsForSection(
  section: TagType,
  filteredGroups: TagGroups,
  queries: SectionQueries
) {
  if (isAutosuggestOnlySection(section) && !queries[section].trim()) {
    return [];
  }
  return filteredGroups[section];
}
