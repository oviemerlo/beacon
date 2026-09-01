import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, TextInput, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../helpers/api";
import { audienceFilterActive, feedSearchChips, pathWithTagQuery, retainKnown, toggleItem } from "../helpers/tags";
import { usePolling } from "../helpers/usePolling";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import { BroadcastCard } from "../components/BroadcastCard";
import { SearchHitCard } from "../components/SearchHitCard";
import { startPrivateConversation } from "../components/FeedCardActionRow";
import { LocationDriftBanner } from "../components/LocationDriftBanner";
import type { FeedBroadcast, FeedSearchHit, UserProfile } from "../types/api";

export function FeedScreen({
  onOpenBroadcast,
  onOpenConversation,
}: {
  onOpenBroadcast: (id: string) => void;
  onOpenConversation: (conversationId: string) => void;
}) {
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [searchHits, setSearchHits] = useState<FeedSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const isSearching = debouncedQuery.trim().length > 0;

  const load = useCallback(async ({ silent }: { silent: boolean }) => {
    if (debouncedQuery.trim()) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<FeedBroadcast[]>(
        pathWithTagQuery("/feed/for-you", { tagIds: selectedTagIds, courseCodes: selectedCourseCodes })
      );
      setBroadcasts(data);
      setError(null);
      await apiFetch("/feed/mark-seen", { method: "POST" });
    } catch {
      if (!silent) setError("Couldn't load your feed. Try refreshing.");
    }
    if (!silent) setLoading(false);
  }, [debouncedQuery, selectedTagIds, selectedCourseCodes]);

  usePolling(load, [load], 5000);

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true });
      apiFetch<UserProfile>("/users/me")
        .then((me) => {
          setUser(me);
          setSelectedTagIds((ids) => retainKnown(ids, me.tags.map((tag) => tag.id)));
          setSelectedCourseCodes((codes) => retainKnown(codes, me.course_codes ?? []));
        })
        .catch(() => setUser(null));
    }, [load])
  );

  const chips = feedSearchChips(user?.tags ?? [], selectedTagIds, user?.course_codes ?? [], selectedCourseCodes);
  const filterActive = audienceFilterActive(selectedTagIds, selectedCourseCodes);
  const searchPath = pathWithTagQuery("/feed/search", {
    tagIds: selectedTagIds,
    courseCodes: selectedCourseCodes,
    extra: { q: debouncedQuery.trim() },
  });

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (!isSearching) {
      setSearchHits([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    apiFetch<FeedSearchHit[]>(searchPath)
      .then((hits) => {
        if (!cancelled) setSearchHits(hits);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchHits([]);
        setSearchError("Couldn't search your feed history.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSearching, searchPath]);

  async function onRefresh() {
    setRefreshing(true);
    if (isSearching) {
      try {
        setSearchHits(await apiFetch<FeedSearchHit[]>(searchPath));
        setSearchError(null);
      } catch {
        setSearchError("Couldn't search your feed history.");
      }
    } else {
      await load({ silent: true });
    }
    setRefreshing(false);
  }

  async function startPrivateReply(broadcastId: string) {
    try {
      const res = await startPrivateConversation(broadcastId, "Hi");
      onOpenConversation(res.conversation_id);
    } catch {
      // Keep feed stable on failure.
    }
  }

  return (
    <View style={styles.container}>
      <LocationDriftBanner
        registeredLatitude={user?.latitude ?? null}
        registeredLongitude={user?.longitude ?? null}
        onConfirmUpdate={async (latitude, longitude) => {
          await apiFetch("/users/me", {
            method: "PATCH",
            body: JSON.stringify({ latitude, longitude }),
          });
          const refreshed = await apiFetch<UserProfile>("/users/me");
          setUser(refreshed);
        }}
      />

      <View style={styles.searchWrap}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search your feed history"
          placeholderTextColor={colors.parchment500}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {chips.length > 0 && (
          <>
            <Text style={styles.searchByTags}>Search by tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {chips.map((chip) => (
                <Pressable
                  key={chip.key}
                  onPress={() => {
                    if (chip.kind === "tag") setSelectedTagIds((ids) => toggleItem(ids, chip.id));
                    else setSelectedCourseCodes((codes) => toggleItem(codes, chip.code));
                  }}
                  style={[styles.filterChip, chip.selected && styles.filterChipActive]}
                >
                  <Text style={[styles.filterChipText, chip.selected && styles.filterChipTextActive]}>{chip.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {loading && !isSearching ? (
        <ActivityIndicator color={colors.signal500} style={{ marginTop: 24 }} />
      ) : isSearching ? (
        <FlatList
          data={searchHits}
          keyExtractor={(hit) => hit.id}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal500} title="" />}
          ListHeaderComponent={
            searching ? <Text style={styles.searchStatus}>Searching…</Text> : searchError ? <Text style={styles.searchError}>{searchError}</Text> : null
          }
          ListEmptyComponent={
            searching ? null : (
              <Card>
                <Text style={styles.emptyTitle}>No matches in your feed history.</Text>
                <Text style={styles.emptySubtitle}>Try a different keyword or clear a tag filter.</Text>
              </Card>
            )
          }
          renderItem={({ item }) => (
            <SearchHitCard
              hit={item}
              currentUserId={user?.id ?? null}
              onOpenBroadcast={onOpenBroadcast}
              onOpenConversation={onOpenConversation}
              onPrivateReply={() => void startPrivateReply(item.id)}
              onBlocked={(senderId) => setSearchHits((rows) => rows.filter((row) => row.sender_id !== senderId))}
              onRemoved={(broadcastId) => setSearchHits((rows) => rows.filter((row) => row.id !== broadcastId))}
            />
          )}
        />
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={(b) => b.id}
          removeClippedSubviews={false}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal500} title="" />}
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>
                {error
                  ? error
                  : filterActive
                    ? "No Echoes targeting these tags nearby."
                    : "Nothing nearby yet."}
              </Text>
              <Text style={styles.emptySubtitle}>
                {error
                  ? "Pull down to try again."
                  : filterActive
                    ? "Clear a tag to see everything in reach."
                    : "Broadcasts from people and businesses within your radius will show up here."}
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <BroadcastCard
              broadcast={item}
              currentUserId={user?.id ?? null}
              onOpenBroadcast={onOpenBroadcast}
              onPrivateReply={() => void startPrivateReply(item.id)}
              onBlocked={(senderId) => setBroadcasts((rows) => rows.filter((row) => row.sender_id !== senderId))}
              onRemoved={(broadcastId) => setBroadcasts((rows) => rows.filter((row) => row.id !== broadcastId))}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, gap: 8 },
  searchInput: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chipRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    borderColor: colors.dusk600,
    borderWidth: 1,
    backgroundColor: colors.dusk800,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterChipActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  filterChipText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  filterChipTextActive: { color: colors.signal400 },
  searchByTags: { color: colors.parchment500, fontSize: 11 },
  searchStatus: { color: colors.parchment500, fontSize: 13, fontFamily: "monospace", marginBottom: 8 },
  searchError: { color: colors.rust400, fontSize: 13, marginBottom: 8 },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
