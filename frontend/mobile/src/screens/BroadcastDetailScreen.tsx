import { useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import { apiFetch } from "../lib/api";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";

export function BroadcastDetailScreen({ broadcastId, onConversationStarted }: { broadcastId: string; onConversationStarted: (conversationId: string) => void }) {
  void broadcastId, onConversationStarted;
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function postReplyInFeed() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission is required to post a reply");
      const pos = await Location.getCurrentPositionAsync({});

      await apiFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          content: message.trim(),
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          is_global: false,
          radius_meters: 8000,
          tag_match_mode: "any",
          tag_ids: [],
        }),
      });
      setMessage("");
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post your reply in feed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Card>
        <TextInput
          style={styles.textarea}
          placeholder="Write your public reply…"
          placeholderTextColor={colors.parchment500}
          value={message}
          onChangeText={setMessage}
          multiline
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.button} onPress={postReplyInFeed} disabled={sending}>
          {sending ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonText}>Reply in feed</Text>}
        </Pressable>
        <Text style={styles.hint}>This creates a public broadcast reply.</Text>
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
  hint: { color: colors.parchment500, fontSize: 11, marginTop: 8 },
});
