"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { CourseTags } from "@/components/CourseTags";
import { DisciplineProgram } from "@/components/DisciplineProgram";
import { SchoolVerification } from "@/components/SchoolVerification";
import { TagChipRow } from "@/components/TagChip";
import { clientFetch } from "@/helpers/client-api";
import {
  CAMPUS_SCHOOL_BLURB,
  countryChangeHint,
  countryChangeLockedMessage,
  countryLimitMessage,
  countrySectionTitle,
  countrySlotForTag,
  formatNextChangeAvailable,
  lockedCountryIds,
  ECHO_TAGS_SUBTITLE,
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  autosuggestHint,
  canAddFollowedTag,
  displayTagLabel,
  filterTagGroupsBySectionQuery,
  followedIdsWithoutLockedRegions,
  followedTagLimitReachedMessage,
  followedTagsPayload,
  isNationalityTagId,
  isRegionTagId,
  knownTagIdsFromGroups,
  regionLimitMessage,
  retainKnown,
  sameTagIdSet,
  selectedCountryCount,
  selectedRegionCount,
  selectedTagsForSection,
  toggleItem,
  UNSAVED_TAG_CHANGES_PROMPT,
  updateSectionQuery,
  visibleTagsForSection,
} from "@/helpers/tags";
import type { CountrySlot, FollowedTags, TagGroups, UserProfile } from "@/types/api";

