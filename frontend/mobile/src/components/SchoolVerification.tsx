import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import {
  confirmVerification,
  getVerificationStatus,
  searchSchools,
  startVerification,
} from "../helpers/schoolVerification";
import { colors, radii } from "../theme/tokens";
import type { School } from "../types/api";

type Phase = "idle" | "searching" | "school_selected" | "code_sent" | "verified";

export function SchoolVerification({ onVerifiedChange }: { onVerifiedChange?: (verified: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<School[]>([]);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [schoolEmail, setSchoolEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifiedSchoolName, setVerifiedSchoolName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSendCode = useMemo(() => selectedSchool && schoolEmail.trim().length > 0, [selectedSchool, schoolEmail]);

  useEffect(() => {
    getVerificationStatus()
      .then((status) => {
        if (status.verified && status.school_name) {
          setVerifiedSchoolName(status.school_name);
          onVerifiedChange?.(true);
          setPhase("verified");
          return;
        }
        onVerifiedChange?.(false);
        setPhase("idle");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load school verification"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (phase !== "searching") return;
    const q = query.trim();
    if (q.length < 2) {
      setMatches([]);
      return;
    }

    let active = true;
    const timer = setTimeout(() => {
      searchSchools(q)
        .then((schools) => {
          if (active) setMatches(schools);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : "Couldn't search schools");
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phase, query]);

  async function sendCode() {
    if (!selectedSchool) return;
    setSubmitting(true);
    setError(null);
    try {
      await startVerification(selectedSchool.id, schoolEmail.trim());
      setPhase("code_sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send verification code");
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyCode() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await confirmVerification(code.trim());
      setVerifiedSchoolName(result.school_name);
      onVerifiedChange?.(true);
      setPhase("verified");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't verify code");
    } finally {
      setSubmitting(false);
    }
  }

  function selectSchool(school: School) {
    setSelectedSchool(school);
    setMatches([]);
    setQuery(school.name);
    setPhase("school_selected");
    setError(null);
  }

  if (loading) {
    return <ActivityIndicator color={colors.signal500} style={{ marginBottom: 8 }} />;
  }

  return (
    <View>
      {phase === "verified" ? (
        <View style={styles.stack}>
          <View style={styles.verifiedPill}>
            <Text style={styles.verifiedText}>✓</Text>
            <Text style={styles.verifiedText}>{verifiedSchoolName ?? "School"}</Text>
          </View>
        </View>
      ) : (
        <>
          {phase === "idle" && (
            <Pressable style={styles.primaryButton} onPress={() => setPhase("searching")}>
              <Text style={styles.primaryButtonText}>Verify school →</Text>
            </Pressable>
          )}

          {(phase === "searching" || phase === "school_selected" || phase === "code_sent") && (
            <View style={styles.stack}>
              <TextInput
                style={styles.input}
                placeholder="Search school"
                placeholderTextColor={colors.parchment500}
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                  if (phase !== "searching") setPhase("searching");
                }}
              />
              {phase === "searching" && (
                <>
                  {query.trim().length < 2 ? (
                    <Text style={styles.hint}>Type at least 2 characters to search.</Text>
                  ) : (
                    <View style={styles.pillRow}>
                      {matches.map((school) => (
                        <Pressable key={school.id} style={styles.pill} onPress={() => selectSchool(school)}>
                          <Text style={styles.pillText}>
                            {school.name}
                            {school.country ? ` (${school.country})` : ""}
                          </Text>
                        </Pressable>
                      ))}
                      {matches.length === 0 && <Text style={styles.hint}>No schools found.</Text>}
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {(phase === "school_selected" || phase === "code_sent") && selectedSchool && (
            <View style={[styles.stack, { marginTop: 8 }]}>
              <View style={[styles.pill, styles.pillActive]}>
                <Text style={[styles.pillText, styles.pillTextActive]}>
                  {selectedSchool.name}
                  {selectedSchool.country ? ` (${selectedSchool.country})` : ""}
                </Text>
              </View>
              <TextInput
                style={styles.input}
                placeholder="School email"
                placeholderTextColor={colors.parchment500}
                value={schoolEmail}
                onChangeText={setSchoolEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <View style={styles.actionRow}>
                <Pressable style={styles.primaryButton} onPress={sendCode} disabled={!canSendCode || submitting}>
                  <Text style={styles.primaryButtonText}>{submitting && phase !== "code_sent" ? "Sending..." : "Send code"}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={() => setPhase("searching")} disabled={submitting}>
                  <Text style={styles.secondaryButtonText}>Change school</Text>
                </Pressable>
              </View>
            </View>
          )}

          {phase === "code_sent" && (
            <View style={[styles.stack, { marginTop: 8 }]}>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit code"
                placeholderTextColor={colors.parchment500}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
              <View style={styles.actionRow}>
                <Pressable style={styles.primaryButton} onPress={verifyCode} disabled={submitting || code.trim().length !== 6}>
                  <Text style={styles.primaryButtonText}>{submitting ? "Verifying..." : "Verify"}</Text>
                </Pressable>
                <Pressable style={styles.secondaryButton} onPress={sendCode} disabled={submitting || !canSendCode}>
                  <Text style={styles.secondaryButtonText}>Resend code</Text>
                </Pressable>
              </View>
            </View>
          )}
        </>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 8 },
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
  hint: { color: colors.parchment500, fontSize: 11 },
  selectedLabel: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace", marginBottom: 6 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillActive: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  pillTextActive: { color: colors.signal400 },
  verifiedPill: {
    flexDirection: "row",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.moss500,
    backgroundColor: `${colors.moss500}1A`,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  verifiedText: { color: colors.moss500, fontSize: 11, fontFamily: "monospace" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  primaryButton: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingHorizontal: 12, paddingVertical: 8 },
  primaryButtonText: { color: colors.dusk950, fontWeight: "700", fontSize: 12 },
  secondaryButton: { backgroundColor: colors.dusk700, borderRadius: radii.beacon, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryButtonText: { color: colors.parchment100, fontWeight: "600", fontSize: 12 },
  error: { color: colors.rust400, fontSize: 12, marginTop: 8 },
});
