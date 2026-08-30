import type { CountrySlot, CountedTagType, Tag, TagGroups } from "@/types/api";

export const TAG_SECTIONS: Array<{ key: CountedTagType; title: string }> = [
  { key: "nationality", title: "Country Communities" },
  { key: "region", title: "Regional Communities" },
  { key: "hobby", title: "Personal interests" },
];

export const ECHO_TAGS_SUBTITLE = "Choose the communities and interests you want to connect with.";
export const FREE_REACH_LABEL = "10 km reach";
export const COUNTRY_COMMUNITY_LIMIT = 2;
export const COUNTRY_SLOT_CHANGE_DAYS = 30;
export const AMPLIFY_LABEL = "AMPLIFY";
export const AMPLIFY_BLURB = "Reach related communities across multiple countries with one selection.";
export const AMPLIFY_EXAMPLES = ["Sub-Saharan Africa", "Caribbean", "South Asia"] as const;
export const AMPLIFY_PRICE_HINT = "Available with Amplify · $30/mo";
export const PAID_REACH_LABEL = "Up to 100 km reach";
export const AMPLIFY_AUDIENCE_LABEL = "Amplify audience";
export const CAMPUS_SCHOOL_BLURB = "Connect with students from your verified institution.";
export const CAMPUS_PLAN_HINT = "Campus · $5/mo";
export function countrySlotLimit(plan: PlanId): number | null {
  if (plan === "amplify") return null;
  if (plan === "free") return 1;
  return 2;
}

export function countrySectionTitle(limit: number | null): string {
  return limit === 1 ? "Country Community" : "Country Communities";
}

export function countryChangeHint(limit: number | null): string {
  if (limit == null) return "Choose the country communities you want Echoes matched with.";
  if (limit === 1) return "You can change your country community once every 30 days.";
  return "Each community can be replaced once every 30 days.";
}

export function countryLimitMessage(limit: number): string {
  if (limit === 1) {
    return "You've reached your 1-country limit. You can replace this community once the 30-day change window ends.";
  }
  return `You've reached your ${limit}-country limit. Replace a community that is not in its 30-day change window, or upgrade to Amplify for regional communities.`;
}

export function formatNextChangeAvailable(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `Next change available: ${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
}

export function countryChangeLockedMessage(nextChangeAt: string | null | undefined): string {
  const formatted = formatNextChangeAvailable(nextChangeAt);
  if (!formatted) return "This country community is in its 30-day change window.";
  return `You can change this country community again on ${formatted.replace("Next change available: ", "")}.`;
}

export function lockedCountryIds(slots: CountrySlot[]): number[] {
  return slots.flatMap((slot) => (slot.locked && slot.tag_id != null ? [slot.tag_id] : []));
}

export function countrySlotForTag(slots: CountrySlot[], tagId: number): CountrySlot | undefined {
  return slots.find((slot) => slot.tag_id === tagId);
}

export const COUNTRY_LIMIT_MESSAGE = countryLimitMessage(COUNTRY_COMMUNITY_LIMIT);
export const REGION_INFO_SUBTITLE = "Targets country communities within this geographic region.";

export type PlanId = "free" | "campus" | "connect" | "amplify";
export type AccountType = "individual" | "business";

export const PLANS: Record<PlanId, { name: string; price: string; meaning: string }> = {
  free: { name: "Free", price: "$0", meaning: "Try EchoToCrowd locally" },
  campus: { name: "Campus", price: "$5/mo", meaning: "Connect for verified students" },
  connect: { name: "Connect", price: "$7/mo", meaning: "Full individual experience" },
  amplify: { name: "Amplify", price: "$30/mo", meaning: "Advanced audience targeting" },
};

export function resolvePlan(isVerified: boolean, isAdmin = false, accountType: AccountType = "individual"): PlanId {
  if (isAdmin || accountType === "business") return "amplify";
  if (isVerified) return "campus";
  return "free";
}

export function displayTagLabel(label: string): string {
  return label.replace(" / Hispanic", "");
}

export function selectedCountryCount(groups: TagGroups, selectedIds: number[]): number {
  return selectedTagsForSection("nationality", groups, selectedIds).length;
}

export function planDetailLine(plan: PlanId): string {
  if (plan === "free") return `${PLANS.free.price} · ${FREE_REACH_LABEL} · 1 country community`;
  if (plan === "amplify") return `${PLANS.amplify.price} · ${PAID_REACH_LABEL} · ${AMPLIFY_AUDIENCE_LABEL}`;
  return `${PLANS[plan].price} · ${PAID_REACH_LABEL} · 2 country communities`;
}

export function countrySelectionLine(count: number, limit: number | null, isAdmin: boolean): string {
  if (isAdmin || limit == null) return `${count} country communities selected`;
  return `${count} of ${limit} country communities selected`;
}

export function isNationalityTagId(groups: TagGroups, tagId: number): boolean {
  return groups.nationality.some((tag) => tag.id === tagId);
}

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

export function toggleItem<T>(selected: T[], value: T): T[] {
  return selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value];
}

export function echoAudienceLabels(tags: Tag[], courseCodes?: string[] | null, courseCode?: string | null): string[] {
  const courses = courseCodes?.length ? courseCodes : courseCode ? [courseCode] : [];
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const label of [...tags.map((tag) => tag.label), ...courses]) {
    if (!label || seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
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
  if (section === "hobby") return "Start typing to search interests.";
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
    return `You've used all ${limit} free tags. Remove a country or interest to add another — school and course tags don't count.`;
  }
  return `You've used all ${limit} tags. Deselect one to add another.`;
}

