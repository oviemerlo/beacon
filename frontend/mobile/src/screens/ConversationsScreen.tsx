import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { apiFetch } from "../lib/api";
import { pickReasonAndSubmitReport } from "../lib/reportActions";
import { usePolling } from "../lib/usePolling";
import { Card } from "../components/Shared";
import { colors } from "../theme/tokens";
import type { ConversationThread } from "../types/api";

export function ConversationsScreen({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async ({ silent }: { silent: boolean }) => {
    const rows = await apiFetch<ConversationThread[]>("/conversations");
    setThreads(rows);
    if (!silent) setLoading(false);
  }, []);

  usePolling(loadConversations, [loadConversations], 5000);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      {loading ? (
        <ActivityIndicator color={colors.signal500} style={{ marginTop: 20 }} />
      ) : threads.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No conversations yet.</Text>
          <Text style={styles.emptySubtitle}>Reply privately from a broadcast in your feed to start one.</Text>
        </Card>
      ) : (
        <View style={styles.threadList}>
          {threads.map((thread) => (
            <Card key={thread.id}>
              <Pressable onPress={() => onOpenConversation(thread.id)}>
                <Text style={styles.threadName}>{thread.other_participant.display_name}</Text>
                <Text style={styles.threadPreview}>{thread.last_message || "No messages yet."}</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  try {
                    await pickReasonAndSubmitReport("user", thread.other_participant.id);
                  } catch {
                    // Keep list stable on failure.
                  }
                }}
                style={styles.reportPill}
              >
                <Text style={styles.reportPillText}>Report profile</Text>
              </Pressable>
            </Card>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  threadList: { gap: 10 },
  threadName: { color: colors.parchment100, fontWeight: "600" },
  threadPreview: { color: colors.parchment500, fontSize: 13, marginTop: 4 },
  reportPill: { marginTop: 10, borderColor: colors.dusk600, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  reportPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
