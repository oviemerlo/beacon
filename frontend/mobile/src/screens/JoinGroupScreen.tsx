import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Image } from "react-native";
import { ApiError, apiFetch } from "../helpers/api";
import { Card } from "../components/Shared";
import { colors, radii } from "../theme/tokens";
import type { InvitePreview } from "../types/api";

function memberCountLabel(preview: InvitePreview): string {
  if (preview.max_participants == null) {
    return `${preview.participant_count} joined`;
  }
  return `${preview.participant_count}/${preview.max_participants} joined`;
}

export function JoinGroupScreen({
  token,
  onJoined,
}: {
  token: string;
  onJoined: (conversationId: string) => void;
}) {
  const [preview, setPreview] = useState<InvitePreview | null | undefined>(undefined);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<InvitePreview>(`/join/${token}`)
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((err) => {
        if (!active) return;
        if (err instanceof ApiError && (err.status === 404 || err.status === 422)) {
          setPreview(null);
          return;
        }
        setError(err instanceof Error ? err.message : "Couldn't load this invite.");
        setPreview(null);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function join() {
    setJoining(true);
    setError(null);
    try {
      const result = await apiFetch<{ conversation_id: string }>(`/join/${token}`, { method: "POST" });
      onJoined(result.conversation_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't join this group.");
      setJoining(false);
    }
  }

  if (preview === undefined) {
    return <ActivityIndicator color={colors.signal500} style={{ marginTop: 40 }} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.brand}>
        <Image source={require("../assets/echotocrowd-icon.png")} style={styles.brandIcon} />
        <Text style={styles.brandText}>ECHOTOCROWD</Text>
      </View>
      {preview == null ? (
        <Card>
          <Text style={styles.heading}>This invite is no longer active</Text>
          <Text style={styles.sub}>The link may have been revoked, or this group may no longer exist.</Text>
        </Card>
      ) : (
        <Card>
          <Text style={styles.heading}>{preview.conversation_name || "Group chat"}</Text>
          {preview.description ? <Text style={styles.sub}>{preview.description}</Text> : null}
          <Text style={styles.count}>{memberCountLabel(preview)}</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {preview.is_full ? (
            <View style={styles.disabledButton}>
              <Text style={styles.disabledButtonText}>This group is full</Text>
            </View>
          ) : (
            <Pressable style={styles.primaryButton} onPress={() => void join()} disabled={joining}>
              <Text style={styles.primaryButtonText}>{joining ? "Joining…" : "Join group"}</Text>
            </Pressable>
          )}
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  brand: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  brandIcon: { width: 32, height: 32, borderRadius: 8 },
  brandText: { color: colors.signal400, fontWeight: "700", letterSpacing: 2, fontSize: 12 },
  heading: { color: colors.parchment100, fontWeight: "700", fontSize: 18 },
  sub: { color: colors.parchment500, fontSize: 13, marginTop: 8 },
  count: { color: colors.parchment500, fontSize: 13, marginTop: 12 },
  error: { color: colors.rust400, fontSize: 13, marginTop: 12 },
  primaryButton: {
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: { color: colors.dusk950, fontWeight: "700" },
  disabledButton: {
    backgroundColor: colors.dusk800,
    borderRadius: radii.beacon,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
    opacity: 0.7,
  },
  disabledButtonText: { color: colors.parchment500, fontWeight: "600" },
});
