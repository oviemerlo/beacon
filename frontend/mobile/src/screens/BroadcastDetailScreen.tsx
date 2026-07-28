import { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import { apiFetch } from "../lib/api";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";

export function BroadcastDetailScreen({ broadcastId, onConversationStarted }: { broadcastId: string; onConversationStarted: (conversationId: string) => void }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendFirstMessage() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await apiFetch<{ conversation_id: string }>("/conversations", {
        method: "POST",
        body: JSON.stringify({ broadcast_id: broadcastId, first_message: message }),
      });
      onConversationStarted(res.conversation_id);
    } catch {
      // Most likely cause: this broadcast was never actually served into
      // this user's feed — enforced server-side in can_initiate_conversation.
      setError("Couldn't start a conversation from this broadcast.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Barebone: fetch GET /broadcasts/{id} (not yet in the API) to show
          the sender, content, and tags above the reply box. */}
      <Card>
        <TextInput
          style={styles.textarea}
          placeholder="Say hello…"
          placeholderTextColor={colors.parchment500}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.button} onPress={sendFirstMessage} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonText}>Send message</Text>}
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  textarea: { color: colors.parchment100, minHeight: 100, textAlignVertical: "top" },
  error: { color: colors.rust400, fontSize: 13, marginTop: 8 },
  button: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  buttonText: { color: colors.dusk950, fontWeight: "700" },
});
