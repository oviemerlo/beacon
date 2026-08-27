import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, ScrollView, Alert } from "react-native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { apiFetch } from "../helpers/api";
import {
  buildReachPayload,
  canUseRegionalReach,
  LOCAL_RADIUS_STEPS_M,
  radiusLabel,
  ReachCategory,
  reachSelectorColors,
  REGIONAL_RADIUS_STEPS_M,
  REGIONAL_REACH_LOCKED_MESSAGE,
} from "../helpers/broadcastReach";
import { toggleTagId } from "../helpers/tags";
import { getMyCourses, getVerificationStatus } from "../helpers/schoolVerification";
import { colors, radii } from "../theme/tokens";
import type { BroadcastCreatePayload, Tag, UserProfile } from "../types/api";

export function NewBroadcastScreen({ onPosted }: { onPosted: () => void }) {
  const tabBarHeight = useBottomTabBarHeight();
  const [content, setContent] = useState("");
  const [reach, setReach] = useState<ReachCategory>("local");
  const [localRadiusIdx, setLocalRadiusIdx] = useState(3);
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
  const localReachColors = reachSelectorColors("local", reach === "local");
  const regionalReachColors = reachSelectorColors("regional", reach === "regional", !canUseRegional);
  const globalReachColors = reachSelectorColors("global", reach === "global");

  useEffect(() => {
    apiFetch<UserProfile>("/users/me")
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
      Alert.alert("Regional reach locked", REGIONAL_REACH_LOCKED_MESSAGE);
      return;
    }
    setError(null);
    setReach(next);
  }

  async function publish() {
    if (!content.trim() || selectedTagIds.length === 0) return;
    if (reach === "regional" && !canUseRegional) {
      setError(REGIONAL_REACH_LOCKED_MESSAGE);
      Alert.alert("Regional reach locked", REGIONAL_REACH_LOCKED_MESSAGE);
      return;
    }
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
      {!canUseRegional && <Text style={styles.reachHint}>{REGIONAL_REACH_LOCKED_MESSAGE}</Text>}
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
        <Text style={styles.emptyText}>Select at least one tag. Only people who share a selected tag will see this Echo — including Global.</Text>
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

      <Pressable style={styles.buttonPrimary} onPress={publish} disabled={posting || !content.trim() || selectedTagIds.length === 0}>
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
  reachHint: { color: colors.parchment500, fontSize: 11, marginBottom: 16 },
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
