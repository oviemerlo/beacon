import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { reachBadgeLabel } from "../helpers/broadcastReach";
import { echoAudienceLabels } from "../helpers/tags";
import { echoPreview, formatBroadcastSentAt } from "../helpers/time";
import { colors, radii } from "../theme/tokens";
import { EchoBody } from "./EchoBody";
import { Card } from "./Shared";
import { EchoAttachments, EchoMediaLayout } from "./EchoAttachments";
import { LinkPreviewList } from "./LinkPreviewCard";
import { FeedCardActionRow } from "./FeedCardActionRow";
import { buildFeedCardActions, FeedCardOverflowMenu } from "./FeedCardOverflowMenu";
import { SenderAvatar } from "./SenderAvatar";
import { VerifiedMark } from "./VerifiedMark";
import { feedCardStyles } from "./feedCardStyles";
import type { FeedBroadcast } from "../types/api";

export function BroadcastCard({
  broadcast,
  currentUserId,
  onOpenBroadcast,
  onPrivateReply,
  onBlocked,
  onRemoved,
}: {
  broadcast: FeedBroadcast;
  currentUserId: string | null;
  onOpenBroadcast: (id: string) => void;
  onPrivateReply: () => void;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwn = currentUserId === broadcast.sender_id;
  const featuredReply = broadcast.latest_reply ?? null;
  const headerName = featuredReply
    ? currentUserId === featuredReply.sender_id
      ? "You"
      : featuredReply.sender_display_name
    : isOwn
      ? "You"
      : broadcast.sender_display_name;
  const headerVerified = featuredReply ? featuredReply.sender_is_verified : broadcast.sender_is_verified;
  const headerAvatarId = featuredReply ? featuredReply.sender_avatar_file_id : broadcast.sender_avatar_file_id;
  const headerAvatarName = featuredReply ? featuredReply.sender_display_name : broadcast.sender_display_name;
  const reachLabel = reachBadgeLabel(broadcast.is_global, broadcast.radius_meters);

  return (
    <Card style={menuOpen ? { ...feedCardStyles.cardOverflow, ...feedCardStyles.cardMenuOpen, ...styles.feedCard } : { ...feedCardStyles.cardOverflow, ...styles.feedCard }}>
      <EchoMediaLayout
        corner={
          currentUserId ? (
            <FeedCardOverflowMenu
              senderName={isOwn ? "your post" : broadcast.sender_display_name}
              actions={buildFeedCardActions({
                isOwn,
                broadcastId: broadcast.id,
                senderId: broadcast.sender_id,
                senderDisplayName: broadcast.sender_display_name,
                onBlocked,
                onRemoved,
              })}
              onOpenChange={setMenuOpen}
            />
          ) : undefined
        }
      >
        <View style={feedCardStyles.headingCopy}>
          <View style={feedCardStyles.senderCluster}>
            <SenderAvatar fileId={headerAvatarId} name={headerAvatarName} size={36} />
            <Text style={styles.cardSenderName}>{headerName}</Text>
            <VerifiedMark verified={headerVerified} />
          </View>
          {echoAudienceLabels(broadcast.tags, broadcast.course_codes, broadcast.course_code).map((label) => (
            <View key={label} style={styles.cardTagPill}>
              <Text style={styles.cardTagPillText}>{label}</Text>
            </View>
          ))}
        </View>
      </EchoMediaLayout>
      {featuredReply ? (
        <View style={styles.parentQuote}>
          <Text style={styles.parentQuoteLabel}>Replying to</Text>
          <Text style={styles.parentQuoteText} numberOfLines={1}>
            {echoPreview(broadcast.content)}
          </Text>
        </View>
      ) : null}
      <EchoBody style={feedCardStyles.cardText}>{featuredReply ? featuredReply.content : broadcast.content}</EchoBody>
      <LinkPreviewList previews={featuredReply ? featuredReply.link_previews : broadcast.link_previews} />
      {(featuredReply ? featuredReply.attachments : broadcast.attachments)?.length ? (
        <View style={styles.feedMedia}>
          <EchoAttachments attachments={featuredReply ? featuredReply.attachments : broadcast.attachments} />
        </View>
      ) : null}
      <View style={styles.cardFooter}>
        <View style={styles.metaRow}>
          <Text style={styles.cardMeta} numberOfLines={1}>
            {formatBroadcastSentAt(featuredReply ? featuredReply.created_at : broadcast.created_at)}
            {!isOwn ? `  ·  ${(broadcast.distance_m / 1000).toFixed(1)} km away` : ""}
          </Text>
          <View style={styles.reachPill}>
            <Text style={styles.reachPillText}>{reachLabel}</Text>
          </View>
          <Pressable
            onPress={() => onOpenBroadcast(broadcast.id)}
            accessibilityRole="link"
            accessibilityLabel={`View thread, ${broadcast.reply_count ?? 0} replies`}
          >
            <Text style={styles.replyCountText}>
              {broadcast.reply_count ?? 0} repl{(broadcast.reply_count ?? 0) === 1 ? "y" : "ies"}
            </Text>
          </Pressable>
        </View>
        <FeedCardActionRow
          broadcastId={broadcast.id}
          isOwn={isOwn}
          senderName={isOwn ? "You" : broadcast.sender_display_name}
          content={featuredReply ? featuredReply.content : broadcast.content}
          onOpenBroadcast={onOpenBroadcast}
          onReplyPrivately={onPrivateReply}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  parentQuote: {
    marginTop: 10,
    marginBottom: 2,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.dusk600,
  },
  parentQuoteLabel: { color: colors.parchment500, fontSize: 11, marginBottom: 2 },
  parentQuoteText: { color: colors.parchment500, fontSize: 14, fontWeight: "400" },
  feedMedia: { marginTop: 8, marginHorizontal: -4 },
  cardSenderName: { color: colors.parchment100, fontSize: 16, fontWeight: "600" },
  cardTagPill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 2 },
  cardTagPillText: { color: colors.parchment300, fontSize: 11, fontWeight: "500" },
  feedCard: { paddingBottom: 10 },
  cardFooter: { marginTop: "auto", paddingTop: 20 },
  metaRow: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 8 },
  cardMeta: { color: colors.parchment500, fontSize: 9, fontWeight: "400", fontFamily: "monospace" },
  reachPill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 1 },
  reachPillText: { color: colors.parchment500, fontSize: 8, fontFamily: "monospace" },
  replyCountText: { color: colors.parchment500, fontSize: 9, fontFamily: "monospace" },
});
