import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";

import { CourseTags } from "../components/CourseTags";
import { RegionCountriesSheet } from "../components/RegionCountriesSheet";
import { SchoolVerification } from "../components/SchoolVerification";
import { TagChipRow } from "../components/TagChip";
import { apiFetch } from "../helpers/api";
import {
  AMPLIFY_BLURB,
  AMPLIFY_EXAMPLES,
  AMPLIFY_PRICE_HINT,
  CAMPUS_PLAN_HINT,
  CAMPUS_SCHOOL_BLURB,
  countryChangeHint,
  countryChangeLockedMessage,
  countryLimitMessage,
  countrySectionTitle,
  countrySlotForTag,
  countrySlotLimit,
  countrySelectionLine,
  formatNextChangeAvailable,
  lockedCountryIds,
  planDetailLine,
  ECHO_TAGS_SUBTITLE,
  EMPTY_SECTION_QUERIES,
  EMPTY_TAG_GROUPS,
  PLANS,
  autosuggestHint,
  canAddFollowedTag,
  displayTagLabel,
  filterTagGroupsBySectionQuery,
  followedIdsWithoutLockedRegions,
  followedTagLimitReachedMessage,
  followedTagsPayload,
  isNationalityTagId,
  isRegionTagId,
  knownTagIdsFromGroups,
  resolvePlan,
  REGIONAL_TAGS_LOCKED_MESSAGE,
  REGIONAL_TAGS_PREMIUM_LABEL,
  type AccountType,
  retainKnown,
  sameTagIdSet,
  selectedCountryCount,
  selectedTagsForSection,
  toggleItem,
  UNSAVED_TAG_CHANGES_PROMPT,
  updateSectionQuery,
  visibleTagsForSection,
} from "../helpers/tags";
import { colors, radii } from "../theme/tokens";
import type { CountrySlot, FollowedTags, Tag, TagGroups, UserProfile } from "../types/api";

