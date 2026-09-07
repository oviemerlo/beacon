import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../helpers/api";
import { formatMessageSentAt } from "../helpers/time";
import { Card } from "../components/Shared";
import { colors } from "../theme/tokens";
import type { GroupSummary } from "../types/api";

export function GroupsScreen({
  onOpenConversation,
  onCreateGroup,
}: {
  onOpenConversation: (id: string) => void;
  onCreateGroup: () => void;
}) {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setError(null);
      apiFetch<GroupSummary[]>("/groups")
        .then((rows) => {
          if (!active) return;
          setGroups(rows);
        })
        .catch((err) => {
          if (!active) return;
          setError(err instanceof Error ? err.message : "Couldn't load groups.");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Group chats</Text>
        <Pressable onPress={onCreateGroup}>
          <Text style={styles.createLink}>Create a group chat</Text>
        </Pressable>
      </View>
      {loading ? (
        <ActivityIndicator color={colors.signal500} style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={styles.error}>{error}</Text>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(group) => group.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Card>
              <Text style={styles.emptyTitle}>You haven't joined any groups yet.</Text>
              <Pressable onPress={onCreateGroup} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Create a group chat</Text>
              </Pressable>
            </Card>
          }
          renderItem={({ item: group }) => {
            const countLabel =
              group.max_participants == null
                ? `${group.participant_count} joined`
                : `${group.participant_count}/${group.max_participants} joined`;
            return (
              <Pressable onPress={() => onOpenConversation(group.id)}>
                <Card>
                  <Text style={styles.groupName}>{group.name || "Untitled group"}</Text>
                  <Text style={styles.count}>{countLabel}</Text>
                  <Text style={styles.preview}>{group.last_message || "No messages yet."}</Text>
                  <Text style={styles.time}>{formatMessageSentAt(group.last_message_at)}</Text>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", flex: 1 },
  createLink: { color: colors.signal400, fontSize: 13, fontWeight: "600" },
  error: { color: colors.rust400, fontSize: 13 },
  list: { gap: 10, paddingBottom: 24 },
  groupName: { color: colors.parchment100, fontWeight: "600", fontSize: 16 },
  count: { color: colors.parchment500, fontSize: 13, marginTop: 4 },
  preview: { color: colors.parchment100, fontSize: 14, marginTop: 8 },
  time: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginTop: 4 },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptyButton: {
    marginTop: 14,
    alignSelf: "center",
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  emptyButtonText: { color: colors.parchment100, fontWeight: "600" },
});
