"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import {
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  filterTagGroupsBySectionQuery,
  isAutosuggestOnlySection,
  selectedTagsForSection,
  TAG_SECTIONS,
  toggleTagId,
  updateSectionQuery,
  visibleTagsForSection,
} from "@/helpers/tags";
import {
  buildReachPayload,
  LOCAL_RADIUS_STEPS_M,
  radiusLabel,
  ReachCategory,
  REGIONAL_RADIUS_STEPS_M,
} from "@/helpers/broadcast-reach";
import type { TagGroups } from "@/types/api";

export default function NewBroadcastPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [reach, setReach] = useState<ReachCategory>("regional");
  const [localRadiusIdx, setLocalRadiusIdx] = useState(3); // 1km default
  const [regionalRadiusIdx, setRegionalRadiusIdx] = useState(1); // 8km default
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");
  const [tagGroups, setTagGroups] = useState<TagGroups>(EMPTY_TAG_GROUPS);
  const [sectionQueries, setSectionQueries] = useState(EMPTY_SECTION_QUERIES);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRadiusSteps = reach === "local" ? LOCAL_RADIUS_STEPS_M : REGIONAL_RADIUS_STEPS_M;
  const activeRadiusIdx = reach === "local" ? localRadiusIdx : regionalRadiusIdx;
  const activeRadiusMeters = activeRadiusSteps[activeRadiusIdx];
  const activeRadiusLabel = radiusLabel(activeRadiusMeters);
  const filteredTagGroups = useMemo(
    () => filterTagGroupsBySectionQuery(tagGroups, sectionQueries),
    [tagGroups, sectionQueries]
  );

  useEffect(() => {
    clientFetch<TagGroups>("/tags")
      .then(setTagGroups)
      .catch(() => setTagGroups(EMPTY_TAG_GROUPS));
  }, []);

  async function publish() {
    if (!content.trim()) return;
    setPosting(true);
    setError(null);
    try {
      // Uses the sender's own registered location as the origin point.
      // A future "choose a different point" toggle (for businesses
      // targeting a neighborhood they haven't moved into yet) reuses this
      // same radius control — just swaps where origin lat/lng comes from.
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      await clientFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          content,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          ...buildReachPayload(reach, activeRadiusMeters),
          tag_match_mode: matchMode,
          tag_ids: selectedTagIds,
        }),
      });
      router.push("/feed");
    } catch {
      setError("Couldn't post your broadcast — check location permissions and try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <h1 className="font-display text-xl font-bold mb-5">New broadcast</h1>

        <div className="card">
          <textarea
            className="input-field min-h-[120px] resize-none mb-5"
            placeholder="What do you want people nearby to know?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
          />

          <label className="block text-sm font-medium mb-2">Reach</label>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setReach("local")} className={`tag-pill ${reach === "local" ? "tag-pill-active" : ""}`}>
              Local
            </button>
            <button onClick={() => setReach("regional")} className={`tag-pill ${reach === "regional" ? "tag-pill-active" : ""}`}>
              Regional
            </button>
            <button onClick={() => setReach("global")} className={`tag-pill ${reach === "global" ? "tag-pill-active" : ""}`}>
              Global
            </button>
          </div>
          {reach === "global" ? (
            <p className="text-parchment-500 text-sm mb-6">Reaches everyone on Beacon, everywhere.</p>
          ) : (
            <>
              <label className="block text-sm font-medium mb-2">
                Reach people within <span className="text-signal-400 font-mono">{activeRadiusLabel}</span>
              </label>
              <input
                type="range"
                min={0}
                max={activeRadiusSteps.length - 1}
                value={activeRadiusIdx}
                onChange={(e) =>
                  reach === "local" ? setLocalRadiusIdx(Number(e.target.value)) : setRegionalRadiusIdx(Number(e.target.value))
                }
                className="w-full accent-signal-500 mb-6"
              />
            </>
          )}

          <label className="block text-sm font-medium mb-2">Tag matching</label>
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMatchMode("any")}
              className={`tag-pill ${matchMode === "any" ? "tag-pill-active" : ""}`}
            >
              Match any tag
            </button>
            <button
              onClick={() => setMatchMode("all")}
              className={`tag-pill ${matchMode === "all" ? "tag-pill-active" : ""}`}
            >
              Match all tags
            </button>
          </div>
          <div className="mb-6">
            {TAG_SECTIONS.map(({ key, title }) => (
              <div key={key} className="mb-4">
                <p className="text-sm font-medium mb-2">{title}</p>
                {selectedTagsForSection(key, tagGroups, selectedTagIds).length > 0 && (
                  <div className="mb-2">
                    <p className="text-parchment-500 text-xs font-mono mb-2">Selected</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTagsForSection(key, tagGroups, selectedTagIds).map((tag) => (
                        <button
                          key={tag.id}
                          onClick={() => setSelectedTagIds((prev) => toggleTagId(prev, tag.id))}
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
                {isAutosuggestOnlySection(key) && !sectionQueries[key].trim() && (
                  <p className="text-parchment-500 text-xs mb-2">Start typing to search all countries.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {visibleTagsForSection(key, filteredTagGroups, sectionQueries, selectedTagIds).map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => setSelectedTagIds((prev) => toggleTagId(prev, tag.id))}
                        className={`tag-pill ${selected ? "tag-pill-active" : ""}`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-parchment-500 text-xs font-mono mt-2">
              Tags help ranking context within each viewer's feed.
            </p>
          </div>

          {error && <p className="text-rust-400 text-sm mb-3">{error}</p>}
          <button onClick={publish} disabled={posting || !content.trim()} className="btn-primary w-full">
            {posting ? "Posting…" : "Post broadcast"}
          </button>
        </div>
      </main>
    </div>
  );
}
