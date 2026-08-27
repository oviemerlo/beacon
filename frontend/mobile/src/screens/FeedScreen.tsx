import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert, TextInput, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../helpers/api";
import { reachBadgeColors, reachBadgeLabel } from "../helpers/broadcastReach";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { pathWithTagQuery, retainKnownTagIds, toggleTagId } from "../helpers/tags";
import { echoPreview, formatBroadcastSentAt } from "../helpers/time";
import { usePolling } from "../helpers/usePolling";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import { VerifiedMark } from "../components/VerifiedMark";
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
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [searchHits, setSearchHits] = useState<FeedSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const isSearching = debouncedQuery.trim().length > 0;

  const load = useCallback(async ({ silent }: { silent: boolean }) => {
    if (debouncedQuery.trim()) return;
    if (!silent) setLoading(true);
    try {
      const data = await apiFetch<FeedBroadcast[]>(pathWithTagQuery("/feed/for-you", selectedTagIds));
      setBroadcasts(data);
      await apiFetch("/feed/mark-seen", { method: "POST" });
    } catch {
      // Keep feed rendering stable on network failures.
    }
    if (!silent) setLoading(false);
  }, [debouncedQuery, selectedTagIds]);

  usePolling(load, [load], 5000);

  useFocusEffect(
    useCallback(() => {
      void load({ silent: true });
      apiFetch<UserProfile>("/users/me")
        .then((me) => {
          setUser(me);
          setSelectedTagIds((ids) => retainKnownTagIds(ids, me.tags.map((tag) => tag.id)));
        })
        .catch(() => setUser(null));
    }, [load])
  );

  const filterTags = user?.tags ?? [];

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
    apiFetch<FeedSearchHit[]>(pathWithTagQuery("/feed/search", selectedTagIds, { q: debouncedQuery.trim() }))
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
  }, [debouncedQuery, isSearching, selectedTagIds]);

  async function onRefresh() {
    setRefreshing(true);
    if (isSearching) {
      try {
        setSearchHits(await apiFetch<FeedSearchHit[]>(pathWithTagQuery("/feed/search", selectedTagIds, { q: debouncedQuery.trim() })));
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
      const res = await apiFetch<{ conversation_id: string }>("/conversations", {
        method: "POST",
        body: JSON.stringify({
          broadcast_id: broadcastId,
          first_message: "Hi",
        }),
      });
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
        {filterTags.length > 0 && (
          <>
            <Text style={styles.searchByTags}>Search by tags</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {filterTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() => setSelectedTagIds((ids) => toggleTagId(ids, tag.id))}
                    style={[styles.filterChip, selected && styles.filterChipActive]}
                  >
                    <Text style={[styles.filterChipText, selected && styles.filterChipTextActive]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal500} />}
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
            />
          )}
        />
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={(b) => b.id}
          removeClippedSubviews={false}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal500} />}
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>
                {selectedTagIds.length > 0 ? "No Echoes targeting these tags nearby." : "Nothing nearby yet."}
              </Text>
              <Text style={styles.emptySubtitle}>
                {selectedTagIds.length > 0
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

function SearchHitCard({
  hit,
  currentUserId,
  onOpenBroadcast,
  onOpenConversation,
}: {
  hit: FeedSearchHit;
  currentUserId: string | null;
  onOpenBroadcast: (id: string) => void;
  onOpenConversation: (conversationId: string) => void;
}) {
  const matchLabel = hit.match_type === "both" ? "Echo + replies" : hit.match_type === "echo" ? "Echo" : "Reply";
  return (
    <Card>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <View style={styles.senderCluster}>
            <Text style={styles.senderName}>{hit.sender_id === currentUserId ? "You" : hit.sender_display_name}</Text>
            <VerifiedMark verified={hit.sender_is_verified} />
          </View>
          {hit.tags.map((tag) => (
            <View key={tag.id} style={styles.broadcastTagPill}>
              <Text style={styles.broadcastTagPillText}>{tag.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.tagPill}>
          <Text style={styles.tagPillText}>{matchLabel}</Text>
        </View>
      </View>
      <Pressable onPress={() => onOpenBroadcast(hit.id)}>
        <Text style={styles.cardText}>{hit.body}</Text>
      </Pressable>
      <Text style={styles.sentAtLabel}>{formatBroadcastSentAt(hit.created_at)}</Text>
      {hit.matches.map((match) => (
        <View key={match.id} style={styles.nestedMatch}>
          <Text style={styles.senderName}>
            {match.sender_id && match.sender_id === currentUserId ? "You" : match.sender_display_name || "Unknown"}
          </Text>
          <Text style={styles.nestedMatchBody}>{match.body}</Text>
          <Text style={styles.sentAtLabel}>
            {formatBroadcastSentAt(match.created_at)}
            {match.source === "message" ? " · private reply" : " · feed reply"}
          </Text>
          <Pressable
            onPress={() => (match.conversation_id ? onOpenConversation(match.conversation_id) : onOpenBroadcast(hit.id))}
            style={styles.replyPill}
          >
            <Text style={styles.replyPillText}>{match.conversation_id ? "Open conversation" : "View thread"}</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

function BroadcastCard({
  broadcast,
  currentUserId,
  onOpenBroadcast,
  onPrivateReply,
  onBlocked,
  onRemoved,
}: {
  broadcast: FeedBroadcast;
  currentUserId: string | null;
  onOpenBroadcast: (id: string) => void;
  onPrivateReply: () => void;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwn = currentUserId === broadcast.sender_id;
  const featuredReply = broadcast.latest_reply ?? null;
  const headerName = featuredReply
    ? currentUserId === featuredReply.sender_id
      ? "You"
      : featuredReply.sender_display_name
    : isOwn
      ? "You"
      : broadcast.sender_display_name;
  const headerVerified = featuredReply ? featuredReply.sender_is_verified : broadcast.sender_is_verified;
  const reachLabel = reachBadgeLabel(broadcast.is_global, broadcast.radius_meters);
  const reachColors = reachBadgeColors(broadcast.is_global, broadcast.radius_meters);

  async function reportBroadcast() {
    setMenuOpen(false);
    try {
      await pickReasonAndSubmitReport("broadcast", broadcast.id);
    } catch {
      // Keep feed stable on failure.
    }
  }

  function confirmBlock() {
    setMenuOpen(false);
    Alert.alert(
      `Block ${broadcast.sender_display_name}?`,
      "You won't see their posts in your feed, including ones already here. They can still see your broadcasts.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await apiFetch(`/blocks/${broadcast.sender_id}`, { method: "PUT" });
                onBlocked(broadcast.sender_id);
              } catch {
                Alert.alert("Couldn't block this user.");
              }
            })();
          },
        },
      ]
    );
  }

  function confirmDelete() {
    setMenuOpen(false);
    Alert.alert("Delete this Echo?", "It will disappear from everyone's feed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await apiFetch(`/broadcasts/${broadcast.id}`, { method: "DELETE" });
              onRemoved(broadcast.id);
            } catch {
              Alert.alert("Couldn't delete this Echo.");
            }
          })();
        },
      },
    ]);
  }

  async function hideFromFeed() {
    setMenuOpen(false);
    try {
      await apiFetch(`/broadcasts/${broadcast.id}/hide`, { method: "PUT" });
      onRemoved(broadcast.id);
    } catch {
      Alert.alert("Couldn't remove this Echo from your feed.");
    }
  }

  return (
    <Card style={menuOpen ? { ...styles.cardOverflow, ...styles.cardMenuOpen } : styles.cardOverflow}>
      <View style={styles.headingRow}>
        <View style={styles.headingCopy}>
          <View style={styles.senderCluster}>
            <Text style={styles.senderName}>{headerName}</Text>
            <VerifiedMark verified={headerVerified} />
          </View>
          {broadcast.tags.map((tag) => (
            <View key={tag.id} style={styles.broadcastTagPill}>
              <Text style={styles.broadcastTagPillText}>{tag.label}</Text>
            </View>
          ))}
        </View>
        {!!currentUserId && (
          <View style={styles.overflowWrap}>
            <Pressable
              accessibilityLabel={`More actions for ${isOwn ? "your post" : broadcast.sender_display_name}`}
              onPress={() => setMenuOpen((value) => !value)}
              style={styles.overflowButton}
            >
              <Text style={styles.overflowButtonText}>⋯</Text>
            </Pressable>
            {menuOpen && (
              <View style={styles.overflowMenu}>
                {isOwn ? (
                  <Pressable onPress={confirmDelete} style={styles.overflowMenuItem}>
                    <Text style={styles.overflowMenuItemText}>Delete</Text>
                  </Pressable>
                ) : (
                  <>
                    <Pressable onPress={() => void reportBroadcast()} style={styles.overflowMenuItem}>
                      <Text style={styles.overflowMenuItemText}>Report</Text>
                    </Pressable>
                    <Pressable onPress={confirmBlock} style={styles.overflowMenuItem}>
                      <Text style={styles.overflowMenuItemText}>Block</Text>
                    </Pressable>
                    <Pressable onPress={() => void hideFromFeed()} style={styles.overflowMenuItem}>
                      <Text style={styles.overflowMenuItemText}>Remove from my feed</Text>
                    </Pressable>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </View>
      {featuredReply ? <Text style={styles.replyToLabel}>Reply to: {echoPreview(broadcast.content)}</Text> : null}
      <Text style={styles.cardText}>{featuredReply ? featuredReply.content : broadcast.content}</Text>
      <Text style={styles.sentAtLabel}>
        {formatBroadcastSentAt(featuredReply ? featuredReply.created_at : broadcast.created_at)}
      </Text>
      <View style={styles.metaRow}>
        {!isOwn && <Text style={styles.cardMeta}>{(broadcast.distance_m / 1000).toFixed(1)} km away</Text>}
        <View style={[styles.reachPill, { backgroundColor: reachColors.backgroundColor, borderColor: reachColors.borderColor }]}>
          <Text style={[styles.reachPillText, { color: reachColors.color }]}>{reachLabel}</Text>
        </View>
        <Pressable
          onPress={() => onOpenBroadcast(broadcast.id)}
          accessibilityRole="link"
          accessibilityLabel={`View thread, ${broadcast.reply_count ?? 0} replies`}
        >
          <Text style={styles.replyCountText}>
            {broadcast.reply_count ?? 0} repl{(broadcast.reply_count ?? 0) === 1 ? "y" : "ies"}
          </Text>
        </Pressable>
      </View>
      <View style={styles.replyRow}>
        {!isOwn && (
          <>
            <Pressable onPress={() => onOpenBroadcast(broadcast.id)} style={styles.replyPill}>
              <Text style={styles.replyPillText}>Reply in feed</Text>
            </Pressable>
            <Pressable onPress={onPrivateReply} style={styles.replyPill}>
              <Text style={styles.replyPillText}>Reply privately</Text>
            </Pressable>
          </>
        )}
        <Pressable onPress={() => onOpenBroadcast(broadcast.id)} style={styles.replyPill}>
          <Text style={styles.replyPillText}>View thread</Text>
        </Pressable>
      </View>
    </Card>
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
  nestedMatch: { marginTop: 12, marginLeft: 10, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: colors.dusk600, gap: 6 },
  nestedMatchBody: { color: colors.parchment300, fontSize: 14 },
  replyToLabel: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace", marginTop: 6 },
  cardText: { color: colors.parchment100, fontSize: 15, marginTop: 6 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  headingCopy: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 20, rowGap: 8 },
  senderCluster: { flexDirection: "row", alignItems: "center", gap: 4, marginRight: 8 },
  senderName: { color: colors.parchment500, fontSize: 12 },
  sentAtLabel: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginTop: 4 },
  cardOverflow: { overflow: "visible", zIndex: 1 },
  cardMenuOpen: { zIndex: 20, elevation: 12 },
  overflowWrap: { position: "relative", zIndex: 2 },
  overflowButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
  },
  overflowButtonText: { color: colors.parchment300, fontSize: 16, lineHeight: 16 },
  overflowMenu: {
    position: "absolute",
    top: 32,
    right: 0,
    minWidth: 180,
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
    overflow: "hidden",
    zIndex: 20,
    elevation: 16,
  },
  overflowMenuItem: { paddingHorizontal: 12, paddingVertical: 10 },
  overflowMenuItemText: { color: colors.parchment100, fontSize: 14 },
  broadcastTagPill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  broadcastTagPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  cardMeta: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace" },
  reachPill: { borderColor: colors.parchment500, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  reachPillText: { fontSize: 10, fontFamily: "monospace" },
  replyRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  replyPill: { borderColor: colors.dusk600, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  replyPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  tagPill: { borderColor: colors.signal500, borderWidth: 1, backgroundColor: `${colors.signal500}1A`, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagPillText: { color: colors.signal400, fontSize: 10, fontFamily: "monospace" },
  replyCountText: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace" },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
