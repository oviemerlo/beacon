import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../helpers/api";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { formatMessageSentAt } from "../helpers/time";
import { Card } from "../components/Shared";
import { colors } from "../theme/tokens";
import type { ConversationThread } from "../types/api";

export function ConversationsScreen({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadConversations = async ({ silent }: { silent: boolean }) => {
        const rows = await apiFetch<ConversationThread[]>("/conversations");
        if (!active) return;
        setThreads(rows);
        if (!silent) setLoading(false);
        try {
          await apiFetch("/conversations/mark-seen", { method: "POST" });
          if (!active) return;
          setThreads((current) => current.map((thread) => ({ ...thread, unread_count: 0 })));
        } catch {
          // Keep inbox rendering even if read-state update fails.
        }
      };

      void loadConversations({ silent: false });
      const interval = setInterval(() => {
        void loadConversations({ silent: true });
      }, 5000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [])
  );

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
        <FlatList
          data={threads}
          keyExtractor={(thread) => thread.id}
          contentContainerStyle={styles.threadList}
          renderItem={({ item: thread }) => {
            const isIncomingLatest = thread.last_message_sender_id === thread.other_participant.id;
            const isUnread = (thread.unread_count ?? 0) > 0;
            const originWasMine = thread.is_reply_to_you;
            const quotePrefix = originWasMine
              ? "Your broadcast: "
              : `Broadcast from ${thread.origin_broadcast_sender_display_name}: `;
            return (
              <Card>
                <Pressable onPress={() => onOpenConversation(thread.id)}>
                  <View style={originWasMine ? styles.quoteOutgoing : styles.quoteIncoming}>
                    <Text style={styles.originPreview}>
                      {quotePrefix}
                      {thread.origin_broadcast_preview}
                    </Text>
                  </View>
                  {isIncomingLatest ? (
                    <View style={styles.incomingColumn}>
                      <Text style={[styles.threadName, !isUnread && styles.threadNameRead]}>
                        {thread.other_participant.display_name}:
                      </Text>
                      <Text style={[styles.threadPreview, !isUnread && styles.threadPreviewRead]}>
                        {thread.last_message || "No messages yet."}
                      </Text>
                      <Text style={styles.threadTime}>
                        {formatMessageSentAt(thread.last_message_at)}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.outgoingColumn}>
                      <Text style={styles.threadNameRead}>You:</Text>
                      <Text style={styles.outgoingSummaryMessage}>{thread.last_message || "No messages yet."}</Text>
                      <Text style={styles.threadTime}>
                        {formatMessageSentAt(thread.last_message_at)}
                      </Text>
                    </View>
                  )}
                </Pressable>
                <View style={styles.actionRow}>
                  <Pressable onPress={() => onOpenConversation(thread.id)} style={styles.actionPill}>
                    <Text style={styles.actionPillText}>View conversation</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      try {
                        await pickReasonAndSubmitReport("user", thread.other_participant.id);
                      } catch {
                        // Keep list stable on failure.
                      }
                    }}
                    style={styles.actionPill}
                  >
                    <Text style={styles.actionPillText}>Report profile</Text>
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  threadList: { gap: 10, paddingBottom: 24 },
  quoteIncoming: {
    marginTop: 2,
    marginBottom: 8,
    alignSelf: "flex-start",
    maxWidth: "62%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.dusk800,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderLeftWidth: 3,
    borderLeftColor: colors.signal500,
  },
  quoteOutgoing: {
    marginTop: 2,
    marginBottom: 8,
    alignSelf: "flex-end",
    maxWidth: "62%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.dusk800,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderLeftWidth: 3,
    borderLeftColor: colors.signal500,
  },
  incomingColumn: { alignSelf: "flex-start", maxWidth: "62%" },
  outgoingColumn: { alignSelf: "flex-end", maxWidth: "62%", alignItems: "flex-end" },
  threadName: { color: colors.parchment100, fontWeight: "700" },
  threadNameRead: { color: colors.parchment100, fontWeight: "400" },
  threadTime: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginTop: 4 },
  originPreview: { color: colors.parchment300, fontSize: 12, fontStyle: "italic" },
  threadPreview: { color: colors.parchment100, fontSize: 13, fontWeight: "700", marginTop: 2 },
  threadPreviewRead: { fontWeight: "400" },
  outgoingSummaryMessage: { color: colors.parchment100, fontSize: 13, fontWeight: "400", marginTop: 2, textAlign: "right" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionPill: { borderColor: colors.dusk600, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  actionPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
