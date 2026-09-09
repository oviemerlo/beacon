"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { BroadcastAttachments } from "@/components/BroadcastAttachments";
import { CharacterCountdown } from "@/components/EchoBody";
import { BROADCAST_CONTENT_MAX } from "@/helpers/broadcast-content";
import { clientFetch } from "@/helpers/client-api";
import { uploadBroadcastAttachment } from "@/helpers/uploads";
import { getMyCourses, getVerificationStatus } from "@/helpers/school-verification";
import { toggleItem } from "@/helpers/tags";
import {
  buildReachPayload,
  LOCAL_RADIUS_STEPS_M,
  radiusLabel,
  ReachCategory,
  reachSelectorColors,
  REGIONAL_RADIUS_STEPS_M,
} from "@/helpers/broadcast-reach";
import type { BroadcastCreatePayload, ReachEstimate, Tag, UserProfile } from "@/types/api";

function estimateReachPath(
  tagIds: number[],
  radiusMeters: number,
  isGlobal: boolean,
  courseCodes: string[],
): string {
  const params = new URLSearchParams();
  params.set("radius_meters", String(radiusMeters));
  params.set("is_global", isGlobal ? "true" : "false");
  params.set("tag_match_mode", "any");
  for (const id of tagIds) params.append("tag_ids", String(id));
  for (const code of courseCodes) params.append("course_codes", code);
  return `/broadcasts/estimate-reach?${params}`;
}

