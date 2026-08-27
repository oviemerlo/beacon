"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/helpers/client-api";
import { getMyCourses, getVerificationStatus } from "@/helpers/school-verification";
import { toggleTagId } from "@/helpers/tags";
import {
  buildReachPayload,
  canUseRegionalReach,
  LOCAL_RADIUS_STEPS_M,
  radiusLabel,
  ReachCategory,
  reachSelectorColors,
  REGIONAL_RADIUS_STEPS_M,
  REGIONAL_REACH_LOCKED_MESSAGE,
} from "@/helpers/broadcast-reach";
import type { BroadcastCreatePayload, Tag, UserProfile } from "@/types/api";

export default function NewBroadcastPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [reach, setReach] = useState<ReachCategory>("local");
  const [localRadiusIdx, setLocalRadiusIdx] = useState(3); // 1km default
  const [regionalRadiusIdx, setRegionalRadiusIdx] = useState(1); // 25km default
  const [profileTags, setProfileTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [canUseRegional, setCanUseRegional] = useState(false);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [myCourses, setMyCourses] = useState<string[]>([]);
  const [selectedCourseCode, setSelectedCourseCode] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeRadiusSteps = reach === "local" ? LOCAL_RADIUS_STEPS_M : REGIONAL_RADIUS_STEPS_M;
  const activeRadiusIdx = reach === "local" ? localRadiusIdx : regionalRadiusIdx;
  const activeRadiusMeters = activeRadiusSteps[activeRadiusIdx];
  const activeRadiusLabel = radiusLabel(activeRadiusMeters);
  const reachSummary = reach === "global" ? "Global" : `Reach ${activeRadiusLabel}`;
  const selectedTags = profileTags.filter((tag) => selectedTagIds.includes(tag.id));
  const availableProfileTags = profileTags.filter((tag) => !selectedTagIds.includes(tag.id));

  useEffect(() => {
    clientFetch<UserProfile>("/users/me")
      .then((me) => {
        setProfileTags(me.tags ?? []);
        setCanUseRegional(canUseRegionalReach(me.is_verified, me.is_admin));
      })
      .catch(() => setProfileTags([]));
    getVerificationStatus()
      .then(async (status) => {
        setSchoolVerified(status.verified);
        if (!status.verified) return;
        const courses = await getMyCourses();
        setMyCourses(courses);
      })
      .catch(() => {
        setSchoolVerified(false);
        setMyCourses([]);
      });
  }, []);

  function selectReach(next: ReachCategory) {
    if (next === "regional" && !canUseRegional) {
      setError(REGIONAL_REACH_LOCKED_MESSAGE);
      return;
    }
    setError(null);
    setReach(next);
  }

  async function publish() {
    if (!content.trim() || selectedTagIds.length === 0) return;
    if (reach === "regional" && !canUseRegional) {
      setError(REGIONAL_REACH_LOCKED_MESSAGE);
      return;
    }
    setPosting(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      const payload: BroadcastCreatePayload = {
        content,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        ...buildReachPayload(reach, activeRadiusMeters),
        tag_match_mode: "any",
        tag_ids: selectedTagIds,
      };
      if (selectedCourseCode) payload.course_code = selectedCourseCode;
      await clientFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify(payload),
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
        <h1 className="font-display text-xl font-bold">New broadcast</h1>
        <p className="text-parchment-500 text-sm mt-2 mb-8">{reachSummary}</p>

        <textarea
          className="input-field min-h-[120px] resize-none mb-8"
          placeholder="What do you want people nearby to know?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={2000}
        />

        <div className="grid grid-cols-3 items-center mb-4">
          <button type="button" onClick={() => selectReach("local")} className="tag-pill justify-self-start" style={reachSelectorColors("local", reach === "local")}>
            Local
          </button>
          <button
            type="button"
            onClick={() => selectReach("regional")}
            className="tag-pill justify-self-center"
            style={reachSelectorColors("regional", reach === "regional", !canUseRegional)}
          >
            Regional
          </button>
          <button type="button" onClick={() => selectReach("global")} className="tag-pill justify-self-end" style={reachSelectorColors("global", reach === "global")}>
            Global
          </button>
        </div>
        {!canUseRegional && <p className="text-parchment-500 text-xs mb-4">{REGIONAL_REACH_LOCKED_MESSAGE}</p>}
        {reach !== "global" && (
          <input
            type="range"
            min={0}
            max={activeRadiusSteps.length - 1}
            value={activeRadiusIdx}
            onChange={(e) =>
              reach === "local" ? setLocalRadiusIdx(Number(e.target.value)) : setRegionalRadiusIdx(Number(e.target.value))
            }
            className="w-full accent-signal-500 mb-10"
          />
        )}
        {reach === "global" && <div className="mb-10" />}

        <div className="mb-10">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <p className="text-sm font-medium">Selected for this broadcast</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTagIds([])}
                disabled={selectedTagIds.length === 0}
                className="tag-pill disabled:opacity-40"
              >
                Clear all tags
              </button>
              <button
                onClick={() => setSelectedTagIds(profileTags.map((tag) => tag.id))}
                disabled={profileTags.length === 0 || availableProfileTags.length === 0}
                className="tag-pill disabled:opacity-40"
              >
                Select all tags
              </button>
            </div>
          </div>
          {selectedTags.length === 0 ? (
            <p className="text-parchment-500 text-sm">Select at least one tag. Only people who share a selected tag will see this Echo — including Global.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagIds((prev) => toggleTagId(prev, tag.id))}
                  className="tag-pill tag-pill-active"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-10">
          <p className="text-sm font-medium mb-4">Your profile tags</p>
          {profileTags.length === 0 ? (
            <p className="text-parchment-500 text-sm">
              No profile tags yet.{" "}
              <Link href="/follow-tags" className="text-signal-400 hover:text-signal-300">
                Add tags
              </Link>
            </p>
          ) : availableProfileTags.length === 0 ? (
            <p className="text-parchment-500 text-sm">All of your profile tags are selected above.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableProfileTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => setSelectedTagIds((prev) => toggleTagId(prev, tag.id))}
                  className="tag-pill"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {schoolVerified && (
          <div className="mb-10">
            <p className="text-sm font-medium mb-4">Course targeting</p>
            <select
              className="input-field text-sm py-2"
              value={selectedCourseCode}
              onChange={(e) => setSelectedCourseCode(e.target.value)}
            >
              <option value="">No course targeting</option>
              {myCourses.map((course) => (
                <option key={course} value={course}>
                  {course}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && <p className="text-rust-400 text-sm mb-4">{error}</p>}
        <button onClick={publish} disabled={posting || !content.trim() || selectedTagIds.length === 0} className="btn-primary w-full mt-2">
          {posting ? "Posting…" : "Send an Echo"}
        </button>
      </main>
    </div>
  );
}
