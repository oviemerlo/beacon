import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { apiFetch } from "../lib/api";
import { signOut } from "../lib/auth";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import type { UserProfile } from "../types/api";

export function ProfileScreen({ onSignedOut }: { onSignedOut: () => void }) {
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    apiFetch<UserProfile>("/users/me").then(setUser);
  }, []);

  if (!user) return <ActivityIndicator color={colors.signal500} style={{ marginTop: 40 }} />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your profile</Text>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.name}>{user.display_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {user.location_label && <Text style={styles.locationLabel}>{user.location_label}</Text>}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.sectionLabel}>Tags</Text>
        {user.tags.length === 0 ? (
          <Text style={styles.emptyText}>No tags yet.</Text>
        ) : (
          <View style={styles.pillRow}>
            {user.tags.map((t) => (
              <View key={t.id} style={styles.pill}>
                <Text style={styles.pillText}>{t.label}</Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ marginBottom: 24 }}>
        <Text style={styles.sectionLabel}>Discoverable in broadcasts</Text>
        <Text style={styles.emptyText}>
          Controls whether you're counted in aggregate "people near you" stats — like the weekly
          digest — for others who share your tags. This never exposes your identity individually.
        </Text>
        <Text style={styles.todo}>
          Current: {user.discoverable_in_broadcasts ? "On" : "Off"} — TODO: wire toggle to PATCH /users/me
        </Text>
      </Card>

      <Pressable
        style={styles.signOutButton}
        onPress={async () => {
          await signOut();
          onSignedOut();
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  name: { color: colors.parchment100, fontWeight: "600", fontSize: 16 },
  username: { color: colors.parchment500, fontFamily: "monospace", fontSize: 12, marginTop: 2 },
  locationLabel: { color: colors.parchment500, fontSize: 13, marginTop: 8 },
  sectionLabel: { color: colors.parchment100, fontWeight: "600", marginBottom: 8 },
  emptyText: { color: colors.parchment500, fontSize: 13 },
  todo: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginTop: 10 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  signOutButton: { borderColor: colors.rust400, borderWidth: 1, borderRadius: radii.beacon, paddingVertical: 12, alignItems: "center" },
  signOutText: { color: colors.rust400, fontWeight: "600" },
});
