import { useCallback, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { apiFetch } from "../helpers/api";
import { reasonLabel } from "../helpers/reports";
import { Card } from "../components/Shared";
import { colors, radii } from "../theme/tokens";
import type { AdminStats, ReportQueueItem } from "../types/api";

export function AdminReportsScreen() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [reports, setReports] = useState<ReportQueueItem[]>([]);
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setError(null);
    try {
      const [nextStats, nextReports] = await Promise.all([
        apiFetch<AdminStats>("/admin/stats"),
        apiFetch<ReportQueueItem[]>("/reports?status=pending&limit=100"),
      ]);
      setStats(nextStats);
      setReports(nextReports);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the reports queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadQueue();
    }, [loadQueue])
  );

  async function resolve(reportId: string, action: "dismiss" | "suspend_user") {
    setResolvingId(reportId);
    setError(null);
    try {
      const notes = notesById[reportId]?.trim();
      await apiFetch(`/reports/${reportId}/resolve`, {
        method: "POST",
        body: JSON.stringify({
          action,
          resolution_notes: notes || undefined,
        }),
      });
      setReports((current) => current.filter((report) => report.id !== reportId));
      setNotesById((current) => {
        const next = { ...current };
        delete next[reportId];
        return next;
      });
      const nextStats = await apiFetch<AdminStats>("/admin/stats");
      setStats(nextStats);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't resolve this report";
      setError(message);
      Alert.alert("Couldn't resolve report", message);
    } finally {
      setResolvingId(null);
    }
  }

  if (loading) return <ActivityIndicator color={colors.signal500} style={{ marginTop: 40 }} />;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Total users</Text>
          <Text style={styles.statValue}>{(stats?.total_users ?? 0).toLocaleString()}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>New users (7d)</Text>
          <Text style={styles.statValue}>{(stats?.new_users_7d ?? 0).toLocaleString()}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statLabel}>Suspended</Text>
          <Text style={styles.statValue}>{(stats?.total_suspended_users ?? 0).toLocaleString()}</Text>
        </Card>
      </View>

      {reports.length === 0 ? (
        <Card>
          <Text style={styles.emptyTitle}>No pending reports.</Text>
          <Text style={styles.emptyText}>The moderation queue is clear.</Text>
        </Card>
      ) : (
        reports.map((report) => (
          <Card key={report.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reason}>{reasonLabel(report.reason)}</Text>
              <Text style={styles.timestamp}>{new Date(report.created_at).toLocaleString()}</Text>
            </View>
            <Text style={styles.meta}>
              Reporter: {report.reporter.display_name} ({report.reporter.username})
            </Text>
            <Text style={styles.meta}>
              Target: {report.target_type} {report.target_id}
            </Text>
            <Text style={report.details ? styles.details : styles.emptyText}>
              {report.details || "No additional details provided."}
            </Text>
            <TextInput
              style={styles.input}
              value={notesById[report.id] ?? ""}
              onChangeText={(value) => setNotesById((current) => ({ ...current, [report.id]: value }))}
              placeholder="Resolution notes (optional)"
              placeholderTextColor={colors.parchment500}
              maxLength={2000}
            />
            <View style={styles.actions}>
              <Pressable
                style={styles.secondaryButton}
                disabled={resolvingId === report.id}
                onPress={() => void resolve(report.id, "dismiss")}
              >
                {resolvingId === report.id ? (
                  <ActivityIndicator color={colors.signal400} />
                ) : (
                  <Text style={styles.secondaryButtonText}>Dismiss</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.primaryButton}
                disabled={resolvingId === report.id}
                onPress={() => void resolve(report.id, "suspend_user")}
              >
                {resolvingId === report.id ? (
                  <ActivityIndicator color={colors.dusk950} />
                ) : (
                  <Text style={styles.primaryButtonText}>Suspend user</Text>
                )}
              </Pressable>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  content: { padding: 16, paddingBottom: 32, gap: 12 },
  errorText: { color: colors.rust400, fontSize: 13 },
  statsRow: { gap: 8 },
  statCard: { marginBottom: 0 },
  statLabel: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace" },
  statValue: { color: colors.parchment100, fontSize: 22, fontWeight: "700", marginTop: 4 },
  emptyTitle: { color: colors.parchment100, fontWeight: "600" },
  emptyText: { color: colors.parchment500, fontSize: 13, marginTop: 4 },
  reportCard: { marginBottom: 0 },
  reportHeader: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "flex-start" },
  reason: { color: colors.parchment100, fontWeight: "600", flex: 1 },
  timestamp: { color: colors.parchment500, fontSize: 11, fontFamily: "monospace" },
  meta: { color: colors.parchment500, fontSize: 13, marginTop: 4 },
  details: { color: colors.parchment100, fontSize: 13, marginTop: 12 },
  input: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 10,
    color: colors.parchment100,
    marginTop: 12,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  secondaryButton: {
    flex: 1,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.parchment100, fontWeight: "600" },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingVertical: 10,
    alignItems: "center",
  },
  primaryButtonText: { color: colors.dusk950, fontWeight: "700" },
});
