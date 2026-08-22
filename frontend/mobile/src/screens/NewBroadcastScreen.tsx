import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { apiFetch } from "../helpers/api";
import {
  buildReachPayload,
  LOCAL_RADIUS_STEPS_M,
  radiusLabel,
  ReachCategory,
  REGIONAL_RADIUS_STEPS_M,
} from "../helpers/broadcastReach";
import { EMPTY_TAG_GROUPS, mergeOwnedTags, toggleTagId } from "../helpers/tags";
import { getMyCourses, getVerificationStatus } from "../helpers/schoolVerification";
import { colors, radii } from "../theme/tokens";
import type { BroadcastCreatePayload, Tag, TagGroups, UserProfile } from "../types/api";

export function NewBroadcastScreen({ onPosted }: { onPosted: () => void }) {
  const tabBarHeight = useBottomTabBarHeight();
  const [content, setContent] = useState("");
  const [reach, setReach] = useState<ReachCategory>("regional");
  const [localRadiusIdx, setLocalRadiusIdx] = useState(3);
  const [regionalRadiusIdx, setRegionalRadiusIdx] = useState(1);
  const [profileTags, setProfileTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
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
    Promise.all([
      apiFetch<UserProfile>("/users/me"),
      apiFetch<TagGroups>("/tags"),
      apiFetch<{ tag_ids: number[] }>("/users/me/followed-tags"),
    ])
      .then(([me, catalog, followed]) => {
        setProfileTags(mergeOwnedTags(me.tags ?? [], catalog, followed.tag_ids ?? []));
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

  async function publish() {
    if (!content.trim()) return;
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
      if (selectedCourseCode) payload.course_code = selectedCourseCode;

      await apiFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setContent("");
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
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      nestedScrollEnabled
      scrollEnabled
    >
      <Text style={styles.title}>New broadcast</Text>
      <Text style={styles.summary}>{reachSummary}</Text>

      <TextInput
        style={styles.textarea}
        placeholder="What do you want people nearby to know?"
        placeholderTextColor={colors.parchment500}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={2000}
      />

      <View style={styles.pillRow}>
        <View style={styles.pillSlotStart}>
          <Pressable onPress={() => setReach("local")} style={[styles.pill, reach === "local" && styles.pillActive]}>
            <Text style={[styles.pillText, reach === "local" && styles.pillTextActive]}>Local</Text>
          </Pressable>
        </View>
        <View style={styles.pillSlotCenter}>
          <Pressable onPress={() => setReach("regional")} style={[styles.pill, reach === "regional" && styles.pillActive]}>
            <Text style={[styles.pillText, reach === "regional" && styles.pillTextActive]}>Regional</Text>
          </Pressable>
        </View>
        <View style={styles.pillSlotEnd}>
          <Pressable onPress={() => setReach("global")} style={[styles.pill, reach === "global" && styles.pillActive]}>
            <Text style={[styles.pillText, reach === "global" && styles.pillTextActive]}>Global</Text>
          </Pressable>
        </View>
      </View>
      {reach !== "global" && (
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={activeRadiusSteps.length - 1}
          step={1}
          value={activeRadiusIdx}
          onValueChange={(value) => (reach === "local" ? setLocalRadiusIdx(value) : setRegionalRadiusIdx(value))}
          minimumTrackTintColor={colors.signal500}
          maximumTrackTintColor={colors.dusk700}
          thumbTintColor={colors.signal500}
        />
      )}
      {reach === "global" && <View style={styles.sliderSpacer} />}

      <View style={styles.selectedHeader}>
        <Text style={styles.label}>Selected for this broadcast</Text>
        <View style={styles.selectedActions}>
          <Pressable
            onPress={() => setSelectedTagIds([])}
            disabled={selectedTagIds.length === 0}
            style={[styles.pill, selectedTagIds.length === 0 && styles.pillDisabled]}
          >
            <Text style={styles.pillText}>Clear all tags</Text>
          </Pressable>
          <Pressable
            onPress={() => setSelectedTagIds(profileTags.map((tag) => tag.id))}
            disabled={profileTags.length === 0 || availableProfileTags.length === 0}
            style={[styles.pill, (profileTags.length === 0 || availableProfileTags.length === 0) && styles.pillDisabled]}
          >
            <Text style={styles.pillText}>Select all tags</Text>
          </Pressable>
        </View>
      </View>
      {selectedTags.length === 0 ? (
        <Text style={styles.emptyText}>No tags selected — broadcast reaches everyone nearby.</Text>
      ) : (
        <View style={styles.tagPillRow}>
          {selectedTags.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => setSelectedTagIds((prev) => toggleTagId(prev, tag.id))}
              style={[styles.pill, styles.pillActive]}
            >
              <Text style={[styles.pillText, styles.pillTextActive]}>{tag.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <Text style={styles.profileLabel}>Your profile tags</Text>
      {profileTags.length === 0 ? (
        <Text style={styles.emptyText}>No profile tags yet. Add tags from your profile.</Text>
      ) : availableProfileTags.length === 0 ? (
        <Text style={styles.emptyText}>All of your profile tags are selected above.</Text>
      ) : (
        <View style={styles.tagPillRow}>
          {availableProfileTags.map((tag) => (
            <Pressable
              key={tag.id}
              onPress={() => setSelectedTagIds((prev) => toggleTagId(prev, tag.id))}
              style={styles.pill}
            >
              <Text style={styles.pillText}>{tag.label}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {schoolVerified && (
        <View style={styles.courseWrap}>
          <Text style={[styles.label, { marginBottom: 8 }]}>Course targeting</Text>
          <View style={styles.tagPillRow}>
            <Pressable
              onPress={() => setSelectedCourseCode("")}
              style={[styles.pill, selectedCourseCode === "" && styles.pillActive]}
            >
              <Text style={[styles.pillText, selectedCourseCode === "" && styles.pillTextActive]}>No course targeting</Text>
            </Pressable>
            {myCourses.map((course) => (
              <Pressable
                key={course}
                onPress={() => setSelectedCourseCode(course)}
                style={[styles.pill, selectedCourseCode === course && styles.pillActive]}
              >
                <Text style={[styles.pillText, selectedCourseCode === course && styles.pillTextActive]}>{course}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.buttonPrimary} onPress={publish} disabled={posting || !content.trim()}>
        {posting ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Send an Echo</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  contentContainer: { padding: 16, flexGrow: 1 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700" },
  summary: { color: colors.parchment500, fontSize: 13, marginTop: 8, marginBottom: 24 },
  textarea: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 14,
    color: colors.parchment100,
    minHeight: 110,
    textAlignVertical: "top",
    marginBottom: 24,
  },
  label: { color: colors.parchment100, fontSize: 14, fontWeight: "600" },
  selectedHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  selectedActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emptyText: { color: colors.parchment500, fontSize: 13, marginBottom: 8 },
  pillRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  pillSlotStart: { flex: 1, alignItems: "flex-start" },
  pillSlotCenter: { flex: 1, alignItems: "center" },
  pillSlotEnd: { flex: 1, alignItems: "flex-end" },
  slider: { marginBottom: 32 },
  sliderSpacer: { marginBottom: 32 },
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
