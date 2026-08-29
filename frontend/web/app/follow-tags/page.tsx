"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";
import { CourseTags } from "@/components/CourseTags";
import { SchoolVerification } from "@/components/SchoolVerification";
import { TagChipRow } from "@/components/TagChip";
import { clientFetch } from "@/helpers/client-api";
import {
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  autosuggestHint,
  canAddFollowedTag,
  canFollowRegionTags,
  filterTagGroupsBySectionQuery,
  followedIdsWithoutLockedRegions,
  followedTagLimitReachedMessage,
  followedTagsPayload,
  isRegionTagId,
  knownTagIdsFromGroups,
  REGIONAL_TAGS_LOCKED_MESSAGE,
  REGIONAL_TAGS_PREMIUM_HINT,
  REGIONAL_TAGS_PREMIUM_LABEL,
  retainKnown,
  sameTagIdSet,
  selectedTagsForSection,
  TAG_SECTIONS,
  toggleItem,
  UNSAVED_TAG_CHANGES_PROMPT,
  updateSectionQuery,
  visibleTagsForSection,
} from "@/helpers/tags";
import type { TagGroups, UserProfile } from "@/types/api";

export default function FollowTagsPage() {
  const [tagGroups, setTagGroups] = useState<TagGroups>(EMPTY_TAG_GROUPS);
  const [sectionQueries, setSectionQueries] = useState(EMPTY_SECTION_QUERIES);
  const [followedTagIds, setFollowedTagIds] = useState<number[]>([]);
  const [savedFollowedTagIds, setSavedFollowedTagIds] = useState<number[]>([]);
  const [tagLimit, setTagLimit] = useState(2);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [canFollowRegion, setCanFollowRegion] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
  const atTagLimit = !isAdmin && followedTagIds.length >= tagLimit;
  const tagLimitHint = isAdmin
    ? `${followedTagIds.length} tags`
    : atTagLimit
      ? followedTagLimitReachedMessage(tagLimit)
      : `${followedTagIds.length} of ${tagLimit} tags`;

  useEffect(() => {
    Promise.all([
      clientFetch<TagGroups>("/tags"),
      clientFetch<{ tag_ids: number[] }>("/users/me/followed-tags"),
      clientFetch<UserProfile>("/users/me"),
    ])
      .then(([groups, followed, me]) => {
        setTagGroups(groups);
        const ids = followedIdsWithoutLockedRegions(
          retainKnown(followed.tag_ids, knownTagIdsFromGroups(groups)),
          groups,
          me.is_verified,
          me.is_admin
        );
        setFollowedTagIds(ids);
        setSavedFollowedTagIds(ids);
        setTagLimit(me.followed_tag_limit ?? 2);
        setSchoolVerified(me.is_verified);
        setIsAdmin(me.is_admin);
        setCanFollowRegion(canFollowRegionTags(me.is_verified, me.is_admin));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load tags"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!dirty) return;
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
  }, [dirty]);

  useEffect(() => {
    if (!success) return;
    const timeout = window.setTimeout(() => setSuccess(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [success]);

  function toggleFollow(tagId: number) {
    if (isRegionTagId(tagGroups, tagId) && !canFollowRegion && !followedTagIds.includes(tagId)) {
      setError(REGIONAL_TAGS_LOCKED_MESSAGE);
      setSuccess(null);
      return;
    }
    if (!isAdmin && !canAddFollowedTag(followedTagIds, tagId, tagLimit)) {
      setError(followedTagLimitReachedMessage(tagLimit));
      setSuccess(null);
      return;
    }
    setFollowedTagIds((current) => toggleItem(current, tagId));
    setError(null);
    setSuccess(null);
  }

  async function saveFollowedTags() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await clientFetch<{ tag_ids: number[] }>("/users/me/followed-tags", {
        method: "PUT",
        body: JSON.stringify(followedTagsPayload(tagGroups, followedTagIds)),
      });
      const fresh = await clientFetch<{ tag_ids: number[] }>("/users/me/followed-tags");
      setFollowedTagIds(fresh.tag_ids);
      setSavedFollowedTagIds(fresh.tag_ids);
      setSuccess("Tags saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save followed tags");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-xl font-bold">Echo Tags</h1>
          <Link href="/profile" className="text-sm text-signal-400 hover:text-signal-300">
            Back to profile
          </Link>
        </div>

        {loading ? (
          <p className="text-parchment-500 font-mono text-sm">Loading tags…</p>
        ) : (
          <div className="card">
            {TAG_SECTIONS.map(({ key, title }) => {
              const selected = selectedTagsForSection(key, tagGroups, followedTagIds);
              const visible = visibleTagsForSection(key, filteredTagGroups, sectionQueries, followedTagIds);
              const regionLocked = key === "region" && !canFollowRegion;
              return (
              <div key={key}>
                {key === "hobby" && (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-medium mb-2">School</p>
                      <SchoolVerification
                        onVerifiedChange={(verified) => {
                          setSchoolVerified(verified);
                          setCanFollowRegion(canFollowRegionTags(verified, isAdmin));
                        }}
                      />
                    </div>
                    {schoolVerified && (
                      <div className="mb-4">
                        <p className="text-sm font-medium mb-2">Course tags</p>
                        <CourseTags />
                      </div>
                    )}
                  </>
                )}
                <div className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium">{title}</p>
                    {key === "region" && (
                      <span className="text-[10px] font-mono uppercase tracking-wide text-signal-400 border border-signal-500/50 rounded-full px-2 py-0.5">
                        {REGIONAL_TAGS_PREMIUM_LABEL}
                      </span>
                    )}
                  </div>
                  {key === "region" && (
                    <p className="text-parchment-500 text-xs mb-2">
                      {regionLocked ? REGIONAL_TAGS_LOCKED_MESSAGE : REGIONAL_TAGS_PREMIUM_HINT}
                    </p>
                  )}
                  {selected.length > 0 && (
                    <div className="mb-2">
                      <p className="text-parchment-500 text-xs font-mono mb-2">Following</p>
                      <TagChipRow tags={selected} selectedIds={followedTagIds} onToggle={toggleFollow} locked={regionLocked} />
                    </div>
                  )}
                  <input
                    type="text"
                    className="input-field mb-2 text-sm py-2"
                    placeholder={`Search ${title.toLowerCase()} tags`}
                    value={sectionQueries[key]}
                    onChange={(e) => setSectionQueries((prev) => updateSectionQuery(prev, key, e.target.value))}
                  />
                  {autosuggestHint(key) && !sectionQueries[key].trim() && (
                    <p className="text-parchment-500 text-xs mb-2">{autosuggestHint(key)}</p>
                  )}
                  <TagChipRow tags={visible} selectedIds={followedTagIds} onToggle={toggleFollow} locked={regionLocked} />
                </div>
              </div>
              );
            })}
            <div className="mt-5 pt-4 border-t border-dusk-700">
              <p className={`text-xs mb-3 ${atTagLimit ? "text-signal-400" : "text-parchment-500 font-mono"}`}>
                {tagLimitHint}
              </p>
              <button type="button" className="btn-primary w-full" disabled={!canSave} onClick={saveFollowedTags}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}

        {success && <p className="text-signal-400 text-sm mt-3">{success}</p>}
        {error && <p className="text-rust-400 text-sm mt-3">{error}</p>}
      </main>
    </div>
  );
}
