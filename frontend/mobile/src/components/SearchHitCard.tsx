import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { echoAudienceLabels } from "../helpers/tags";
import { formatBroadcastSentAt } from "../helpers/time";
import { colors, radii } from "../theme/tokens";
import { EchoBody } from "./EchoBody";
import { Card } from "./Shared";
import { FeedCardActionRow } from "./FeedCardActionRow";
import { buildFeedCardActions, FeedCardOverflowMenu } from "./FeedCardOverflowMenu";
import { SenderAvatar } from "./SenderAvatar";
import { VerifiedMark } from "./VerifiedMark";
import { feedCardStyles } from "./feedCardStyles";
import type { FeedSearchHit } from "../types/api";

export function SearchHitCard({
  hit,
  currentUserId,
  onOpenBroadcast,
  onOpenConversation,
  onPrivateReply,
  onBlocked,
  onRemoved,
}: {
  hit: FeedSearchHit;
  currentUserId: string | null;
  onOpenBroadcast: (id: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onPrivateReply: () => void;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
}) {
  const matchLabel = hit.match_type === "both" ? "Echo + replies" : hit.match_type === "echo" ? "Echo" : "Reply";
  const isOwn = currentUserId === hit.sender_id;
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <Card style={menuOpen ? { ...feedCardStyles.cardOverflow, ...feedCardStyles.cardMenuOpen } : feedCardStyles.cardOverflow}>
      <View style={styles.headingRow}>
        <View style={feedCardStyles.headingCopy}>
          <View style={feedCardStyles.senderCluster}>
            <SenderAvatar fileId={hit.sender_avatar_file_id} name={hit.sender_id === currentUserId ? "You" : hit.sender_display_name} />
            <Text style={styles.senderName}>{hit.sender_id === currentUserId ? "You" : hit.sender_display_name}</Text>
            <VerifiedMark verified={hit.sender_is_verified} />
          </View>
          {echoAudienceLabels(hit.tags, hit.course_codes, hit.course_code).map((label) => (
            <View key={label} style={styles.broadcastTagPill}>
              <Text style={styles.broadcastTagPillText}>{label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.searchCorner}>
          {currentUserId ? (
            <FeedCardOverflowMenu
              senderName={isOwn ? "your post" : hit.sender_display_name}
              actions={buildFeedCardActions({
                isOwn,
                broadcastId: hit.id,
                senderId: hit.sender_id,
                senderDisplayName: hit.sender_display_name,
                onBlocked,
                onRemoved,
              })}
              onOpenChange={setMenuOpen}
            />
          ) : null}
          <View style={styles.tagPill}>
            <Text style={styles.tagPillText}>{matchLabel}</Text>
          </View>
        </View>
      </View>
      <Pressable onPress={() => onOpenBroadcast(hit.id)}>
        <EchoBody style={feedCardStyles.cardText}>{hit.body}</EchoBody>
      </Pressable>
      <Text style={styles.sentAtLabel}>{formatBroadcastSentAt(hit.created_at)}</Text>
      <FeedCardActionRow
        broadcastId={hit.id}
        isOwn={isOwn}
        senderName={isOwn ? "You" : hit.sender_display_name}
        content={hit.body}
        onOpenBroadcast={onOpenBroadcast}
        onReplyPrivately={isOwn ? undefined : onPrivateReply}
      />
      {hit.matches.map((match) => (
        <View key={match.id} style={styles.nestedMatch}>
          <Text style={styles.senderName}>
            {match.sender_id && match.sender_id === currentUserId ? "You" : match.sender_display_name || "Unknown"}
          </Text>
          <Text style={styles.nestedMatchBody}>{match.body}</Text>
          <Text style={styles.sentAtLabel}>
            {formatBroadcastSentAt(match.created_at)}
            {match.source === "message" ? " · private reply" : " · feed reply"}
          </Text>
          <Pressable
            onPress={() => (match.conversation_id ? onOpenConversation(match.conversation_id) : onOpenBroadcast(hit.id))}
            style={styles.replyPill}
          >
            <Text style={styles.replyPillText}>{match.conversation_id ? "Open conversation" : "View thread"}</Text>
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  nestedMatch: { marginTop: 12, marginLeft: 10, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: colors.dusk600, gap: 6 },
  nestedMatchBody: { color: colors.parchment300, fontSize: 14 },
  headingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  senderName: { color: colors.parchment500, fontSize: 12 },
  sentAtLabel: { color: colors.parchment500, fontSize: 11, fontWeight: "400", fontFamily: "monospace", marginTop: 4 },
  searchCorner: { alignItems: "flex-end" },
  broadcastTagPill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  broadcastTagPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  replyPill: { borderColor: colors.dusk600, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  replyPillText: { color: colors.parchment500, fontSize: 9, fontFamily: "monospace" },
  tagPill: { borderColor: colors.signal500, borderWidth: 1, backgroundColor: `${colors.signal500}1A`, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2, marginTop: 32 },
  tagPillText: { color: colors.signal400, fontSize: 10, fontFamily: "monospace" },
});
