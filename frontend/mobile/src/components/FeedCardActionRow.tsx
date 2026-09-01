import { Pressable, StyleSheet, Text, View } from "react-native";
import { ShareButton } from "./ShareButton";
import { apiFetch } from "../helpers/api";
import { colors, radii } from "../theme/tokens";

export async function startPrivateConversation(broadcastId: string, firstMessage: string) {
  return apiFetch<{ conversation_id: string }>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      broadcast_id: broadcastId,
      first_message: firstMessage,
    }),
  });
}

export const feedCardActionStyle = {
  pill: {
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: {
    color: colors.parchment500,
    fontSize: 9,
    fontFamily: "monospace",
  },
} as const;

export function FeedCardActionRow({
  broadcastId,
  isOwn,
  senderName,
  content,
  onOpenBroadcast,
  onReplyPrivately,
}: {
  broadcastId: string;
  isOwn: boolean;
  senderName: string;
  content: string;
  onOpenBroadcast: (id: string) => void;
  onReplyPrivately?: () => void;
}) {
  return (
    <View style={styles.replyRow}>
      {!isOwn && (
        <>
          <Pressable onPress={() => onOpenBroadcast(broadcastId)} style={feedCardActionStyle.pill}>
            <Text style={feedCardActionStyle.text}>Reply in feed</Text>
          </Pressable>
          {onReplyPrivately ? (
            <Pressable onPress={onReplyPrivately} style={feedCardActionStyle.pill}>
              <Text style={feedCardActionStyle.text}>Reply privately</Text>
            </Pressable>
          ) : null}
        </>
      )}
      <Pressable onPress={() => onOpenBroadcast(broadcastId)} style={feedCardActionStyle.pill}>
        <Text style={feedCardActionStyle.text}>View thread</Text>
      </Pressable>
      <ShareButton
        broadcastId={broadcastId}
        senderName={senderName}
        content={content}
        style={feedCardActionStyle.pill}
        textStyle={feedCardActionStyle.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  replyRow: { flexDirection: "row", gap: 8, marginTop: 10 },
});
