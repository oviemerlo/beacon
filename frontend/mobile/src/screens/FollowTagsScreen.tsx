import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";

import { CourseTags } from "../components/CourseTags";
import { RegionCountriesSheet } from "../components/RegionCountriesSheet";
import { SchoolVerification } from "../components/SchoolVerification";
import { TagChipRow } from "../components/TagChip";
import { apiFetch } from "../helpers/api";
import {
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  autosuggestHint,
  canAddFollowedTag,
  canFollowRegionTags,
  filterTagGroupsBySectionQuery,
  followedIdsWithoutLockedRegions,
  followedTagLimitReachedMessage,
  followedTagsPayload,
  isRegionTagId,
  knownTagIdsFromGroups,
  REGIONAL_TAGS_LOCKED_MESSAGE,
  REGIONAL_TAGS_PREMIUM_HINT,
  REGIONAL_TAGS_PREMIUM_LABEL,
  retainKnown,
  sameTagIdSet,
  selectedTagsForSection,
  TAG_SECTIONS,
  toggleItem,
  UNSAVED_TAG_CHANGES_PROMPT,
  updateSectionQuery,
  visibleTagsForSection,
} from "../helpers/tags";
import { colors, radii } from "../theme/tokens";
import type { Tag, TagGroups, UserProfile } from "../types/api";

