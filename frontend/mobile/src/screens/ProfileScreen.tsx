import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Pressable, TextInput, ScrollView, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { apiFetch } from "../helpers/api";
import { signOut } from "../helpers/auth";
import { echoAudienceLabels } from "../helpers/tags";
import { colors, radii } from "../theme/tokens";
import { Card } from "../components/Shared";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { SetupChecklistBanner } from "../components/SetupChecklistBanner";
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
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
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

  async function confirmDeleteAccount() {
    setDeletingAccount(true);
    setDeleteAccountError(null);
    try {
      await apiFetch("/users/me", { method: "DELETE" });
      await signOut();
      onSignedOut();
    } catch (error) {
      setDeleteAccountError(error instanceof Error ? error.message : "Could not delete your account.");
    } finally {
      setDeletingAccount(false);
    }
  }

  function requestDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This is permanent. Your profile, echoes, private messages, uploads, and sign-in will be removed. Groups you created stay for remaining members. Replies other people left on your echoes will also be removed.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete account", style: "destructive", onPress: () => void confirmDeleteAccount() },
      ]
    );
  }

  if (!user) return <ActivityIndicator color={colors.signal500} style={{ marginTop: 40 }} />;

  const audienceLabels = echoAudienceLabels(user.tags, user.course_codes);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingBottom: tabBarHeight + 32 }]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.title}>Your profile</Text>

      <SetupChecklistBanner surface="profile" style={{ marginBottom: 12 }} />

      <Card style={{ marginBottom: 12 }}>
        <View style={styles.identityRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user.display_name}</Text>
            <Text style={styles.username}>@{user.username}</Text>
            {typeof user.age === "number" && <Text style={styles.locationLabel}>{user.age} years old</Text>}
            {user.location_label && <Text style={styles.locationLabel}>{user.location_label}</Text>}
          </View>
          <ProfileAvatar fileId={user.avatar_file_id} scanStatus={user.avatar_scan_status} />
        </View>
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
        {audienceLabels.length === 0 ? (
          <Text style={styles.emptyText}>No tags yet.</Text>
        ) : (
          <>
            <Text style={styles.emptyText}>{audienceLabels.length} selected</Text>
            <View style={styles.pillRow}>
              {audienceLabels.map((label) => (
                <View key={label} style={styles.pill}>
                  <Text style={styles.pillText}>{label}</Text>
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
      {deleteAccountError ? <Text style={styles.errorText}>{deleteAccountError}</Text> : null}
      <Pressable
        style={[styles.deleteAccountButton, deletingAccount && styles.deleteAccountButtonDisabled]}
        onPress={requestDeleteAccount}
        disabled={deletingAccount}
      >
        {deletingAccount ? (
          <ActivityIndicator color={colors.parchment100} />
        ) : (
          <Text style={styles.deleteAccountText}>Delete account</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  content: { padding: 16, flexGrow: 1 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  identityRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
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
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: colors.parchment300, fontSize: 11, fontFamily: "monospace" },
  followTagsButton: { borderColor: colors.signal500, borderWidth: 1, borderRadius: radii.beacon, paddingVertical: 8, alignItems: "center", marginBottom: 10 },
  followTagsButtonText: { color: colors.signal400, fontWeight: "600" },
  signOutButton: { borderColor: colors.rust400, borderWidth: 1, borderRadius: radii.beacon, paddingVertical: 12, alignItems: "center" },
  signOutText: { color: colors.rust400, fontWeight: "600" },
  deleteAccountButton: {
    backgroundColor: colors.rust400,
    borderRadius: radii.beacon,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 12,
  },
  deleteAccountButtonDisabled: { opacity: 0.6 },
  deleteAccountText: { color: colors.parchment100, fontWeight: "700" },
});
