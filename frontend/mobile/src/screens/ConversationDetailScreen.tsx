import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { apiFetch } from "../helpers/api";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { formatMessageSentAt } from "../helpers/time";
import { colors, radii } from "../theme/tokens";
import type { ConversationContext, Message, UserProfile } from "../types/api";

export function ConversationDetailScreen({ conversationId }: { conversationId: string }) {
  const navigation = useNavigation<any>();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [composerHeight, setComposerHeight] = useState(44);
  const listRef = useRef<FlatList>(null);

  async function load() {
    const [me, details, data] = await Promise.all([
      apiFetch<UserProfile>("/users/me"),
      apiFetch<ConversationContext>(`/conversations/${conversationId}`),
      apiFetch<Message[]>(`/conversations/${conversationId}/messages`),
    ]);
    setCurrentUserId(me.id);
    setContext(details);
    setMessages(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    try {
      await apiFetch(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body: draft }) });
      setDraft("");
      setComposerHeight(44);
      await load();
      listRef.current?.scrollToEnd({ animated: true });
    } finally {
      setSending(false);
    }
  }

  const originWasMine = context?.origin_broadcast_sender_id === currentUserId;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => navigation.getParent()?.navigate("Messages", { screen: "ConversationsHome" })}
        style={styles.backLink}
      >
        <Text style={styles.backLinkText}>Back to messages</Text>
      </Pressable>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          context ? (
            <View style={[styles.row, originWasMine ? styles.rowOutgoing : styles.rowIncoming]}>
              <View style={styles.originHeader}>
                <Text style={styles.contextLabel}>
                  {originWasMine
                    ? "Your broadcast:"
                    : `Broadcast from ${context.origin_broadcast_sender_display_name}:`}
                </Text>
                <Text style={styles.contextPreview}>{context.origin_broadcast_preview}</Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (!currentUserId) return null;
          const isMine = String(item.sender_id) === String(currentUserId);
          const isUnread = !isMine && item.read_at == null;
          return (
            <View style={[styles.row, isMine ? styles.rowOutgoing : styles.rowIncoming]}>
              <View style={styles.bubble}>
                <Text style={[styles.senderLabel, !isUnread && styles.senderLabelRead]}>
                  {isMine ? "You:" : `${context?.other_participant_display_name ?? "Unknown"}:`}
                </Text>
                <Text style={[styles.bubbleText, isUnread ? styles.bubbleTextUnread : styles.bubbleTextRead]}>
                  {item.body}
                </Text>
                <View style={styles.bubbleMetaRow}>
                  {!isMine ? (
                    <Pressable
                      onPress={async () => {
                        try {
                          await pickReasonAndSubmitReport("message", item.id);
                        } catch {
                          // Keep conversation stable on failure.
                        }
                      }}
                    >
                      <Text style={styles.reportText}>Report</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Text style={styles.bubbleTime}>
                    {formatMessageSentAt(item.sent_at)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.composerRow}>
        <TextInput
          style={[styles.input, { height: composerHeight }]}
          placeholder="Message…"
          placeholderTextColor={colors.parchment500}
          value={draft}
          onChangeText={setDraft}
          multiline
          blurOnSubmit={false}
          textAlignVertical="top"
          onContentSizeChange={(event) => {
            const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height);
            const nextHeight = Math.max(44, Math.min(140, measuredHeight + 12));
            setComposerHeight(nextHeight);
          }}
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={sending}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  backLink: {
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  backLinkText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  listContent: { padding: 16, gap: 10, paddingBottom: 12, flexGrow: 1 },
  originHeader: {
    maxWidth: "78%",
    borderLeftWidth: 3,
    borderLeftColor: colors.signal500,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderRadius: radii.beacon,
    backgroundColor: colors.dusk800,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  contextLabel: { color: colors.signal400, fontWeight: "700", marginBottom: 3, fontSize: 11 },
  contextPreview: { color: colors.parchment300, fontSize: 12, fontStyle: "italic" },
  row: { width: "100%" },
  rowIncoming: { alignItems: "flex-start" },
  rowOutgoing: { alignItems: "flex-end" },
  bubble: {
    backgroundColor: colors.dusk900,
    borderColor: colors.dusk700,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 10,
    maxWidth: "78%",
  },
  senderLabel: { color: colors.parchment100, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  senderLabelRead: { fontWeight: "400" },
  bubbleText: { color: colors.parchment100, fontSize: 14 },
  bubbleTextUnread: { fontWeight: "700" },
  bubbleTextRead: { fontWeight: "400" },
  bubbleMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  bubbleTime: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginLeft: 12 },
  reportText: { color: colors.rust400, fontSize: 9, fontFamily: "monospace" },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: colors.dusk700 },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.parchment100,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: colors.dusk950, fontWeight: "700", fontSize: 15 },
});
