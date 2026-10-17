import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDistance } from "../helpers/distance";
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
import { FollowButton } from "./FollowButton";
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
  const seenByLabel = featuredReply ? featuredReply.view_count_label : broadcast.view_count_label;
  const displayedEntity = featuredReply
    ? { id: featuredReply.id, sender_id: featuredReply.sender_id, sender_display_name: featuredReply.sender_display_name }
    : { id: broadcast.id, sender_id: broadcast.sender_id, sender_display_name: broadcast.sender_display_name };
  const isOwnDisplayed = currentUserId === displayedEntity.sender_id;
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
  return (
    <Card style={menuOpen ? { ...feedCardStyles.cardOverflow, ...feedCardStyles.cardMenuOpen, ...styles.feedCard } : { ...feedCardStyles.cardOverflow, ...styles.feedCard }}>
      <EchoMediaLayout
        corner={
          currentUserId ? (
            <FeedCardOverflowMenu
              senderName={isOwnDisplayed ? "your post" : displayedEntity.sender_display_name}
              actions={buildFeedCardActions({
                isOwn: isOwnDisplayed,
                broadcastId: displayedEntity.id,
                senderId: displayedEntity.sender_id,
                senderDisplayName: displayedEntity.sender_display_name,
                content: featuredReply ? featuredReply.content : broadcast.content,
                onBlocked,
                onRemoved,
                removeFromFeedId: broadcast.id,
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
            <FollowButton
              userId={displayedEntity.sender_id}
              initialFollowing={Boolean(featuredReply ? featuredReply.sender_is_following : broadcast.sender_is_following)}
              currentUserId={currentUserId}
            />
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
          <Text style={styles.cardMeta} numberOfLines={1} ellipsizeMode="tail">
            {formatBroadcastSentAt(featuredReply ? featuredReply.created_at : broadcast.created_at)}
            {!isOwn ? `  ·  ${formatDistance(broadcast.distance_m)} away` : ""}
          </Text>
          <Pressable
            onPress={() => onOpenBroadcast(broadcast.id)}
            accessibilityRole="link"
            accessibilityLabel={`View thread, ${broadcast.reply_count ?? 0} replies`}
            style={styles.replyCountWrap}
          >
            <Text style={styles.replyCountText} numberOfLines={1}>
              {broadcast.reply_count ?? 0} repl{(broadcast.reply_count ?? 0) === 1 ? "y" : "ies"}
              {seenByLabel ? `  ·  Seen by ${seenByLabel}` : ""}
            </Text>
          </Pressable>
        </View>
        <FeedCardActionRow
          broadcastId={broadcast.id}
          isOwn={isOwn}
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
  metaRow: { flexDirection: "row", flexWrap: "nowrap", alignItems: "center", gap: 8, width: "100%" },
  cardMeta: { color: colors.parchment500, fontSize: 9, fontWeight: "400", fontFamily: "monospace", flexShrink: 1, flexGrow: 0, minWidth: 0 },
  replyCountWrap: { flexShrink: 0, marginLeft: "auto" },
  replyCountText: { color: colors.parchment500, fontSize: 9, fontFamily: "monospace" },
});