export const REGIONAL_TAGS_PREMIUM_LABEL = "AMPLIFY";
export const REGIONAL_TAGS_PREMIUM_HINT = "Available with Amplify · $30/mo";
export const REGIONAL_TAGS_LOCKED_MESSAGE =
  "Amplify audience is part of Amplify ($30/mo). Campus and Connect can still target up to 100 km.";

export function canFollowRegionTags(
  isVerified: boolean,
  isAdmin = false,
  accountType: AccountType = "individual"
): boolean {
  return resolvePlan(isVerified, isAdmin, accountType) === "amplify";
}

export function isRegionTagId(groups: TagGroups, tagId: number): boolean {
  return groups.region.some((tag) => tag.id === tagId);
}

export function followedIdsWithoutLockedRegions(
  selectedIds: number[],
  groups: TagGroups,
  isVerified: boolean,
  isAdmin = false,
  accountType: AccountType = "individual"
): number[] {
  if (canFollowRegionTags(isVerified, isAdmin, accountType)) return selectedIds;
  const regionIds = new Set(groups.region.map((tag) => tag.id));
  return selectedIds.filter((id) => !regionIds.has(id));
}

export function retainKnown<T>(selected: T[], known: T[]): T[] {
  const valid = new Set(known);
  const next = selected.filter((item) => valid.has(item));
  return next.length === selected.length ? selected : next;
}

export type FeedSearchChip =
  | { key: string; label: string; selected: boolean; kind: "tag"; id: number }
  | { key: string; label: string; selected: boolean; kind: "course"; code: string };

export function feedSearchChips(
  tags: Tag[],
  selectedTagIds: number[],
  courseCodes: string[],
  selectedCourseCodes: string[]
): FeedSearchChip[] {
  return [
    ...tags.map((tag) => ({
      key: `tag:${tag.id}`,
      label: tag.label,
      selected: selectedTagIds.includes(tag.id),
      kind: "tag" as const,
      id: tag.id,
    })),
    ...courseCodes.map((code) => ({
      key: `course:${code}`,
      label: code,
      selected: selectedCourseCodes.includes(code),
      kind: "course" as const,
      code,
    })),
  ];
}

export function audienceFilterActive(tagIds: number[], courseCodes: string[]): boolean {
  return tagIds.length > 0 || courseCodes.length > 0;
}

export function pathWithTagQuery(
  path: string,
  filters: { tagIds?: number[]; courseCodes?: string[]; extra?: Record<string, string> } = {}
): string {
  const params = new URLSearchParams(filters.extra);
  if (filters.tagIds?.length) params.set("tags", filters.tagIds.join(","));
  if (filters.courseCodes?.length) params.set("courses", filters.courseCodes.join(","));
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
