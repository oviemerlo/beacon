import { useEffect, useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { apiFetch } from "../lib/api";
import {
  buildReachPayload,
  LOCAL_RADIUS_STEPS_M,
  radiusLabel,
  ReachCategory,
  REGIONAL_RADIUS_STEPS_M,
} from "../lib/broadcastReach";
import {
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  filterTagGroupsBySectionQuery,
  isAutosuggestOnlySection,
  TAG_SECTIONS,
  toggleTagId,
  updateSectionQuery,
  visibleTagsForSection,
} from "../lib/tags";
import { colors, radii } from "../theme/tokens";
import type { TagGroups } from "../types/api";

export function NewBroadcastScreen({ onPosted }: { onPosted: () => void }) {
  const [content, setContent] = useState("");
  const [reach, setReach] = useState<ReachCategory>("regional");
  const [localRadiusIdx, setLocalRadiusIdx] = useState(3);
  const [regionalRadiusIdx, setRegionalRadiusIdx] = useState(1);
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
    apiFetch<TagGroups>("/tags").then(setTagGroups).catch(() => setTagGroups(EMPTY_TAG_GROUPS));
  }, []);

  async function publish() {
    if (!content.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission is required to post a broadcast");
      const pos = await Location.getCurrentPositionAsync({});

      await apiFetch("/broadcasts", {
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
      setContent("");
      onPosted();
    } catch (e: any) {
      setError(e.message ?? "Couldn't post your broadcast — check location permissions and try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>New broadcast</Text>

      <TextInput
        style={styles.textarea}
        placeholder="What do you want people nearby to know?"
        placeholderTextColor={colors.parchment500}
        value={content}
        onChangeText={setContent}
        multiline
        maxLength={2000}
      />

      <Text style={styles.label}>Reach</Text>
      <View style={[styles.pillRow, { marginBottom: 16 }]}>
        <Pressable onPress={() => setReach("local")} style={[styles.pill, reach === "local" && styles.pillActive]}>
          <Text style={[styles.pillText, reach === "local" && styles.pillTextActive]}>Local</Text>
        </Pressable>
        <Pressable onPress={() => setReach("regional")} style={[styles.pill, reach === "regional" && styles.pillActive]}>
          <Text style={[styles.pillText, reach === "regional" && styles.pillTextActive]}>Regional</Text>
        </Pressable>
        <Pressable onPress={() => setReach("global")} style={[styles.pill, reach === "global" && styles.pillActive]}>
          <Text style={[styles.pillText, reach === "global" && styles.pillTextActive]}>Global</Text>
        </Pressable>
      </View>
      {reach === "global" ? (
        <Text style={styles.globalDescription}>Reaches everyone on Beacon, everywhere.</Text>
      ) : (
        <>
          <Text style={styles.label}>
            Reach people within <Text style={styles.labelValue}>{activeRadiusLabel}</Text>
          </Text>
          <Slider
            style={{ marginBottom: 24 }}
            minimumValue={0}
            maximumValue={activeRadiusSteps.length - 1}
            step={1}
            value={activeRadiusIdx}
            onValueChange={(value) =>
              reach === "local" ? setLocalRadiusIdx(value) : setRegionalRadiusIdx(value)
            }
            minimumTrackTintColor={colors.signal500}
            maximumTrackTintColor={colors.dusk700}
            thumbTintColor={colors.signal500}
          />
        </>
      )}

      <Text style={styles.label}>Tag matching</Text>
      <View style={styles.pillRow}>
        <Pressable onPress={() => setMatchMode("any")} style={[styles.pill, matchMode === "any" && styles.pillActive]}>
          <Text style={[styles.pillText, matchMode === "any" && styles.pillTextActive]}>Match any tag</Text>
        </Pressable>
        <Pressable onPress={() => setMatchMode("all")} style={[styles.pill, matchMode === "all" && styles.pillActive]}>
          <Text style={[styles.pillText, matchMode === "all" && styles.pillTextActive]}>Match all tags</Text>
        </Pressable>
      </View>
      <View style={styles.tagSectionWrap}>
        {TAG_SECTIONS.map(({ key, title }) => (
          <View key={key} style={styles.tagSection}>
            <Text style={styles.label}>{title}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${title.toLowerCase()} tags`}
              placeholderTextColor={colors.parchment500}
              value={sectionQueries[key]}
              onChangeText={(text) => setSectionQueries((prev) => updateSectionQuery(prev, key, text))}
            />
            {isAutosuggestOnlySection(key) && !sectionQueries[key].trim() && (
              <Text style={styles.hint}>Start typing to search all countries.</Text>
            )}
            <View style={styles.pillRow}>
              {visibleTagsForSection(key, filteredTagGroups, sectionQueries).map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => setSelectedTagIds((prev) => toggleTagId(prev, tag.id))}
                    style={[styles.pill, selected && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextActive]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.buttonPrimary} onPress={publish} disabled={posting || !content.trim()}>
        {posting ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonPrimaryText}>Post broadcast</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  textarea: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 14,
    color: colors.parchment100,
    minHeight: 110,
    textAlignVertical: "top",
    marginBottom: 20,
  },
  label: { color: colors.parchment100, fontSize: 14, fontWeight: "600", marginBottom: 8 },
  labelValue: { color: colors.signal400, fontFamily: "monospace" },
  globalDescription: { color: colors.parchment500, fontSize: 13, marginBottom: 24 },
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  pillText: { color: colors.parchment300, fontSize: 12, fontFamily: "monospace" },
  pillTextActive: { color: colors.signal400 },
  tagSectionWrap: { marginTop: 8, marginBottom: 20, gap: 10 },
  tagSection: { gap: 8 },
  hint: { color: colors.parchment500, fontSize: 11 },
  searchInput: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  error: { color: colors.rust400, fontSize: 13, marginBottom: 12 },
  buttonPrimary: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingVertical: 14, alignItems: "center" },
  buttonPrimaryText: { color: colors.dusk950, fontWeight: "700" },
});
