import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl, Alert } from "react-native";
import { apiFetch } from "../helpers/api";
import { reachBadgeLabel } from "../helpers/broadcastReach";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { formatBroadcastSentAt } from "../helpers/time";
import { usePolling } from "../helpers/usePolling";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import { LocationDriftBanner } from "../components/LocationDriftBanner";
import type { FeedBroadcast, UserProfile } from "../types/api";

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

  const load = useCallback(async ({ silent }: { silent: boolean }) => {
    if (!silent) setLoading(true);
    const data = await apiFetch<FeedBroadcast[]>("/feed/for-you");
    setBroadcasts(data);
    try {
      await apiFetch("/feed/mark-seen", { method: "POST" });
    } catch {
      // Keep feed rendering stable on network failures.
    }
    if (!silent) setLoading(false);
  }, []);

  usePolling(load, [load], 5000);

  useEffect(() => {
    apiFetch<UserProfile>("/users/me").then(setUser).catch(() => setUser(null));
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load({ silent: true });
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

      {loading ? (
        <ActivityIndicator color={colors.signal500} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={broadcasts}
          keyExtractor={(b) => b.id}
          removeClippedSubviews={false}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal500} />}
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>Nothing nearby yet.</Text>
              <Text style={styles.emptySubtitle}>
                Broadcasts from people and businesses within your radius will show up here.
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
  const reachLabel = reachBadgeLabel(broadcast.is_global, broadcast.radius_meters);

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
          <Text style={styles.senderName}>{isOwn ? "You" : broadcast.sender_display_name}</Text>
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
      <Text style={styles.cardText}>{broadcast.content}</Text>
      <Text style={styles.sentAtLabel}>{formatBroadcastSentAt(broadcast.created_at)}</Text>
      <View style={styles.metaRow}>
        {!isOwn && <Text style={styles.cardMeta}>{(broadcast.distance_m / 1000).toFixed(1)} km away</Text>}
        <View
          style={[
            styles.reachPill,
            reachLabel === "Local" && styles.localReachPill,
            reachLabel === "Global" && styles.globalReachPill,
          ]}
        >
          <Text style={[styles.reachPillText, reachLabel === "Global" && styles.globalReachPillText]}>{reachLabel}</Text>
        </View>
        {!!broadcast.shared_tag_count && (
          <View style={styles.tagPill}>
            <Text style={styles.tagPillText}>
              {broadcast.shared_tag_count} shared tag{broadcast.shared_tag_count > 1 ? "s" : ""}
            </Text>
          </View>
        )}
        <View style={styles.tagPill}>
          <Text style={styles.tagPillText}>
            {broadcast.reply_count ?? 0} repl{(broadcast.reply_count ?? 0) === 1 ? "y" : "ies"}
          </Text>
        </View>
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
  cardText: { color: colors.parchment100, fontSize: 15, marginTop: 6 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  headingCopy: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
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
  localReachPill: { backgroundColor: "#7F1D1D", borderColor: "#991B1B" },
  globalReachPill: { backgroundColor: "#FFFFFF", borderColor: "#D1D5DB" },
  reachPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  globalReachPillText: { color: "#111827" },
  replyRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  replyPill: { borderColor: colors.dusk600, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  replyPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  tagPill: { borderColor: colors.signal500, borderWidth: 1, backgroundColor: `${colors.signal500}1A`, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagPillText: { color: colors.signal400, fontSize: 10, fontFamily: "monospace" },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
