"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/lib/client-api";
import {
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  filterTagGroupsBySectionQuery,
  isAutosuggestOnlySection,
  TAG_SECTIONS,
  updateSectionQuery,
  visibleTagsForSection,
} from "@/lib/tags";
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
              <div key={key} className="mb-4 last:mb-0">
                <p className="text-sm font-medium mb-2">{title}</p>
                <input
                  type="text"
                  className="input-field mb-2 text-sm py-2"
                  placeholder={`Search ${title.toLowerCase()} tags`}
                  value={sectionQueries[key]}
                  onChange={(e) => setSectionQueries((prev) => updateSectionQuery(prev, key, e.target.value))}
                />
                {isAutosuggestOnlySection(key) && !sectionQueries[key].trim() && (
                  <p className="text-parchment-500 text-xs mb-2">Start typing to search all countries.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {visibleTagsForSection(key, filteredTagGroups, sectionQueries).map((tag) => {
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
            ))}
          </div>
        )}

        {error && <p className="text-rust-400 text-sm mt-3">{error}</p>}
      </main>
    </div>
  );
}
