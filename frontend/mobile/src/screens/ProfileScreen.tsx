import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { apiFetch } from "../helpers/api";
import { signOut } from "../helpers/auth";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import type { BlockedUsersList, UserProfile } from "../types/api";

export function ProfileScreen({
  onSignedOut,
  onOpenFollowTags,
  onOpenBlockedUsers,
  onOpenAdminReports,
}: {
  onSignedOut: () => void;
  onOpenFollowTags: () => void;
  onOpenBlockedUsers: () => void;
  onOpenAdminReports: () => void;
}) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [blockedCount, setBlockedCount] = useState(0);
  const [displayNameDraft, setDisplayNameDraft] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const tabBarHeight = useBottomTabBarHeight();

  useFocusEffect(
    useCallback(() => {
      apiFetch<UserProfile>("/users/me")
        .then((me) => {
          setUser(me);
          setDisplayNameDraft((current) => current || me.display_name);
        })
        .catch(() => {});
      apiFetch<BlockedUsersList>("/blocks")
        .then((data) => setBlockedCount(data.blocked_users.length))
        .catch(() => setBlockedCount(0));
    }, [])
  );

  async function saveDisplayName() {
    const trimmed = displayNameDraft.trim();
    if (!trimmed) {
      setDisplayNameError("Display name is required.");
      return;
    }

    setSavingDisplayName(true);
    setDisplayNameError(null);
    try {
      const updated = await apiFetch<UserProfile>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ display_name: trimmed }),
      });
      setUser(updated);
      setDisplayNameDraft(updated.display_name);
    } catch (error) {
      setDisplayNameError(error instanceof Error ? error.message : "Could not update display name.");
    } finally {
      setSavingDisplayName(false);
    }
  }

  if (!user) return <ActivityIndicator color={colors.signal500} style={{ marginTop: 40 }} />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 32 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>Your profile</Text>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.name}>{user.display_name}</Text>
        <Text style={styles.username}>@{user.username}</Text>
        {typeof user.age === "number" && <Text style={styles.locationLabel}>{user.age} years old</Text>}
        {user.location_label && <Text style={styles.locationLabel}>{user.location_label}</Text>}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.sectionLabel}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayNameDraft}
          onChangeText={setDisplayNameDraft}
          placeholder="Display name"
          placeholderTextColor={colors.parchment500}
          autoCapitalize="words"
        />
        {displayNameError && <Text style={styles.errorText}>{displayNameError}</Text>}
        <Pressable style={styles.saveButton} onPress={saveDisplayName} disabled={savingDisplayName}>
          {savingDisplayName ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.saveButtonText}>Save name</Text>}
        </Pressable>
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.sectionLabel}>Tags</Text>
        <Pressable onPress={onOpenFollowTags} style={styles.followTagsButton}>
          <Text style={styles.followTagsButtonText}>Echo Tags</Text>
        </Pressable>
        {user.tags.length === 0 ? (
          <Text style={styles.emptyText}>No tags yet.</Text>
        ) : (
          <>
            <Text style={styles.emptyText}>{user.tags.length} selected</Text>
            <View style={styles.pillRow}>
              {user.tags.map((t) => (
                <View key={t.id} style={styles.pill}>
                  <Text style={styles.pillText}>{t.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </Card>

      <Card style={{ marginBottom: 12 }}>
        <Text style={styles.sectionLabel}>Blocked users</Text>
        <Pressable onPress={onOpenBlockedUsers} style={styles.followTagsButton}>
          <Text style={styles.followTagsButtonText}>Manage</Text>
        </Pressable>
        <Text style={styles.emptyText}>{blockedCount} blocked</Text>
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

      {user.is_admin ? (
        <Card style={{ marginBottom: 24 }}>
          <Text style={styles.sectionLabel}>Moderation</Text>
          <Pressable onPress={onOpenAdminReports} style={styles.followTagsButton}>
            <Text style={styles.followTagsButtonText}>Open admin reports queue</Text>
          </Pressable>
        </Card>
      ) : null}

      <Pressable
        style={styles.signOutButton}
        onPress={async () => {
          await signOut();
          onSignedOut();
        }}
      >
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  content: { padding: 16, flexGrow: 1 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  name: { color: colors.parchment100, fontWeight: "600", fontSize: 16 },
  username: { color: colors.parchment500, fontFamily: "monospace", fontSize: 12, marginTop: 2 },
  locationLabel: { color: colors.parchment500, fontSize: 13, marginTop: 8 },
  input: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 10,
    color: colors.parchment100,
  },
  saveButton: {
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: { color: colors.dusk950, fontWeight: "700" },
  errorText: { color: colors.rust400, fontSize: 12, marginTop: 8 },
  sectionLabel: { color: colors.parchment100, fontWeight: "600", marginBottom: 8 },
  emptyText: { color: colors.parchment500, fontSize: 13, marginBottom: 8 },
  todo: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginTop: 10 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  followTagsButton: { borderColor: colors.signal500, borderWidth: 1, borderRadius: radii.beacon, paddingVertical: 8, alignItems: "center", marginBottom: 10 },
  followTagsButtonText: { color: colors.signal400, fontWeight: "600" },
  signOutButton: { borderColor: colors.rust400, borderWidth: 1, borderRadius: radii.beacon, paddingVertical: 12, alignItems: "center" },
  signOutText: { color: colors.rust400, fontWeight: "600" },
});