export function FollowTagsScreen() {
  const navigation = useNavigation();
  const [tagGroups, setTagGroups] = useState<TagGroups>(EMPTY_TAG_GROUPS);
  const [sectionQueries, setSectionQueries] = useState(EMPTY_SECTION_QUERIES);
  const [followedTagIds, setFollowedTagIds] = useState<number[]>([]);
  const [savedFollowedTagIds, setSavedFollowedTagIds] = useState<number[]>([]);
  const [tagLimit, setTagLimit] = useState(2);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [canFollowRegion, setCanFollowRegion] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [infoTag, setInfoTag] = useState<Tag | null>(null);
  const filteredTagGroups = useMemo(
    () => filterTagGroupsBySectionQuery(tagGroups, sectionQueries),
    [tagGroups, sectionQueries]
  );
  const dirty = useMemo(
    () => !sameTagIdSet(followedTagIds, savedFollowedTagIds),
    [followedTagIds, savedFollowedTagIds]
  );
  const canSave = dirty && !saving;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const atTagLimit = !isAdmin && followedTagIds.length >= tagLimit;
  const tagLimitHint = isAdmin
    ? `${followedTagIds.length} tags`
    : atTagLimit
      ? followedTagLimitReachedMessage(tagLimit)
      : `${followedTagIds.length} of ${tagLimit} tags`;

  useEffect(() => {
    Promise.all([
      apiFetch<TagGroups>("/tags"),
      apiFetch<{ tag_ids: number[] }>("/users/me/followed-tags"),
      apiFetch<UserProfile>("/users/me"),
    ])
      .then(([groups, followed, me]) => {
        setTagGroups(groups);
        const ids = followedIdsWithoutLockedRegions(
          retainKnown(followed.tag_ids, knownTagIdsFromGroups(groups)),
          groups,
          me.is_verified,
          me.is_admin
        );
        setFollowedTagIds(ids);
        setSavedFollowedTagIds(ids);
        setTagLimit(me.followed_tag_limit ?? 2);
        setSchoolVerified(me.is_verified);
        setIsAdmin(me.is_admin);
        setCanFollowRegion(canFollowRegionTags(me.is_verified, me.is_admin));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load tags"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (!dirtyRef.current) return;
      event.preventDefault();
      Alert.alert("Unsaved changes", UNSAVED_TAG_CHANGES_PROMPT, [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            dirtyRef.current = false;
            navigation.dispatch(event.data.action);
          },
        },
      ]);
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (!success) return;
    const timeout = setTimeout(() => setSuccess(null), 2500);
    return () => clearTimeout(timeout);
  }, [success]);

  function toggleFollow(tagId: number) {
    if (isRegionTagId(tagGroups, tagId) && !canFollowRegion && !followedTagIds.includes(tagId)) {
      setError(REGIONAL_TAGS_LOCKED_MESSAGE);
      setSuccess(null);
      Alert.alert("Regional tags locked", REGIONAL_TAGS_LOCKED_MESSAGE);
      return;
    }
    if (!isAdmin && !canAddFollowedTag(followedTagIds, tagId, tagLimit)) {
      const message = followedTagLimitReachedMessage(tagLimit);
      setError(message);
      setSuccess(null);
      Alert.alert("Tag limit reached", message);
      return;
    }
    setFollowedTagIds((current) => toggleItem(current, tagId));
    setError(null);
    setSuccess(null);
  }

  async function saveFollowedTags() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch<{ tag_ids: number[] }>("/users/me/followed-tags", {
        method: "PUT",
        body: JSON.stringify(followedTagsPayload(tagGroups, followedTagIds)),
      });
      const fresh = await apiFetch<{ tag_ids: number[] }>("/users/me/followed-tags");
      setFollowedTagIds(fresh.tag_ids);
      setSavedFollowedTagIds(fresh.tag_ids);
      setSuccess("Tags saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save followed tags");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <ActivityIndicator color={colors.signal500} style={{ marginTop: 30 }} />;

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Echo Tags</Text>
        <Text style={styles.subtitle}>Echo Tags power your Opt-in feed.</Text>

        {TAG_SECTIONS.map(({ key, title }) => {
          const selected = selectedTagsForSection(key, tagGroups, followedTagIds);
          const visible = visibleTagsForSection(key, filteredTagGroups, sectionQueries, followedTagIds);
          const regionLocked = key === "region" && !canFollowRegion;
          return (
          <View key={key}>
            {key === "hobby" && (
              <>
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>School</Text>
                  <SchoolVerification
                    onVerifiedChange={(verified) => {
                      setSchoolVerified(verified);
                      setCanFollowRegion(canFollowRegionTags(verified, isAdmin));
                    }}
                  />
                </View>
                {schoolVerified ? (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Course tags</Text>
                    <CourseTags />
                  </View>
                ) : null}
              </>
            )}
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>{title}</Text>
                {key === "region" ? <Text style={styles.premiumBadge}>{REGIONAL_TAGS_PREMIUM_LABEL}</Text> : null}
              </View>
              {key === "region" ? (
                <Text style={styles.hint}>{regionLocked ? REGIONAL_TAGS_LOCKED_MESSAGE : REGIONAL_TAGS_PREMIUM_HINT}</Text>
              ) : null}
              {selected.length > 0 && (
                <View style={styles.selectedGroup}>
                  <Text style={styles.selectedLabel}>Following</Text>
                  <TagChipRow
                    tags={selected}
                    selectedIds={followedTagIds}
                    onToggle={toggleFollow}
                    onShowCountries={setInfoTag}
                    locked={regionLocked}
                  />
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
              <TagChipRow
                tags={visible}
                selectedIds={followedTagIds}
                onToggle={toggleFollow}
                onShowCountries={setInfoTag}
                locked={regionLocked}
              />
            </View>
          </View>
          );
        })}

        {success ? <Text style={styles.success}>{success}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <RegionCountriesSheet tag={infoTag} onClose={() => setInfoTag(null)} />
      <View style={styles.footer}>
        <Text style={[styles.limitHint, atTagLimit ? styles.limitHintReached : styles.limitHintIdle]}>
          {tagLimitHint}
        </Text>
        <Pressable
          onPress={saveFollowedTags}
          disabled={!canSave}
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        >
          {saving ? (
            <ActivityIndicator color={colors.dusk950} />
          ) : (
            <Text style={[styles.saveButtonText, !canSave && styles.saveButtonTextDisabled]}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.dusk950 },
  container: { flex: 1, backgroundColor: colors.dusk950 },
  content: { padding: 16, paddingBottom: 24 },
  title: { color: colors.parchment100, fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { color: colors.parchment500, fontSize: 13, marginBottom: 16 },
  section: { marginBottom: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionTitle: { color: colors.parchment100, fontWeight: "600" },
  premiumBadge: {
    color: colors.signal400,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    borderColor: colors.signal500,
    borderWidth: 1,
    borderRadius: radii.pill,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
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
  success: { color: colors.signal400, fontSize: 12, marginTop: 10 },
  error: { color: colors.rust400, fontSize: 12, marginTop: 10 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.dusk700,
    backgroundColor: colors.dusk950,
  },
  limitHint: { fontSize: 11, marginBottom: 8 },
  limitHintIdle: { color: colors.parchment500, fontFamily: "monospace" },
  limitHintReached: { color: colors.signal400, lineHeight: 16 },
  saveButton: {
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveButtonText: { color: colors.dusk950, fontWeight: "700", fontSize: 16 },
  saveButtonTextDisabled: { color: colors.dusk950 },
});
