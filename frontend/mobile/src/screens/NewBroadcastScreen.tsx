import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { BroadcastAttachments } from "../components/BroadcastAttachments";
import { CharacterCountdown } from "../components/EchoBody";
import { BROADCAST_CONTENT_MAX } from "../helpers/broadcastContent";
import { apiFetch } from "../helpers/api";
import { uploadBroadcastAttachment, type PickedUpload } from "../helpers/uploads";
import {
  buildReachPayload,
  LOCAL_RADIUS_STEPS_M,
  radiusLabel,
  ReachCategory,
  reachSelectorColors,
  REGIONAL_RADIUS_STEPS_M,
} from "../helpers/broadcastReach";
import { toggleItem } from "../helpers/tags";
import { getMyCourses, getVerificationStatus } from "../helpers/schoolVerification";
import { colors, radii } from "../theme/tokens";
import type { BroadcastCreatePayload, ReachEstimate, Tag, UserProfile } from "../types/api";

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

const SLIDER_THUMB = 28;

function ReachValueSlider({
  steps,
  index,
  onIndexChange,
}: {
  steps: readonly number[];
  index: number;
  onIndexChange: (index: number) => void;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const [labelWidth, setLabelWidth] = useState(0);
  const max = Math.max(steps.length - 1, 1);
  const pct = Math.min(1, Math.max(0, index / max));
  const travel = Math.max(trackWidth - SLIDER_THUMB, 0);
  const thumbCenter = SLIDER_THUMB / 2 + pct * travel;
  const labelLeft =
    trackWidth === 0
      ? 0
      : Math.min(Math.max(thumbCenter - labelWidth / 2, 0), Math.max(trackWidth - labelWidth, 0));

  return (
    <View style={styles.sliderWrap}>
      <Text
        onLayout={(event) => setLabelWidth(event.nativeEvent.layout.width)}
        style={[styles.sliderValue, { left: labelLeft }]}
      >
        {radiusLabel(steps[index])}
      </Text>
      <View onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={steps.length - 1}
          step={1}
          value={index}
          onValueChange={(value) => onIndexChange(Math.round(value))}
          minimumTrackTintColor={colors.signal500}
          maximumTrackTintColor={colors.dusk700}
          thumbTintColor={colors.signal500}
        />
      </View>
    </View>
  );
}

export function NewBroadcastScreen({ onPosted }: { onPosted: () => void }) {
  const tabBarHeight = useBottomTabBarHeight();
  const [content, setContent] = useState("");
  const [reach, setReach] = useState<ReachCategory>("local");
  const [localRadiusIdx, setLocalRadiusIdx] = useState(3);
  const [regionalRadiusIdx, setRegionalRadiusIdx] = useState(1); // 25km default
  const [profileTags, setProfileTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [myCourses, setMyCourses] = useState<string[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<PickedUpload[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reachBucket, setReachBucket] = useState<string | null>(null);
  const [estimatingReach, setEstimatingReach] = useState(false);

  const activeRadiusSteps = reach === "local" ? LOCAL_RADIUS_STEPS_M : REGIONAL_RADIUS_STEPS_M;
  const activeRadiusIdx = reach === "local" ? localRadiusIdx : regionalRadiusIdx;
  const activeRadiusMeters = activeRadiusSteps[activeRadiusIdx];
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
  const localReachColors = reachSelectorColors("local", reach === "local");
  const regionalReachColors = reachSelectorColors("regional", reach === "regional");
  const globalReachColors = reachSelectorColors("global", reach === "global");

  useEffect(() => {
    if (selectedTagIds.length === 0) {
      setReachBucket(null);
      setEstimatingReach(false);
      return;
    }
    let cancelled = false;
    setEstimatingReach(true);
    const handle = setTimeout(async () => {
      try {
        const result = await apiFetch<ReachEstimate>(
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
      clearTimeout(handle);
    };
  }, [selectedTagIds, selectedCourseCodes, activeRadiusMeters, reach]);

  useEffect(() => {
    apiFetch<UserProfile>("/users/me")
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
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission is required to post a broadcast");
      const pos = await Location.getCurrentPositionAsync({});

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

      const created = await apiFetch<{ id: string }>("/broadcasts", {
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
      setContent("");
      setAttachments([]);
      onPosted();
    } catch (e: any) {
      setError(e.message ?? "Couldn't post your broadcast — check location permissions and try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.contentContainer, { paddingBottom: tabBarHeight + 32 }]}
      keyboardShouldPersistTaps="always"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled
      scrollEnabled
    >
      <Text style={styles.title}>New broadcast</Text>

      <TextInput
        style={styles.textarea}
        placeholder="What do you want people nearby to know?"
        placeholderTextColor={colors.parchment500}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={BROADCAST_CONTENT_MAX}
      />
      <CharacterCountdown value={content} />

      <BroadcastAttachments files={attachments} onChange={setAttachments} />

      <Text style={styles.reachReminder}>Remember to adjust the reach distance for this specific echo/broadcast</Text>
      <View style={styles.pillRow}>
        <View style={styles.pillSlotStart}>
          <Pressable onPress={() => selectReach("local")} style={[styles.pill, localReachColors]}>
            <Text style={[styles.pillText, { color: localReachColors.color }]}>Local</Text>
          </Pressable>
        </View>
        <View style={styles.pillSlotCenter}>
          <Pressable onPress={() => selectReach("regional")} style={[styles.pill, regionalReachColors]}>
            <Text style={[styles.pillText, { color: regionalReachColors.color }]}>Regional</Text>
          </Pressable>
        </View>
        <View style={styles.pillSlotEnd}>
          <Pressable onPress={() => selectReach("global")} style={[styles.pill, globalReachColors]}>
            <Text style={[styles.pillText, { color: globalReachColors.color }]}>Global</Text>
          </Pressable>
        </View>
      </View>
      {reach === "global" ? (
        <Text style={styles.globalReachValue}>Global</Text>
      ) : (
        <ReachValueSlider
          steps={activeRadiusSteps}
          index={activeRadiusIdx}
          onIndexChange={(value) => (reach === "local" ? setLocalRadiusIdx(value) : setRegionalRadiusIdx(value))}
        />
      )}
      <Text style={styles.reachEstimate}>
        {selectedTagIds.length === 0
          ? " "
          : estimatingReach
            ? "Estimating…"
            : reachBucket
              ? `Estimated reach: ${reachBucket} people`
              : " "}
      </Text>

      <View style={styles.selectedHeader}>
        <Text style={styles.label}>Selected for this broadcast</Text>
        <View style={styles.selectedActions}>
          <Pressable
            onPress={clearAllTargeting}
            disabled={!canClearAll}
            style={[styles.pill, !canClearAll && styles.pillDisabled]}
          >
            <Text style={styles.pillText}>Clear all tags</Text>
          </Pressable>
          <Pressable
            onPress={selectAllTargeting}
            disabled={!canSelectAll}
            style={[styles.pill, !canSelectAll && styles.pillDisabled]}
          >
            <Text style={styles.pillText}>Select all tags</Text>
          </Pressable>
        </View>
      </View>
      {selectedTags.length === 0 && selectedCourseCodes.length === 0 ? (
        <Text style={styles.emptyText}>Select at least one tag. School and course tags AND with every other selected tag.</Text>
      ) : (
        <View style={styles.tagPillRow}>
          {selectedTags.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => toggleTargetTag(tag.id)}
              style={[styles.pill, styles.pillActive]}
            >
              <Text style={[styles.pillText, styles.pillTextActive]}>{tag.label}</Text>
            </Pressable>
          ))}
          {selectedCourseCodes.map((course) => (
            <Pressable key={course} onPress={() => toggleCourse(course)} style={[styles.pill, styles.pillActive]}>
              <Text style={[styles.pillText, styles.pillTextActive]}>{course}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.profileLabel}>Your profile tags</Text>
      {generalProfileTags.length === 0 ? (
        <Text style={styles.emptyText}>No profile tags yet. Add tags from your profile.</Text>
      ) : availableProfileTags.length === 0 ? (
        <Text style={styles.emptyText}>All of your profile tags are selected above.</Text>
      ) : (
        <View style={styles.tagPillRow}>
          {availableProfileTags.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => toggleTargetTag(tag.id)}
              style={styles.pill}
            >
              <Text style={styles.pillText}>{tag.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {disciplineTag ? (
        <View style={styles.courseWrap}>
          <Text style={[styles.label, { marginBottom: 8 }]}>Your program</Text>
          <Text style={styles.emptyText}>
            Program tags AND with your school tag. Select your school first to target classmates in your department.
          </Text>
          <Pressable
            onPress={() => toggleTargetTag(disciplineTag.id)}
            disabled={!schoolSelected && !selectedTagIds.includes(disciplineTag.id)}
            style={[
              styles.pill,
              selectedTagIds.includes(disciplineTag.id) && styles.pillActive,
              !schoolSelected && !selectedTagIds.includes(disciplineTag.id) && styles.pillDisabled,
            ]}
          >
            <Text style={[styles.pillText, selectedTagIds.includes(disciplineTag.id) && styles.pillTextActive]}>
              {disciplineTag.label}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {schoolVerified && (
        <View style={styles.courseWrap}>
          <Text style={[styles.label, { marginBottom: 8 }]}>Your course tags</Text>
          <Text style={styles.emptyText}>
            Course and school tags AND with every other selected tag. Receivers must match all of them.
          </Text>
          {myCourses.length === 0 ? (
            <Text style={styles.emptyText}>Add course tags from Echo Tags to target classmates in a class.</Text>
          ) : availableCourses.length === 0 ? (
            <Text style={styles.emptyText}>All of your course tags are selected above.</Text>
          ) : (
            <View style={styles.tagPillRow}>
              {availableCourses.map((course) => (
                <Pressable key={course} onPress={() => toggleCourse(course)} hitSlop={8} style={styles.pill}>
                  <Text style={styles.pillText}>{course}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.buttonPrimary} onPress={publish} disabled={posting || !content.trim() || selectedTagIds.length === 0}>
        {posting ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Send an Echo</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  contentContainer: { padding: 16, flexGrow: 1 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 24 },
  textarea: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 14,
    color: colors.parchment100,
    minHeight: 110,
    textAlignVertical: "top",
    marginBottom: 0,
  },
  label: { color: colors.parchment100, fontSize: 14, fontWeight: "600" },
  selectedHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  selectedActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emptyText: { color: colors.parchment500, fontSize: 13, marginBottom: 8 },
  reachReminder: { color: colors.signal400, fontSize: 12, fontWeight: "600", marginBottom: 12 },
  pillRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  pillSlotStart: { flex: 1, alignItems: "flex-start" },
  pillSlotCenter: { flex: 1, alignItems: "center" },
  pillSlotEnd: { flex: 1, alignItems: "flex-end" },
  sliderWrap: { marginBottom: 8 },
  sliderValue: { position: "absolute", top: 0, color: colors.signal400, fontSize: 12, fontWeight: "700", fontFamily: "monospace" },
  slider: { marginTop: 20 },
  globalReachValue: { color: colors.signal400, fontSize: 12, fontWeight: "700", fontFamily: "monospace", marginBottom: 8 },
  reachEstimate: { color: colors.parchment500, fontSize: 12, minHeight: 16, marginBottom: 32 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  pillDisabled: { opacity: 0.4 },
  pillText: { color: colors.parchment300, fontSize: 12, fontFamily: "monospace" },
  pillTextActive: { color: colors.signal400 },
  tagPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  profileLabel: { color: colors.parchment100, fontSize: 14, fontWeight: "600", marginTop: 32, marginBottom: 12 },
  courseWrap: { marginTop: 32, marginBottom: 8, gap: 8 },
  error: { color: colors.rust400, fontSize: 13, marginTop: 24, marginBottom: 12 },
  buttonPrimary: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingVertical: 14, alignItems: "center", marginTop: 32 },
  buttonPrimaryText: { color: colors.dusk950, fontWeight: "700" },
});
