"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";
import { SchoolVerification } from "@/components/SchoolVerification";
import { clientFetch } from "@/helpers/client-api";
import {
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  autosuggestHint,
  filterTagGroupsBySectionQuery,
  selectedTagsForSection,
  TAG_SECTIONS,
  updateSectionQuery,
  visibleTagsForSection,
} from "@/helpers/tags";
import type { TagGroups } from "@/types/api";

export default function FollowTagsPage() {
  const [tagGroups, setTagGroups] = useState<TagGroups>(EMPTY_TAG_GROUPS);
  const [sectionQueries, setSectionQueries] = useState(EMPTY_SECTION_QUERIES);
  const [followedTagIds, setFollowedTagIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filteredTagGroups = useMemo(
    () => filterTagGroupsBySectionQuery(tagGroups, sectionQueries),
    [tagGroups, sectionQueries]
  );

  useEffect(() => {
    Promise.all([clientFetch<TagGroups>("/tags"), clientFetch<{ tag_ids: number[] }>("/users/me/followed-tags")])
      .then(([groups, followed]) => {
        setTagGroups(groups);
        setFollowedTagIds(followed.tag_ids);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load tags"))
      .finally(() => setLoading(false));
  }, []);

  async function toggleFollow(tagId: number) {
    const followed = followedTagIds.includes(tagId);
    const next = followed ? followedTagIds.filter((id) => id !== tagId) : [...followedTagIds, tagId];
    setFollowedTagIds(next);
    try {
      await clientFetch(`/users/me/followed-tags/${tagId}`, { method: followed ? "DELETE" : "PUT" });
    } catch (err) {
      setFollowedTagIds(followedTagIds);
      setError(err instanceof Error ? err.message : "Could not update followed tags");
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="font-display text-xl font-bold">Follow tags</h1>
          <Link href="/profile" className="text-sm text-signal-400 hover:text-signal-300">
            Back to profile
          </Link>
        </div>

        {loading ? (
          <p className="text-parchment-500 font-mono text-sm">Loading tags…</p>
        ) : (
          <div className="card">
            {TAG_SECTIONS.map(({ key, title }) => (
              <div key={key}>
                {key === "hobby" && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">School</p>
                    <SchoolVerification />
                  </div>
                )}
                <div className="mb-4 last:mb-0">
                  <p className="text-sm font-medium mb-2">{title}</p>
                  {selectedTagsForSection(key, tagGroups, followedTagIds).length > 0 && (
                    <div className="mb-2">
                      <p className="text-parchment-500 text-xs font-mono mb-2">Following</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedTagsForSection(key, tagGroups, followedTagIds).map((tag) => (
                          <button
                            key={tag.id}
                            onClick={() => toggleFollow(tag.id)}
                            className="tag-pill tag-pill-active"
                          >
                            {tag.label}
                          </button>
                        ))}
                      </div>
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
                  <div className="flex flex-wrap gap-2">
                    {visibleTagsForSection(key, filteredTagGroups, sectionQueries, followedTagIds).map((tag) => {
                      const selected = followedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          onClick={() => toggleFollow(tag.id)}
                          className={`tag-pill ${selected ? "tag-pill-active" : ""}`}
                        >
                          {tag.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-rust-400 text-sm mt-3">{error}</p>}
      </main>
    </div>
  );
}
