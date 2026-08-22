import { useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput } from "react-native";

import { SchoolVerification } from "../components/SchoolVerification";
import { apiFetch } from "../helpers/api";
import {
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  autosuggestHint,
  filterTagGroupsBySectionQuery,
  selectedTagsForSection,
  TAG_SECTIONS,
  updateSectionQuery,
  visibleTagsForSection,
} from "../helpers/tags";
import { colors, radii } from "../theme/tokens";
import type { TagGroups } from "../types/api";

export function FollowTagsScreen() {
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
    Promise.all([apiFetch<TagGroups>("/tags"), apiFetch<{ tag_ids: number[] }>("/users/me/followed-tags")])
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
      await apiFetch(`/users/me/followed-tags/${tagId}`, { method: followed ? "DELETE" : "PUT" });
    } catch (err) {
      setFollowedTagIds(followedTagIds);
      setError(err instanceof Error ? err.message : "Could not update followed tags");
    }
  }

  if (loading) return <ActivityIndicator color={colors.signal500} style={{ marginTop: 30 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.title}>Follow tags</Text>
      <Text style={styles.subtitle}>Follow tags to power your Opt-in feed.</Text>

      {TAG_SECTIONS.map(({ key, title }) => (
        <View key={key}>
          {key === "hobby" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>School</Text>
              <SchoolVerification />
            </View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {selectedTagsForSection(key, tagGroups, followedTagIds).length > 0 && (
              <View style={styles.selectedGroup}>
                <Text style={styles.selectedLabel}>Following</Text>
                <View style={styles.pillRow}>
                  {selectedTagsForSection(key, tagGroups, followedTagIds).map((tag) => (
                    <Pressable key={tag.id} onPress={() => toggleFollow(tag.id)} style={[styles.pill, styles.pillActive]}>
                      <Text style={[styles.pillText, styles.pillTextActive]}>{tag.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
            <TextInput
              style={styles.searchInput}
              placeholder={`Search ${title.toLowerCase()} tags`}
              placeholderTextColor={colors.parchment500}
              value={sectionQueries[key]}
              onChangeText={(text) => setSectionQueries((prev) => updateSectionQuery(prev, key, text))}
            />
            {autosuggestHint(key) && !sectionQueries[key].trim() && (
              <Text style={styles.hint}>{autosuggestHint(key)}</Text>
            )}
            <View style={styles.pillRow}>
              {visibleTagsForSection(key, filteredTagGroups, sectionQueries, followedTagIds).map((tag) => {
                const selected = followedTagIds.includes(tag.id);
                return (
                  <Pressable key={tag.id} onPress={() => toggleFollow(tag.id)} style={[styles.pill, selected && styles.pillActive]}>
                    <Text style={[styles.pillText, selected && styles.pillTextActive]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      ))}

      {error && <Text style={styles.error}>{error}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  title: { color: colors.parchment100, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: colors.parchment500, fontSize: 13, marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitle: { color: colors.parchment100, fontWeight: "600", marginBottom: 8 },
  selectedGroup: { marginBottom: 8 },
  selectedLabel: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace", marginBottom: 6 },
  hint: { color: colors.parchment500, fontSize: 11, marginBottom: 8 },
  searchInput: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  pillTextActive: { color: colors.signal400 },
  error: { color: colors.rust400, fontSize: 12, marginTop: 10 },
});
