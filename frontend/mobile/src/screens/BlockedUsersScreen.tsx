import { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from "react-native";

import { apiFetch } from "../helpers/api";
import { colors } from "../theme/tokens";
import { Card } from "../components/Shared";
import type { BlockedUser, BlockedUsersList } from "../types/api";

export function BlockedUsersScreen() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<BlockedUsersList>("/blocks")
      .then((data) => setBlockedUsers(data.blocked_users))
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load blocked users"))
      .finally(() => setLoading(false));
  }, []);

  async function unblock(userId: string) {
    setUnblockingId(userId);
    setError(null);
    const previous = blockedUsers;
    setBlockedUsers((rows) => rows.filter((row) => row.id !== userId));
    try {
      await apiFetch(`/blocks/${userId}`, { method: "DELETE" });
    } catch (err) {
      setBlockedUsers(previous);
      setError(err instanceof Error ? err.message : "Couldn't unblock this user");
    } finally {
      setUnblockingId(null);
    }
  }

  if (loading) {
    return <ActivityIndicator color={colors.signal500} style={{ marginTop: 40 }} />;
  }

  return (
    <View style={styles.container}>
      {error && <Text style={styles.errorText}>{error}</Text>}
      <Card>
        {blockedUsers.length === 0 ? (
          <Text style={styles.emptyText}>You haven't blocked anyone.</Text>
        ) : (
          <FlatList
            data={blockedUsers}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <Text style={styles.username}>@{item.username}</Text>
                <Pressable onPress={() => void unblock(item.id)} disabled={unblockingId === item.id}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  errorText: { color: colors.rust400, fontSize: 13, marginBottom: 12 },
  emptyText: { color: colors.parchment500, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  username: { color: colors.parchment100, fontFamily: "monospace", fontSize: 13, flex: 1 },
  unblockText: { color: colors.signal400, fontWeight: "600", fontSize: 14 },
  separator: { height: 12 },
});
