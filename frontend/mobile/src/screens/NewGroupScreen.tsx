import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Share, Alert } from "react-native";
import { apiFetch } from "../helpers/api";
import { Card } from "../components/Shared";
import { colors, radii } from "../theme/tokens";
import type { GroupCreateResult } from "../types/api";

export function NewGroupScreen({
  onDone,
}: {
  onDone: (conversationId: string) => void;
}) {
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<GroupCreateResult | null>(null);

  async function onSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Group name is required.");
      return;
    }
    const maxValue = maxParticipants.trim();
    const max_participants = maxValue === "" ? null : Number(maxValue);
    if (max_participants !== null && (!Number.isInteger(max_participants) || max_participants < 2)) {
      setError("Max participants must be at least 2, or left blank for no limit.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiFetch<GroupCreateResult>("/groups", {
        method: "POST",
        body: JSON.stringify({ name: trimmed, max_participants }),
      });
      setCreated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create this group.");
    } finally {
      setSubmitting(false);
    }
  }

  async function shareInvite() {
    if (!created) return;
    try {
      await Share.share({ message: created.invite_url, url: created.invite_url });
    } catch {
      Alert.alert("Invite link", created.invite_url);
    }
  }

  if (created) {
    return (
      <View style={styles.container}>
        <Card>
          <Text style={styles.heading}>Group created.</Text>
          <Text style={styles.sub}>Share this invite link so people can join.</Text>
          <Text selectable style={styles.link}>
            {created.invite_url}
          </Text>
          <Pressable style={styles.secondaryButton} onPress={() => void shareInvite()}>
            <Text style={styles.secondaryButtonText}>Share link</Text>
          </Pressable>
          <Pressable style={styles.primaryButton} onPress={() => onDone(created.conversation_id)}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </Pressable>
        </Card>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>Group name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={200}
          autoFocus
        />
        <Text style={styles.label}>Max participants (optional)</Text>
        <TextInput
          style={styles.input}
          value={maxParticipants}
          onChangeText={setMaxParticipants}
          keyboardType="number-pad"
          placeholder="No limit"
          placeholderTextColor={colors.parchment500}
        />
        <Pressable style={styles.primaryButton} onPress={() => void onSubmit()} disabled={submitting}>
          <Text style={styles.primaryButtonText}>{submitting ? "Creating…" : "Create group"}</Text>
        </Pressable>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  heading: { color: colors.parchment100, fontWeight: "700", fontSize: 16 },
  sub: { color: colors.parchment500, fontSize: 13, marginTop: 6 },
  link: { color: colors.parchment100, fontFamily: "monospace", fontSize: 13, marginTop: 14 },
  error: { color: colors.rust400, fontSize: 13, marginBottom: 12 },
  label: { color: colors.parchment300, fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryButton: {
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: { color: colors.dusk950, fontWeight: "700" },
  secondaryButton: {
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  secondaryButtonText: { color: colors.parchment100, fontWeight: "600" },
});
