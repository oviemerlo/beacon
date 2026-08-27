import type { CountedTagType, TagGroups } from "../types/api";

export const TAG_SECTIONS: Array<{ key: CountedTagType; title: string }> = [
  { key: "nationality", title: "Nationality" },
  { key: "region", title: "Region" },
  { key: "hobby", title: "Hobby" },
];

function emptyTagGroups(): TagGroups {
  return { nationality: [], region: [], hobby: [] };
}

export const EMPTY_TAG_GROUPS: TagGroups = emptyTagGroups();

export type SectionQueries = Record<CountedTagType, string>;

export const EMPTY_SECTION_QUERIES: SectionQueries = {
  nationality: "",
  region: "",
  hobby: "",
};

export const UNSAVED_TAG_CHANGES_PROMPT = "You have unsaved tag changes, save before leaving?";

export type FollowedTagsPayload = {
  nationality: number[];
  region: number[];
  school: number[];
  hobby: number[];
};

export function toggleTagId(selectedIds: number[], tagId: number): number[] {
  return selectedIds.includes(tagId) ? selectedIds.filter((id) => id !== tagId) : [...selectedIds, tagId];
}

export function updateSectionQuery(queries: SectionQueries, section: CountedTagType, value: string): SectionQueries {
  return { ...queries, [section]: value };
}

export function filterTagGroupsBySectionQuery(groups: TagGroups, queries: SectionQueries): TagGroups {
  const filtered = emptyTagGroups();
  for (const { key } of TAG_SECTIONS) {
    const needle = queries[key].trim().toLowerCase();
    filtered[key] = needle
      ? groups[key].filter((tag) => tag.label.toLowerCase().includes(needle))
      : groups[key];
  }
  return filtered;
}

export function isAutosuggestOnlySection(section: CountedTagType): boolean {
  return section === "nationality" || section === "hobby";
}

export function autosuggestHint(section: CountedTagType): string | null {
  if (section === "nationality") return "Start typing to search all countries.";
  if (section === "hobby") return "Start typing to search hobbies.";
  return null;
}

export function visibleTagsForSection(
  section: CountedTagType,
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
  section: CountedTagType,
  groups: TagGroups,
  selectedTagIds: number[]
) {
  const selectedSet = new Set(selectedTagIds);
  return groups[section].filter((tag) => selectedSet.has(tag.id));
}

export function followedTagsPayload(groups: TagGroups, selectedIds: number[]): FollowedTagsPayload {
  const payload: FollowedTagsPayload = { nationality: [], region: [], school: [], hobby: [] };
  for (const { key } of TAG_SECTIONS) {
    payload[key] = selectedTagsForSection(key, groups, selectedIds).map((tag) => tag.id);
  }
  return payload;
}

export function sameTagIdSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((id, i) => id === right[i]);
}

export function knownTagIdsFromGroups(groups: TagGroups): number[] {
  return TAG_SECTIONS.flatMap(({ key }) => groups[key].map((tag) => tag.id));
}

export function canAddFollowedTag(selectedIds: number[], tagId: number, limit: number): boolean {
  return selectedIds.includes(tagId) || selectedIds.length < limit;
}

export function followedTagLimitReachedMessage(limit: number): string {
  if (limit <= 2) {
    return `You've used all ${limit} free tags. Deselect one to add another — school and course tags don't count.`;
  }
  return `You've used all ${limit} tags. Deselect one to add another.`;
}

export const REGIONAL_TAGS_PREMIUM_LABEL = "Premium";
export const REGIONAL_TAGS_PREMIUM_HINT = "Available to premium subscribers.";
export const REGIONAL_TAGS_LOCKED_MESSAGE =
  "Region tags are available to premium subscribers. Free accounts can follow country, hobby, school, and course tags.";

export function canFollowRegionTags(isVerified: boolean, isAdmin = false): boolean {
  return isAdmin || isVerified;
}

export function isRegionTagId(groups: TagGroups, tagId: number): boolean {
  return groups.region.some((tag) => tag.id === tagId);
}

export function followedIdsWithoutLockedRegions(
  selectedIds: number[],
  groups: TagGroups,
  isVerified: boolean,
  isAdmin = false
): number[] {
  if (canFollowRegionTags(isVerified, isAdmin)) return selectedIds;
  const regionIds = new Set(groups.region.map((tag) => tag.id));
  return selectedIds.filter((id) => !regionIds.has(id));
}

export function retainKnownTagIds(selectedIds: number[], knownIds: number[]): number[] {
  const valid = new Set(knownIds);
  const next = selectedIds.filter((id) => valid.has(id));
  return next.length === selectedIds.length ? selectedIds : next;
}

export function pathWithTagQuery(path: string, tagIds: number[], extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (tagIds.length > 0) params.set("tags", tagIds.join(","));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