export function FollowTagsScreen() {
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const [tagGroups, setTagGroups] = useState<TagGroups>(EMPTY_TAG_GROUPS);
  const [sectionQueries, setSectionQueries] = useState(EMPTY_SECTION_QUERIES);
  const [followedTagIds, setFollowedTagIds] = useState<number[]>([]);
  const [savedFollowedTagIds, setSavedFollowedTagIds] = useState<number[]>([]);
  const [countrySlots, setCountrySlots] = useState<CountrySlot[]>([]);
  const [tagLimit, setTagLimit] = useState(2);
  const [schoolVerified, setSchoolVerified] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("individual");
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showLockedRegions, setShowLockedRegions] = useState(false);
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
  const countedFollowedIds = followedTagIds.filter((id) => !isNationalityTagId(tagGroups, id));
  const atTagLimit = !isAdmin && countedFollowedIds.length >= tagLimit;
  const countryCount = selectedCountryCount(tagGroups, followedTagIds);
  const plan = resolvePlan(schoolVerified, isAdmin, accountType);
  const countryLimit = isAdmin ? null : countrySlotLimit(plan);
  const canFollowRegion = plan === "amplify";
  const planCopy = PLANS[plan];
  const lockedCountryTagIds = lockedCountryIds(countrySlots);
  const selectedCountries = selectedTagsForSection("nationality", tagGroups, followedTagIds);

  useEffect(() => {
    Promise.all([
      apiFetch<TagGroups>("/tags"),
      apiFetch<FollowedTags>("/users/me/followed-tags"),
      apiFetch<UserProfile>("/users/me"),
    ])
      .then(([groups, followed, me]) => {
        setTagGroups(groups);
        const ids = followedIdsWithoutLockedRegions(
          retainKnown(followed.tag_ids, knownTagIdsFromGroups(groups)),
          groups,
          me.is_verified,
          me.is_admin,
          me.account_type
        );
        setFollowedTagIds(ids);
        setSavedFollowedTagIds(ids);
        setCountrySlots(followed.country_slots ?? []);
        setTagLimit(me.followed_tag_limit ?? 2);
        setSchoolVerified(me.is_verified);
        setIsAdmin(me.is_admin);
        setAccountType(me.account_type);
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
      Alert.alert("Regional targeting locked", REGIONAL_TAGS_LOCKED_MESSAGE);
      return;
    }
    if (isNationalityTagId(tagGroups, tagId) && followedTagIds.includes(tagId)) {
      const slot = countrySlotForTag(countrySlots, tagId);
      if (slot?.locked) {
        const message = countryChangeLockedMessage(slot.next_change_at);
        setError(message);
        setSuccess(null);
        Alert.alert("Country change window", message);
        return;
      }
    }
    if (
      !isAdmin &&
      countryLimit != null &&
      isNationalityTagId(tagGroups, tagId) &&
      !followedTagIds.includes(tagId) &&
      selectedCountryCount(tagGroups, followedTagIds) >= countryLimit
    ) {
      const message = countryLimitMessage(countryLimit);
      setError(message);
      setSuccess(null);
      Alert.alert("Country limit reached", message);
      return;
    }
    const countedIds = followedTagIds.filter((id) => !isNationalityTagId(tagGroups, id));
    if (!isAdmin && !isNationalityTagId(tagGroups, tagId) && !canAddFollowedTag(countedIds, tagId, tagLimit)) {
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
      const saved = await apiFetch<FollowedTags>("/users/me/followed-tags", {
        method: "PUT",
        body: JSON.stringify(followedTagsPayload(tagGroups, followedTagIds)),
      });
      setFollowedTagIds(saved.tag_ids);
      setSavedFollowedTagIds(saved.tag_ids);
      setCountrySlots(saved.country_slots ?? []);
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
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Echo Tags</Text>
        <Text style={styles.subtitle}>{ECHO_TAGS_SUBTITLE}</Text>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{planCopy.name}</Text>
          <Text style={styles.planStatus}>{planCopy.meaning}</Text>
          <Text style={styles.planMeta}>{planDetailLine(plan)}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{countrySectionTitle(countryLimit)}</Text>
          <Text style={styles.hint}>
            {isAdmin ? "Choose the country communities you want Echoes matched with." : countryChangeHint(countryLimit)}
          </Text>
          {selectedCountries.length > 0 ? (
            <View style={styles.selectedGroup}>
              <Text style={styles.selectedLabel}>Selected</Text>
              <TagChipRow
                tags={selectedCountries}
                selectedIds={followedTagIds}
                onToggle={toggleFollow}
                onShowCountries={setInfoTag}
                lockedIds={lockedCountryTagIds}
              />
              {countryLimit === 1
                ? countrySlots
                    .filter((slot) => slot.locked)
                    .map((slot) => (
                      <Text key={slot.slot} style={styles.planMeta}>
                        {formatNextChangeAvailable(slot.next_change_at)}
                      </Text>
                    ))
                : selectedCountries.map((tag) => {
                    const slot = countrySlotForTag(countrySlots, tag.id);
                    const next = slot?.locked ? formatNextChangeAvailable(slot.next_change_at) : null;
                    return next ? (
                      <Text key={tag.id} style={styles.planMeta}>
                        {displayTagLabel(tag.label)} — {next}
                      </Text>
                    ) : null;
                  })}
            </View>
          ) : null}
          <TextInput
            style={styles.searchInput}
            placeholder="Search by country..."
            placeholderTextColor={colors.parchment500}
            value={sectionQueries.nationality}
            onChangeText={(text) => setSectionQueries((prev) => updateSectionQuery(prev, "nationality", text))}
          />
          {autosuggestHint("nationality") && !sectionQueries.nationality.trim() ? (
            <Text style={styles.hint}>{autosuggestHint("nationality")}</Text>
          ) : null}
          <TagChipRow
            tags={visibleTagsForSection("nationality", filteredTagGroups, sectionQueries, followedTagIds)}
            selectedIds={followedTagIds}
            onToggle={toggleFollow}
            onShowCountries={setInfoTag}
          />
          <Text style={[styles.limitHint, countryLimit != null && countryCount >= countryLimit && !isAdmin ? styles.limitHintReached : styles.limitHintIdle]}>
            {countryLimit == null ? `${countryCount} selected` : `${countryCount} of ${countryLimit} selected`}
          </Text>
        </View>

        <View style={styles.card}>
          {canFollowRegion ? (
            <Text style={styles.sectionTitle}>Regional Communities</Text>
          ) : (
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>🔒 Regional Communities</Text>
              <Text style={styles.premiumBadge}>{REGIONAL_TAGS_PREMIUM_LABEL}</Text>
            </View>
          )}
          {canFollowRegion ? (
            <>
              <Text style={styles.hint}>{AMPLIFY_BLURB}</Text>
              {selectedTagsForSection("region", tagGroups, followedTagIds).length > 0 ? (
                <View style={styles.selectedGroup}>
                  <Text style={styles.selectedLabel}>Selected</Text>
                  <TagChipRow
                    tags={selectedTagsForSection("region", tagGroups, followedTagIds)}
                    selectedIds={followedTagIds}
                    onToggle={toggleFollow}
                    onShowCountries={setInfoTag}
                  />
                </View>
              ) : null}
              <TextInput
                style={styles.searchInput}
                placeholder="Search regional communities"
                placeholderTextColor={colors.parchment500}
                value={sectionQueries.region}
                onChangeText={(text) => setSectionQueries((prev) => updateSectionQuery(prev, "region", text))}
              />
              <TagChipRow
                tags={visibleTagsForSection("region", filteredTagGroups, sectionQueries, followedTagIds)}
                selectedIds={followedTagIds}
                onToggle={toggleFollow}
                onShowCountries={setInfoTag}
              />
            </>
          ) : (
            <>
              <Text style={styles.body}>{AMPLIFY_BLURB}</Text>
              <Text style={styles.examples}>{AMPLIFY_EXAMPLES.map(displayTagLabel).join(" · ")}</Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.secondaryButton} onPress={() => setShowLockedRegions((open) => !open)}>
                  <Text style={styles.secondaryButtonText}>{showLockedRegions ? "Hide regions" : "View regions"}</Text>
                </Pressable>
              </View>
              <Text style={styles.hint}>{AMPLIFY_PRICE_HINT}</Text>
              {showLockedRegions ? (
                <View style={{ marginTop: 12 }}>
                  <TagChipRow
                    tags={visibleTagsForSection("region", filteredTagGroups, sectionQueries, followedTagIds)}
                    selectedIds={followedTagIds}
                    onToggle={toggleFollow}
                    onShowCountries={setInfoTag}
                    locked
                  />
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>School Community</Text>
          <Text style={styles.planMeta}>{CAMPUS_PLAN_HINT}</Text>
          <Text style={styles.body}>{CAMPUS_SCHOOL_BLURB}</Text>
          <SchoolVerification
            onVerifiedChange={(verified) => {
              setSchoolVerified(verified);
            }}
          />
          {schoolVerified ? (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.sectionTitle}>Course tags</Text>
              <CourseTags />
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Personal interests</Text>
          {selectedTagsForSection("hobby", tagGroups, followedTagIds).length > 0 ? (
            <View style={styles.selectedGroup}>
              <Text style={styles.selectedLabel}>Selected</Text>
              <TagChipRow
                tags={selectedTagsForSection("hobby", tagGroups, followedTagIds)}
                selectedIds={followedTagIds}
                onToggle={toggleFollow}
                onShowCountries={setInfoTag}
              />
            </View>
          ) : null}
          <TextInput
            style={styles.searchInput}
            placeholder="Search interests"
            placeholderTextColor={colors.parchment500}
            value={sectionQueries.hobby}
            onChangeText={(text) => setSectionQueries((prev) => updateSectionQuery(prev, "hobby", text))}
          />
          {autosuggestHint("hobby") && !sectionQueries.hobby.trim() ? (
            <Text style={styles.hint}>{autosuggestHint("hobby")}</Text>
          ) : null}
          <TagChipRow
            tags={visibleTagsForSection("hobby", filteredTagGroups, sectionQueries, followedTagIds)}
            selectedIds={followedTagIds}
            onToggle={toggleFollow}
            onShowCountries={setInfoTag}
          />
        </View>

        {success ? <Text style={styles.success}>{success}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
      <RegionCountriesSheet tag={infoTag} onClose={() => setInfoTag(null)} />
      <View style={styles.footer}>
        {atTagLimit ? (
          <Text style={[styles.limitHint, styles.limitHintReached]}>{followedTagLimitReachedMessage(tagLimit)}</Text>
        ) : (
          <Text style={[styles.limitHint, styles.limitHintIdle]}>{countrySelectionLine(countryCount, countryLimit, isAdmin)}</Text>
        )}
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
  card: {
    backgroundColor: colors.dusk900,
    borderColor: colors.dusk700,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 14,
    marginBottom: 12,
  },
  planStatus: { color: colors.parchment500, fontSize: 11, marginTop: 4 },
  planMeta: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace", marginTop: 4 },
  body: { color: colors.parchment500, fontSize: 13, marginBottom: 10 },
  examples: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace", marginBottom: 12 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  unlockButton: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingHorizontal: 12, paddingVertical: 8 },
  unlockButtonText: { color: colors.dusk950, fontWeight: "700", fontSize: 12 },
  secondaryButton: { backgroundColor: colors.dusk700, borderRadius: radii.beacon, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryButtonText: { color: colors.parchment100, fontWeight: "600", fontSize: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  sectionTitle: { color: colors.parchment100, fontWeight: "600", marginBottom: 6 },
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
