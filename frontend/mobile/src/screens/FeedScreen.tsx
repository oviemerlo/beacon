import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from "react-native";
import { apiFetch } from "../lib/api";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import { LocationDriftBanner } from "../components/LocationDriftBanner";
import type { FeedBroadcast, UserProfile } from "../types/api";

type Tab = "for-you" | "opt-in";

export function FeedScreen({ onOpenBroadcast }: { onOpenBroadcast: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("for-you");
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const data = await apiFetch<FeedBroadcast[]>(`/feed/${tab}`);
    setBroadcasts(data);
  }

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  useEffect(() => {
    apiFetch<UserProfile>("/users/me").then(setUser).catch(() => setUser(null));
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {(["for-you", "opt-in"] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t === "for-you" ? "For You" : "Opt-in"}</Text>
          </Pressable>
        ))}
      </View>
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
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.signal500} />}
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>
                {tab === "for-you" ? "Nothing nearby yet." : "You haven't followed any tags yet."}
              </Text>
              <Text style={styles.emptySubtitle}>
                {tab === "for-you"
                  ? "Broadcasts from people and businesses within your radius will show up here."
                  : "Follow a nationality or hobby tag from your profile to see a dedicated feed for it."}
              </Text>
            </Card>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenBroadcast(item.id)}>
              <Card>
                <Text style={styles.cardText}>{item.content}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.cardMeta}>{(item.distance_m / 1000).toFixed(1)} km away</Text>
                  {!!item.shared_tag_count && (
                    <View style={styles.tagPill}>
                      <Text style={styles.tagPillText}>
                        {item.shared_tag_count} shared tag{item.shared_tag_count > 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  tabRow: { flexDirection: "row", gap: 8, padding: 16 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radii.beacon, backgroundColor: colors.dusk800 },
  tabActive: { backgroundColor: colors.signal500 },
  tabText: { color: colors.parchment500, fontWeight: "500" },
  tabTextActive: { color: colors.dusk950 },
  cardText: { color: colors.parchment100, fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  cardMeta: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace" },
  tagPill: { borderColor: colors.signal500, borderWidth: 1, backgroundColor: `${colors.signal500}1A`, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  tagPillText: { color: colors.signal400, fontSize: 10, fontFamily: "monospace" },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