export function FollowTagsForm({ onDone }: { onDone?: () => void } = {}) {
  const [tagGroups, setTagGroups] = useState<TagGroups>(EMPTY_TAG_GROUPS);
  const [sectionQueries, setSectionQueries] = useState(EMPTY_SECTION_QUERIES);
  const [followedTagIds, setFollowedTagIds] = useState<number[]>([]);
  const [savedFollowedTagIds, setSavedFollowedTagIds] = useState<number[]>([]);
  const [countrySlots, setCountrySlots] = useState<CountrySlot[]>([]);
  const [tagLimit, setTagLimit] = useState(2);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canFollowRegion, setCanFollowRegion] = useState(false);
  const [countryLimit, setCountryLimit] = useState<number | null>(null);
  const [regionLimit, setRegionLimit] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const filteredTagGroups = useMemo(
    () => filterTagGroupsBySectionQuery(tagGroups, sectionQueries),
    [tagGroups, sectionQueries]
  );
  const dirty = useMemo(
    () => !sameTagIdSet(followedTagIds, savedFollowedTagIds),
    [followedTagIds, savedFollowedTagIds]
  );
  const canSave = dirty && !saving;
  const countedFollowedIds = followedTagIds.filter(
    (id) => !isNationalityTagId(tagGroups, id) && !isRegionTagId(tagGroups, id)
  );
  const atTagLimit = !isAdmin && countedFollowedIds.length >= tagLimit;
  const countryCount = selectedCountryCount(tagGroups, followedTagIds);
  const regionCount = selectedRegionCount(tagGroups, followedTagIds);
  const lockedCountryTagIds = lockedCountryIds(countrySlots);
  const selectedCountries = selectedTagsForSection("nationality", tagGroups, followedTagIds);

  useEffect(() => {
    Promise.all([
      clientFetch<TagGroups>("/tags"),
      clientFetch<FollowedTags>("/users/me/followed-tags"),
      clientFetch<UserProfile>("/users/me"),
    ])
      .then(([groups, followed, me]) => {
        setTagGroups(groups);
        const ids = followedIdsWithoutLockedRegions(
          retainKnown(followed.tag_ids, knownTagIdsFromGroups(groups)),
          groups,
          Boolean(me.can_follow_region)
        );
        setFollowedTagIds(ids);
        setSavedFollowedTagIds(ids);
        setCountrySlots(followed.country_slots ?? []);
        setTagLimit(me.followed_tag_limit ?? 2);
        setSchoolVerified(me.is_verified);
        setIsAdmin(me.is_admin);
        setCanFollowRegion(Boolean(me.can_follow_region));
        setCountryLimit(me.country_slot_limit ?? null);
        setRegionLimit(me.region_slot_limit ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load tags"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dirty || onDone) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      } catch {
        return;
      }
      if (!window.confirm(UNSAVED_TAG_CHANGES_PROMPT)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, onDone]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [success]);

  function toggleFollow(tagId: number) {
    if (
      !isAdmin &&
      regionLimit != null &&
      isRegionTagId(tagGroups, tagId) &&
      !followedTagIds.includes(tagId) &&
      selectedRegionCount(tagGroups, followedTagIds) >= regionLimit
    ) {
      setError(regionLimitMessage(regionLimit));
      setSuccess(null);
      return;
    }
    if (isNationalityTagId(tagGroups, tagId) && followedTagIds.includes(tagId)) {
      const slot = countrySlotForTag(countrySlots, tagId);
      if (slot?.locked) {
        setError(countryChangeLockedMessage(slot.next_change_at));
        setSuccess(null);
        return;
      }
    }
    if (
      !isAdmin &&
      countryLimit != null &&
      isNationalityTagId(tagGroups, tagId) &&
      !followedTagIds.includes(tagId) &&
      selectedCountryCount(tagGroups, followedTagIds) >= countryLimit
    ) {
      setError(countryLimitMessage(countryLimit));
      setSuccess(null);
      return;
    }
    const countedIds = followedTagIds.filter(
      (id) => !isNationalityTagId(tagGroups, id) && !isRegionTagId(tagGroups, id)
    );
    if (
      !isAdmin &&
      !isNationalityTagId(tagGroups, tagId) &&
      !isRegionTagId(tagGroups, tagId) &&
      !canAddFollowedTag(countedIds, tagId, tagLimit)
    ) {
      setError(followedTagLimitReachedMessage(tagLimit));
      setSuccess(null);
      return;
    }
    setFollowedTagIds((current) => toggleItem(current, tagId));
    setError(null);
    setSuccess(null);
  }

  async function saveFollowedTags(): Promise<boolean> {
    if (!canSave) return !dirty;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const saved = await clientFetch<FollowedTags>("/users/me/followed-tags", {
        method: "PUT",
        body: JSON.stringify(followedTagsPayload(tagGroups, followedTagIds)),
      });
      setFollowedTagIds(saved.tag_ids);
      setSavedFollowedTagIds(saved.tag_ids);
      setCountrySlots(saved.country_slots ?? []);
      setSuccess("Tags saved");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save followed tags");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function finishSetup() {
    if (dirty) {
      const saved = await saveFollowedTags();
      if (!saved) return;
    }
    onDone?.();
  }

  return (
    <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="font-display text-xl font-bold">Echo Tags</h1>
          {onDone ? null : (
            <Link href="/profile" className="text-sm text-signal-400 hover:text-signal-300">
              Back to profile
            </Link>
          )}
        </div>
        <p className="text-parchment-500 text-sm mb-4">{ECHO_TAGS_SUBTITLE}</p>

        {loading ? (
          <p className="text-parchment-500 font-mono text-sm">Loading tags…</p>
        ) : (
          <div className="space-y-4">
            <div className="card">
              <p className="text-sm font-medium">{countrySectionTitle(countryLimit)}</p>
              <p className="text-parchment-500 text-xs mt-1 mb-3">
                {isAdmin ? "Choose the country communities you want Echoes matched with." : countryChangeHint(countryLimit)}
              </p>
              {selectedCountries.length > 0 && (
                <div className="mb-3">
                  <p className="text-parchment-500 text-xs font-mono mb-2">Selected</p>
                  <TagChipRow
                    tags={selectedCountries}
                    selectedIds={followedTagIds}
                    onToggle={toggleFollow}
                    lockedIds={lockedCountryTagIds}
                  />
                  {selectedCountries.map((tag) => {
                    const slot = countrySlotForTag(countrySlots, tag.id);
                    const next = slot?.locked ? formatNextChangeAvailable(slot.next_change_at) : null;
                    return next ? (
                      <p key={tag.id} className="text-parchment-500 text-xs font-mono mt-2">
                        {displayTagLabel(tag.label)} — {next}
                      </p>
                    ) : null;
                  })}
                </div>
              )}
              <input
                type="text"
                className="input-field mb-2 text-sm py-2"
                placeholder="Search by country..."
                value={sectionQueries.nationality}
                onChange={(e) => setSectionQueries((prev) => updateSectionQuery(prev, "nationality", e.target.value))}
              />
              {autosuggestHint("nationality") && !sectionQueries.nationality.trim() && (
                <p className="text-parchment-500 text-xs mb-2">{autosuggestHint("nationality")}</p>
              )}
              <TagChipRow
                tags={visibleTagsForSection("nationality", filteredTagGroups, sectionQueries, followedTagIds)}
                selectedIds={followedTagIds}
                onToggle={toggleFollow}
              />
              <p className={`text-xs font-mono mt-3 ${countryLimit != null && countryCount >= countryLimit && !isAdmin ? "text-signal-400" : "text-parchment-500"}`}>
                {countryLimit == null ? `${countryCount} selected` : `${countryCount} of ${countryLimit} selected`}
              </p>
            </div>

            {canFollowRegion ? (
            <div className="card">
              <p className="text-sm font-medium mb-2">Regional Communities</p>
              <p className="text-parchment-500 text-xs mb-3">Choose the regional communities you want Echoes matched with.</p>
                  {selectedTagsForSection("region", tagGroups, followedTagIds).length > 0 && (
                    <div className="mb-3">
                      <p className="text-parchment-500 text-xs font-mono mb-2">Selected</p>
                      <TagChipRow
                        tags={selectedTagsForSection("region", tagGroups, followedTagIds)}
                        selectedIds={followedTagIds}
                        onToggle={toggleFollow}
                      />
                    </div>
                  )}
                  <input
                    type="text"
                    className="input-field mb-2 text-sm py-2"
                    placeholder="Search regional communities"
                    value={sectionQueries.region}
                    onChange={(e) => setSectionQueries((prev) => updateSectionQuery(prev, "region", e.target.value))}
                  />
                  <TagChipRow
                    tags={visibleTagsForSection("region", filteredTagGroups, sectionQueries, followedTagIds)}
                    selectedIds={followedTagIds}
                    onToggle={toggleFollow}
                  />
                  <p className={`text-xs font-mono mt-3 ${regionLimit != null && regionCount >= regionLimit && !isAdmin ? "text-signal-400" : "text-parchment-500"}`}>
                    {regionLimit == null ? `${regionCount} selected` : `${regionCount} of ${regionLimit} selected`}
                  </p>
            </div>
            ) : null}

            <div id="school-community" className="card">
              <p className="text-sm font-medium mb-1">School Community</p>
              <p className="text-parchment-500 text-sm mb-3">{CAMPUS_SCHOOL_BLURB}</p>
              <SchoolVerification
                onVerifiedChange={(verified) => {
                  setSchoolVerified(verified);
                }}
              />
              {schoolVerified && (
                <div className="mt-4 space-y-4">
                  <DisciplineProgram />
                  <div>
                    <p className="text-sm font-medium mb-2">Course tags</p>
                    <CourseTags />
                  </div>
                </div>
              )}
            </div>

            <div className="card">
              <p className="text-sm font-medium mb-2">Personal interests</p>
              {selectedTagsForSection("hobby", tagGroups, followedTagIds).length > 0 && (
                <div className="mb-3">
                  <p className="text-parchment-500 text-xs font-mono mb-2">Selected</p>
                  <TagChipRow
                    tags={selectedTagsForSection("hobby", tagGroups, followedTagIds)}
                    selectedIds={followedTagIds}
                    onToggle={toggleFollow}
                  />
                </div>
              )}
              <input
                type="text"
                className="input-field mb-2 text-sm py-2"
                placeholder="Search interests"
                value={sectionQueries.hobby}
                onChange={(e) => setSectionQueries((prev) => updateSectionQuery(prev, "hobby", e.target.value))}
              />
              {autosuggestHint("hobby") && !sectionQueries.hobby.trim() && (
                <p className="text-parchment-500 text-xs mb-2">{autosuggestHint("hobby")}</p>
              )}
              <TagChipRow
                tags={visibleTagsForSection("hobby", filteredTagGroups, sectionQueries, followedTagIds)}
                selectedIds={followedTagIds}
                onToggle={toggleFollow}
              />
            </div>

            <div className="card">
              {atTagLimit && <p className="text-signal-400 text-xs mb-3">{followedTagLimitReachedMessage(tagLimit)}</p>}
              <button
                type="button"
                className="btn-primary w-full"
                disabled={onDone ? saving : !canSave}
                onClick={() => void (onDone ? finishSetup() : saveFollowedTags())}
              >
                {saving ? "Saving…" : onDone ? "Finish setup" : "Save"}
              </button>
            </div>
          </div>
        )}

        {success && <p className="text-signal-400 text-sm mt-3">{success}</p>}
        {error && <p className="text-rust-400 text-sm mt-3">{error}</p>}
    </main>
  );
}
