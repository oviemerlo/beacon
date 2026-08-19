import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { apiFetch } from "../helpers/api";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { colors, radii } from "../theme/tokens";
import type { Message } from "../types/api";

export function ConversationDetailScreen({ conversationId }: { conversationId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  async function load() {
    const data = await apiFetch<Message[]>(`/conversations/${conversationId}/messages`);
    setMessages(data);
  }

  useEffect(() => {
    load();
    // Barebone polling — swap for a WebSocket subscription once the
    // backend adds real-time chat (see beacon-backend README "What's next").
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
      await load();
      listRef.current?.scrollToEnd({ animated: true });
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        renderItem={({ item }) => (
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{item.body}</Text>
            <View style={styles.bubbleMetaRow}>
              <Text style={styles.bubbleTime}>
                {new Date(item.sent_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
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
            </View>
          </View>
        )}
      />
      <View style={styles.composerRow}>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor={colors.parchment500}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={send}
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
  bubble: { backgroundColor: colors.dusk900, borderColor: colors.dusk700, borderWidth: 1, borderRadius: radii.beacon, padding: 10, maxWidth: "80%", alignSelf: "flex-start" },
  bubbleText: { color: colors.parchment100, fontSize: 14 },
  bubbleMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  bubbleTime: { color: colors.parchment500, fontSize: 9, fontFamily: "monospace" },
  reportText: { color: colors.rust400, fontSize: 9, fontFamily: "monospace" },
  composerRow: { flexDirection: "row", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: colors.dusk700 },
  input: { flex: 1, backgroundColor: colors.dusk800, borderColor: colors.dusk600, borderWidth: 1, borderRadius: radii.beacon, paddingHorizontal: 14, color: colors.parchment100 },
  sendButton: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingHorizontal: 18, justifyContent: "center" },
  sendButtonText: { color: colors.dusk950, fontWeight: "700" },
});
