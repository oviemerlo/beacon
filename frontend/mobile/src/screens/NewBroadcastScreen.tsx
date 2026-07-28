import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { apiFetch } from "../lib/api";
import { colors, radii } from "../theme/tokens";

const RADIUS_STEPS_M = [1000, 2000, 5000, 8000, 15000, 25000, 50000];

export function NewBroadcastScreen({ onPosted }: { onPosted: () => void }) {
  const [content, setContent] = useState("");
  const [radiusIdx, setRadiusIdx] = useState(3);
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radiusMeters = RADIUS_STEPS_M[radiusIdx];
  const radiusLabel = radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`;

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
          radius_meters: radiusMeters,
          tag_match_mode: matchMode,
          tag_ids: [], // TODO: wire tag picker once GET /tags exists
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

      <Text style={styles.label}>
        Reach people within <Text style={styles.labelValue}>{radiusLabel}</Text>
      </Text>
      <Slider
        style={{ marginBottom: 24 }}
        minimumValue={0}
        maximumValue={RADIUS_STEPS_M.length - 1}
        step={1}
        value={radiusIdx}
        onValueChange={setRadiusIdx}
        minimumTrackTintColor={colors.signal500}
        maximumTrackTintColor={colors.dusk700}
        thumbTintColor={colors.signal500}
      />

      <Text style={styles.label}>Tag matching</Text>
      <View style={styles.pillRow}>
        <Pressable onPress={() => setMatchMode("any")} style={[styles.pill, matchMode === "any" && styles.pillActive]}>
          <Text style={[styles.pillText, matchMode === "any" && styles.pillTextActive]}>Match any tag</Text>
        </Pressable>
        <Pressable onPress={() => setMatchMode("all")} style={[styles.pill, matchMode === "all" && styles.pillActive]}>
          <Text style={[styles.pillText, matchMode === "all" && styles.pillTextActive]}>Match all tags</Text>
        </Pressable>
      </View>
      <Text style={styles.todo}>
        TODO: tag picker grid here once GET /tags exists. Tags boost ranking within the radius — they
        never exclude someone from seeing this broadcast.
      </Text>

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
  pillRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 14, paddingVertical: 8 },
  pillActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  pillText: { color: colors.parchment300, fontSize: 12, fontFamily: "monospace" },
  pillTextActive: { color: colors.signal400 },
  todo: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginTop: 8, marginBottom: 20 },
  error: { color: colors.rust400, fontSize: 13, marginBottom: 12 },
  buttonPrimary: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingVertical: 14, alignItems: "center" },
  buttonPrimaryText: { color: colors.dusk950, fontWeight: "700" },
});
