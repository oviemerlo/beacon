import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { apiFetch } from "../helpers/api";
import { useViewerUser } from "../helpers/viewerUser";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import { FollowButton } from "../components/FollowButton";
import { SenderAvatar } from "../components/SenderAvatar";
import { VerifiedMark } from "../components/VerifiedMark";
import type { FollowingListItem, FollowTarget } from "../types/api";

type Tab = "search" | "following";

export function UserSearchScreen() {
  const { user } = useViewerUser();
  const currentUserId = user?.id ?? null;
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FollowTarget[]>([]);
  const [following, setFollowing] = useState<FollowTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tab !== "search") return;
    const keyword = query.trim();
    if (!keyword) {
      setResults([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      apiFetch<FollowTarget[]>(`/users/search?q=${encodeURIComponent(keyword)}`)
        .then((rows) => {
          if (!cancelled) {
            setResults(rows);
            setError(null);
          }
        })
        .catch((e) => !cancelled && setError(e?.message ?? "Couldn't search"))
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, tab]);

  useEffect(() => {
    if (tab !== "following") return;
    setLoading(true);
    apiFetch<FollowingListItem[]>("/users/me/following")
      .then((rows) => {
        setFollowing(rows.map((row) => ({ ...row, is_following: true })));
        setError(null);
      })
      .catch((e) => setError(e?.message ?? "Couldn't load who you follow"))
      .finally(() => setLoading(false));
  }, [tab]);

  const rows = tab === "search" ? results : following;

  return (
    <View style={styles.container}>
      <View style={styles.tabs}>
        {(["search", "following"] as const).map((value) => (
          <Pressable key={value} onPress={() => setTab(value)} style={[styles.tab, tab === value && styles.tabActive]}>
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>{value === "search" ? "Search" : "Following"}</Text>
          </Pressable>
        ))}
      </View>
      {tab === "search" && (
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search by wavelength or name"
          placeholderTextColor={colors.parchment500}
          autoCapitalize="none"
          autoCorrect={false}
        />
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
      {loading && <ActivityIndicator color={colors.signal500} style={{ marginBottom: 12 }} />}
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ gap: 10, paddingBottom: 24 }}
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyText}>
              {tab === "following" ? "You aren't following anyone yet." : query.trim() ? "No matches." : "Find people and businesses to follow."}
            </Text>
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.row}>
            <SenderAvatar fileId={item.avatar_file_id} name={item.display_name} size={36} />
            <View style={styles.rowCopy}>
              <View style={styles.nameRow}>
                <Text style={styles.displayName} numberOfLines={1}>{item.display_name}</Text>
                <VerifiedMark verified={item.is_verified} />
              </View>
              <Text style={styles.username} numberOfLines={1}>
                @{item.username}
                {item.account_type === "business" ? "  ·  Business" : ""}
              </Text>
            </View>
            <FollowButton userId={item.id} initialFollowing={item.is_following} currentUserId={currentUserId} />
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  tabs: { flexDirection: "row", gap: 8, marginBottom: 12 },
  tab: { flex: 1, borderColor: colors.dusk600, borderWidth: 1, borderRadius: radii.beacon, paddingVertical: 8, alignItems: "center" },
  tabActive: { borderColor: colors.signal500 },
  tabText: { color: colors.parchment500, fontWeight: "600" },
  tabTextActive: { color: colors.signal400 },
  searchInput: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: { color: colors.rust400, fontSize: 13, marginBottom: 12 },
  emptyText: { color: colors.parchment500, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  displayName: { color: colors.parchment100, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  username: { color: colors.parchment500, fontFamily: "monospace", fontSize: 12, marginTop: 2 },
});
