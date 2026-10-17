import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { apiFetch } from "../helpers/api";
import { colors, radii } from "../theme/tokens";

export async function toggleFollow(userId: string, currentlyFollowing: boolean) {
  await apiFetch(`/users/${userId}/follow`, { method: currentlyFollowing ? "DELETE" : "POST" });
}

export function FollowButton({
  userId,
  initialFollowing,
  currentUserId,
  onChange,
}: {
  userId: string;
  initialFollowing: boolean;
  currentUserId: string | null;
  onChange?: (following: boolean) => void;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFollowing(initialFollowing);
  }, [initialFollowing]);

  if (!currentUserId || currentUserId === userId) return null;

  async function onPress() {
    if (busy) return;
    const previous = following;
    setFollowing(!previous);
    setBusy(true);
    try {
      await toggleFollow(userId, previous);
      onChange?.(!previous);
    } catch {
      setFollowing(previous);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      onPress={() => void onPress()}
      accessibilityRole="button"
      accessibilityState={{ selected: following }}
      style={[styles.button, following && styles.buttonActive]}
      hitSlop={6}
    >
      <Text style={[styles.text, following && styles.textActive]}>{following ? "Following" : "Follow"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderColor: colors.signal500,
    borderWidth: 1,
    borderRadius: radii.beacon,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  buttonActive: { borderColor: colors.parchment500 },
  text: { color: colors.signal400, fontSize: 11, fontWeight: "600" },
  textActive: { color: colors.parchment500 },
});