export default function NewBroadcastPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [reach, setReach] = useState<ReachCategory>("local");
  const [localRadiusIdx, setLocalRadiusIdx] = useState(3); // 1km default
  const [regionalRadiusIdx, setRegionalRadiusIdx] = useState(1); // 25km default
  const [profileTags, setProfileTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [myCourses, setMyCourses] = useState<string[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reachBucket, setReachBucket] = useState<string | null>(null);
  const [estimatingReach, setEstimatingReach] = useState(false);

  const activeRadiusSteps = reach === "local" ? LOCAL_RADIUS_STEPS_M : REGIONAL_RADIUS_STEPS_M;
  const activeRadiusIdx = reach === "local" ? localRadiusIdx : regionalRadiusIdx;
  const activeRadiusMeters = activeRadiusSteps[activeRadiusIdx];
  const activeRadiusLabel = radiusLabel(activeRadiusMeters);
  const disciplineTag = profileTags.find((tag) => tag.tag_type === "discipline") ?? null;
  const generalProfileTags = profileTags.filter((tag) => tag.tag_type !== "discipline");
  const schoolSelected = profileTags.some((tag) => tag.tag_type === "school" && selectedTagIds.includes(tag.id));
  const selectedTags = profileTags.filter((tag) => selectedTagIds.includes(tag.id));
  const availableProfileTags = generalProfileTags.filter((tag) => !selectedTagIds.includes(tag.id));
  const availableCourses = myCourses.filter((course) => !selectedCourseCodes.includes(course));
  const disciplineAvailable = Boolean(disciplineTag && schoolSelected && !selectedTagIds.includes(disciplineTag.id));
  const allProfileTagsSelected = generalProfileTags.length > 0 && availableProfileTags.length === 0 && !disciplineAvailable;
  const allCoursesSelected = myCourses.length === 0 || availableCourses.length === 0;
  const canSelectAll =
    (generalProfileTags.length > 0 || myCourses.length > 0 || disciplineAvailable) &&
    (!allProfileTagsSelected || !allCoursesSelected || disciplineAvailable);
  const canClearAll = selectedTagIds.length > 0 || selectedCourseCodes.length > 0;

  useEffect(() => {
    if (selectedTagIds.length === 0) {
      setReachBucket(null);
      setEstimatingReach(false);
      return;
    }
    let cancelled = false;
    setEstimatingReach(true);
    const handle = window.setTimeout(async () => {
      try {
        const result = await clientFetch<ReachEstimate>(
          estimateReachPath(selectedTagIds, activeRadiusMeters, reach === "global", selectedCourseCodes)
        );
        if (!cancelled) setReachBucket(result.bucket);
      } catch {
        if (!cancelled) setReachBucket(null);
      } finally {
        if (!cancelled) setEstimatingReach(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [selectedTagIds, selectedCourseCodes, activeRadiusMeters, reach]);

  useEffect(() => {
    clientFetch<UserProfile>("/users/me")
      .then((me) => {
        setProfileTags(me.tags ?? []);
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

  function selectAllTargeting() {
    const hasSchool = profileTags.some((tag) => tag.tag_type === "school");
    setSelectedTagIds(profileTags.filter((tag) => tag.tag_type !== "discipline" || hasSchool).map((tag) => tag.id));
    setSelectedCourseCodes([...myCourses]);
  }

  function clearAllTargeting() {
    setSelectedTagIds([]);
    setSelectedCourseCodes([]);
  }

  function toggleTargetTag(tagId: number) {
    setSelectedTagIds((prev) => {
      const next = toggleItem(prev, tagId);
      const schoolStillOn = profileTags.some((tag) => tag.tag_type === "school" && next.includes(tag.id));
      if (schoolStillOn) return next;
      return next.filter((id) => profileTags.find((tag) => tag.id === id)?.tag_type !== "discipline");
    });
  }

  function toggleCourse(course: string) {
    setSelectedCourseCodes((current) => toggleItem(current, course));
  }

  function selectReach(next: ReachCategory) {
    setError(null);
    setReach(next);
  }

  async function publish() {
    if (!content.trim() || selectedTagIds.length === 0) return;
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
      if (selectedCourseCodes.length) {
        payload.course_codes = selectedCourseCodes;
        payload.course_code = selectedCourseCodes[0];
      }
      const created = await clientFetch<{ id: string }>("/broadcasts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      try {
        for (const file of attachments) {
          await uploadBroadcastAttachment(created.id, file);
        }
      } catch {
        // Echo is already live — don't block leaving compose.
      }
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
        <h1 className="font-display text-xl font-bold mb-8">New broadcast</h1>

        <textarea
          className="input-field min-h-[120px] resize-none"
          placeholder="What do you want people nearby to know?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          maxLength={BROADCAST_CONTENT_MAX}
        />
        <div className="mb-3">
          <CharacterCountdown value={content} />
        </div>

        <BroadcastAttachments
          files={attachments}
          onChange={setAttachments}
          onError={setError}
        />

        <p className="text-signal-400 text-xs font-semibold mb-3">
          Remember to adjust the reach distance for this specific echo/broadcast
        </p>
        <div className="grid grid-cols-3 items-center mb-4">
          <button type="button" onClick={() => selectReach("local")} className="tag-pill justify-self-start" style={reachSelectorColors("local", reach === "local")}>
            Local
          </button>
          <button
            type="button"
            onClick={() => selectReach("regional")}
            className="tag-pill justify-self-center"
            style={reachSelectorColors("regional", reach === "regional")}
          >
            Regional
          </button>
          <button type="button" onClick={() => selectReach("global")} className="tag-pill justify-self-end" style={reachSelectorColors("global", reach === "global")}>
            Global
          </button>
        </div>
        {reach === "global" ? (
          <p className="text-signal-400 text-xs font-semibold font-mono mb-3">Global</p>
        ) : (
          <div className="relative mb-3 pt-6">
            <span
              className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap text-xs font-semibold font-mono text-signal-400"
              style={{ left: `${(activeRadiusIdx / Math.max(activeRadiusSteps.length - 1, 1)) * 100}%` }}
            >
              {activeRadiusLabel}
            </span>
            <input
              type="range"
              min={0}
              max={activeRadiusSteps.length - 1}
              value={activeRadiusIdx}
              onChange={(e) =>
                reach === "local" ? setLocalRadiusIdx(Number(e.target.value)) : setRegionalRadiusIdx(Number(e.target.value))
              }
              className="w-full accent-signal-500"
            />
          </div>
        )}
        <p className="text-xs text-parchment-500 min-h-4 mb-10">
          {selectedTagIds.length === 0
            ? "\u00a0"
            : estimatingReach
              ? "Estimating…"
              : reachBucket
                ? `Estimated reach: ${reachBucket} people`
                : "\u00a0"}
        </p>

        <div className="mb-10">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
            <p className="text-sm font-medium">Selected for this broadcast</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={clearAllTargeting}
                disabled={!canClearAll}
                className="tag-pill disabled:opacity-40"
              >
                Clear all tags
              </button>
              <button
                onClick={selectAllTargeting}
                disabled={!canSelectAll}
                className="tag-pill disabled:opacity-40"
              >
                Select all tags
              </button>
            </div>
          </div>
          {selectedTags.length === 0 && selectedCourseCodes.length === 0 ? (
            <p className="text-parchment-500 text-sm">
              Select at least one tag. School and course tags AND with every other selected tag.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => toggleTargetTag(tag.id)}
                  className="tag-pill tag-pill-active"
                >
                  {tag.label}
                </button>
              ))}
              {selectedCourseCodes.map((course) => (
                <button key={course} onClick={() => toggleCourse(course)} className="tag-pill tag-pill-active">
                  {course}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mb-10">
          <p className="text-sm font-medium mb-4">Your profile tags</p>
          {generalProfileTags.length === 0 ? (
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
                  onClick={() => toggleTargetTag(tag.id)}
                  className="tag-pill"
                >
                  {tag.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {disciplineTag && (
          <div className="mb-10">
            <p className="text-sm font-medium mb-2">Your program</p>
            <p className="text-parchment-500 text-sm mb-4">
              Program tags AND with your school tag. Select your school first to target classmates in your department.
            </p>
            <button
              type="button"
              onClick={() => toggleTargetTag(disciplineTag.id)}
              disabled={!schoolSelected && !selectedTagIds.includes(disciplineTag.id)}
              className={`tag-pill disabled:opacity-40 ${selectedTagIds.includes(disciplineTag.id) ? "tag-pill-active" : ""}`}
            >
              {disciplineTag.label}
            </button>
          </div>
        )}

        {schoolVerified && (
          <div className="mb-10">
            <p className="text-sm font-medium mb-2">Your course tags</p>
            <p className="text-parchment-500 text-sm mb-4">
              Course and school tags AND with every other selected tag. Receivers must match all of them.
            </p>
            {myCourses.length === 0 ? (
              <p className="text-parchment-500 text-sm">
                Add course tags from{" "}
                <Link href="/follow-tags" className="text-signal-400 hover:text-signal-300">
                  Echo Tags
                </Link>{" "}
                to target classmates in a class.
              </p>
            ) : availableCourses.length === 0 ? (
              <p className="text-parchment-500 text-sm">All of your course tags are selected above.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {availableCourses.map((course) => (
                  <button key={course} onClick={() => toggleCourse(course)} className="tag-pill">
                    {course}
                  </button>
                ))}
              </div>
            )}
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
