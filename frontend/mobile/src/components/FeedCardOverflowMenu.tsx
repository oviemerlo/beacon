import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "../helpers/api";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { colors, radii } from "../theme/tokens";

export type OverflowAction = { label: string; onSelect: () => void };

export function buildFeedCardActions({
  isOwn,
  broadcastId,
  senderId,
  senderDisplayName,
  onBlocked,
  onRemoved,
  removeFromFeedId,
}: {
  isOwn: boolean;
  broadcastId: string;
  senderId: string;
  senderDisplayName: string;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
  removeFromFeedId?: string;
}): OverflowAction[] {
  const hideId = removeFromFeedId ?? broadcastId;
  if (isOwn) {
    return [
      {
        label: "Delete",
        onSelect: () => {
          Alert.alert("Delete this Echo?", "It will disappear from everyone's feed.", [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                void (async () => {
                  try {
                    await apiFetch(`/broadcasts/${broadcastId}`, { method: "DELETE" });
                    onRemoved(broadcastId);
                  } catch {
                    Alert.alert("Couldn't delete this Echo.");
                  }
                })();
              },
            },
          ]);
        },
      },
    ];
  }
  return [
    {
      label: "Report",
      onSelect: () => {
        void (async () => {
          try {
            await pickReasonAndSubmitReport("broadcast", broadcastId);
          } catch {
            // Keep feed stable on failure.
          }
        })();
      },
    },
    {
      label: "Block",
      onSelect: () => {
        Alert.alert(
          `Block ${senderDisplayName}?`,
          "You won't see their posts in your feed, including ones already here. They can still see your broadcasts.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Block",
              style: "destructive",
              onPress: () => {
                void (async () => {
                  try {
                    await apiFetch(`/blocks/${senderId}`, { method: "PUT" });
                    onBlocked(senderId);
                  } catch {
                    Alert.alert("Couldn't block this user.");
                  }
                })();
              },
            },
          ]
        );
      },
    },
    {
      label: "Remove from my feed",
      onSelect: () => {
        void (async () => {
          try {
                    await apiFetch(`/broadcasts/${hideId}/hide`, { method: "PUT" });
                    onRemoved(hideId);
          } catch {
            Alert.alert("Couldn't remove this Echo from your feed.");
          }
        })();
      },
    },
  ];
}

export function FeedCardOverflowMenu({
  senderName,
  actions,
  onOpenChange,
}: {
  senderName: string;
  actions: OverflowAction[];
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);

  function setMenuOpen(next: boolean) {
    setOpen(next);
    onOpenChange?.(next);
  }

  return (
    <View style={styles.overflowWrap}>
      <Pressable
        accessibilityLabel={`More actions for ${senderName}`}
        onPress={() => setMenuOpen(!open)}
        style={styles.overflowButton}
      >
        <Text style={styles.overflowButtonText}>⋯</Text>
      </Pressable>
      {open && (
        <View style={styles.overflowMenu}>
          {actions.map((action) => (
            <Pressable
              key={action.label}
              onPress={() => {
                setMenuOpen(false);
                action.onSelect();
              }}
              style={styles.overflowMenuItem}
            >
              <Text style={styles.overflowMenuItemText}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overflowWrap: { position: "relative", zIndex: 2 },
  overflowButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
  },
  overflowButtonText: { color: colors.parchment300, fontSize: 16, lineHeight: 16 },
  overflowMenu: {
    position: "absolute",
    top: 32,
    right: 0,
    minWidth: 180,
    borderRadius: radii.beacon,
    borderWidth: 1,
    borderColor: colors.dusk600,
    backgroundColor: colors.dusk800,
    overflow: "hidden",
    zIndex: 20,
    elevation: 16,
  },
  overflowMenuItem: { paddingHorizontal: 12, paddingVertical: 10 },
  overflowMenuItemText: { color: colors.parchment100, fontSize: 14 },
});
