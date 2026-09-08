import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { apiFetch } from "../helpers/api";
import { colors, radii } from "../theme/tokens";
import type { UserProfile } from "../types/api";

const PROGRAM_MAX_LEN = 100;

export function DisciplineProgram() {
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = input.trim().length > 0 && !submitting;

  useEffect(() => {
    apiFetch<UserProfile>("/users/me")
      .then((me) => {
        const current = me.tags?.find((tag) => tag.tag_type === "discipline");
        setSavedLabel(current?.label ?? null);
        setEditing(!current);
      })
      .catch(() => {
        setSavedLabel(null);
        setEditing(true);
      });
  }, []);

  async function saveProgram() {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const saved = await apiFetch<{ tag_id: number; label: string }>("/users/me/discipline", {
        method: "PUT",
        body: JSON.stringify({ program_name: input.trim() }),
      });
      setSavedLabel(saved.label);
      setInput("");
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your program");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View>
      <Text style={styles.title}>Your department or program</Text>
      <Text style={styles.helper}>
        Just the subject — e.g. "Nursing," "Computer Science," "Business" — not the full degree title.
      </Text>
      {savedLabel && !editing ? (
        <View style={styles.savedRow}>
          <View style={[styles.pill, styles.pillActive]}>
            <Text style={[styles.pillText, styles.pillTextActive]}>{savedLabel}</Text>
          </View>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => {
              setInput(savedLabel);
              setEditing(true);
            }}
          >
            <Text style={styles.secondaryButtonText}>Edit</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actionRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="e.g. Nursing"
            placeholderTextColor={colors.parchment500}
            value={input}
            onChangeText={setInput}
            maxLength={PROGRAM_MAX_LEN}
            autoCorrect={false}
            onSubmitEditing={saveProgram}
          />
          <Pressable style={[styles.primaryButton, !canSave && styles.disabled]} onPress={saveProgram} disabled={!canSave}>
            <Text style={styles.primaryButtonText}>{submitting ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.parchment100, fontWeight: "600", marginBottom: 4 },
  helper: { color: colors.parchment500, fontSize: 11, marginBottom: 10 },
  input: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
  },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  savedRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  primaryButton: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingHorizontal: 12, paddingVertical: 8 },
  primaryButtonText: { color: colors.dusk950, fontWeight: "700", fontSize: 12 },
  secondaryButton: { backgroundColor: colors.dusk700, borderRadius: radii.beacon, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryButtonText: { color: colors.parchment100, fontWeight: "600", fontSize: 12 },
  disabled: { opacity: 0.4 },
  pill: {
    borderColor: colors.dusk600,
    borderWidth: 1,
    backgroundColor: colors.dusk800,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  pillTextActive: { color: colors.signal400 },
  error: { color: colors.rust400, fontSize: 12, marginTop: 8 },
});
