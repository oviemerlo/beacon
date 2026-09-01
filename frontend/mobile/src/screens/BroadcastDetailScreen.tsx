import { useCallback, useEffect, useState } from "react";
import { View, TextInput, Pressable, Text, StyleSheet, ActivityIndicator, ScrollView, Alert } from "react-native";
import * as Location from "expo-location";
import { apiFetch } from "../helpers/api";
import { reachBadgeLabel } from "../helpers/broadcastReach";
import { splitMentionParts } from "../helpers/mentions";
import { usePolling } from "../helpers/usePolling";
import { echoAudienceLabels } from "../helpers/tags";
import { formatBroadcastSentAt } from "../helpers/time";
import { canAttachFiles, REPLY_MEDIA_LOCKED_MESSAGE, uploadBroadcastAttachment, type PickedUpload } from "../helpers/uploads";
import { colors, radii } from "../theme/tokens";
import { BroadcastAttachments } from "../components/BroadcastAttachments";
import { CharacterCountdown, EchoBody } from "../components/EchoBody";
import { BROADCAST_CONTENT_MAX } from "../helpers/broadcastContent";
import { Card } from "../components/Shared";
import { EchoMediaLayout } from "../components/EchoAttachments";
import { LinkPreviewList } from "../components/LinkPreviewCard";
import { ShareButton } from "../components/ShareButton";
import { SenderAvatar } from "../components/SenderAvatar";
import { VerifiedMark } from "../components/VerifiedMark";
import type { BroadcastThread, FeedBroadcast, UserProfile } from "../types/api";

export function BroadcastDetailScreen({ broadcastId }: { broadcastId: string }) {
  const [thread, setThread] = useState<BroadcastThread | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loadingThread, setLoadingThread] = useState(true);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<PickedUpload[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAttach = canAttachFiles(Boolean(currentUser?.is_verified), Boolean(currentUser?.is_admin));

  useEffect(() => {
    apiFetch<UserProfile>("/users/me").then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const loadThread = useCallback(async ({ silent }: { silent: boolean }) => {
    if (!silent) {
      setLoadingThread(true);
      setThreadError(null);
    }
    try {
      const data = await apiFetch<BroadcastThread>(`/broadcasts/${broadcastId}/thread`);
      setThread(data);
    } catch (e: any) {
      if (!silent) setThreadError(e?.message ?? "Couldn't load this thread.");
    } finally {
      if (!silent) setLoadingThread(false);
    }
  }, [broadcastId]);

  usePolling(loadThread, [loadThread], 5000);

  async function postReplyInFeed() {
    if (!message.trim() || !thread) return;
    const body = message.trim();
    setSending(true);
    setError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission is required to post a reply");
      const pos = await Location.getCurrentPositionAsync({});

      const created = await apiFetch<{ id: string; created_at: string }>("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          content: body,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          is_global: thread.parent.is_global,
          radius_meters: thread.parent.is_global ? undefined : thread.parent.radius_meters ?? 8000,
          tag_match_mode: "any",
          tag_ids: [],
          reply_to_broadcast_id: thread.parent.id,
        }),
      });
      try {
        for (const file of attachments) {
          await uploadBroadcastAttachment(created.id, file);
        }
      } catch {
        // Reply is already live.
      }
      setMessage("");
      setAttachments([]);
      setThread((current) => {
        if (!current) return current;
        if (current.replies.some((reply) => reply.id === created.id)) return current;
        const optimistic: FeedBroadcast = {
          id: created.id,
          sender_id: currentUser?.id ?? "",
          sender_display_name: currentUser?.display_name ?? "You",
          sender_is_verified: currentUser?.is_verified ?? false,
          sender_avatar_file_id: currentUser?.avatar_file_id ?? null,
          content: body,
          distance_m: 0,
          tags: current.parent.tags,
          is_global: current.parent.is_global,
          radius_meters: current.parent.radius_meters,
          created_at: created.created_at,
          reply_count: 0,
        };
        return { ...current, replies: [optimistic, ...current.replies] };
      });
      await loadThread({ silent: true });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't post your reply in feed.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      {loadingThread && <ActivityIndicator color={colors.signal500} style={{ marginBottom: 12 }} />}
      {threadError && <Text style={styles.error}>{threadError}</Text>}
      {thread && (
        <Card style={styles.threadCard}>
          <ThreadItem item={thread.parent} />
          <Text style={styles.repliesHeader}>Replies ({thread.replies.length})</Text>
          {thread.replies.length === 0 ? (
            <Text style={styles.hint}>No public replies yet.</Text>
          ) : (
            <ScrollView style={styles.repliesList} nestedScrollEnabled>
              {thread.replies.map((item) => (
                <ThreadItem key={item.id} item={item} isReply />
              ))}
            </ScrollView>
          )}
        </Card>
      )}
      <Card>
        <TextInput
          style={styles.textarea}
          placeholder="Write your public reply…"
          placeholderTextColor={colors.parchment500}
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={BROADCAST_CONTENT_MAX}
        />
        <CharacterCountdown value={message} />
        <View style={styles.composerTools}>
          <BroadcastAttachments
            files={attachments}
            onChange={setAttachments}
            canAttach={canAttach}
            compact
            onLocked={() => {
              setError(REPLY_MEDIA_LOCKED_MESSAGE);
              Alert.alert("Attachments locked", REPLY_MEDIA_LOCKED_MESSAGE);
            }}
          />
        </View>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable style={styles.button} onPress={postReplyInFeed} disabled={sending || !thread}>
          {sending ? <ActivityIndicator color={colors.dusk950} /> : <Text style={styles.buttonText}>Reply in feed</Text>}
        </Pressable>
        <Text style={styles.hint}>This creates a public broadcast reply.</Text>
      </Card>
    </View>
  );
}

function ThreadItem({ item, isReply = false }: { item: FeedBroadcast; isReply?: boolean }) {
  const reachLabel = reachBadgeLabel(item.is_global, item.radius_meters);
  const audienceLabels = echoAudienceLabels(item.tags, item.course_codes, item.course_code);
  return (
    <View style={[isReply && styles.replyItem]}>
      <EchoMediaLayout attachments={item.attachments}>
        <View style={styles.senderRow}>
          <SenderAvatar fileId={item.sender_avatar_file_id} name={item.sender_display_name} />
          <Text style={styles.senderName}>{item.sender_display_name}</Text>
          <VerifiedMark verified={item.sender_is_verified} />
          {!isReply
            ? audienceLabels.map((label) => (
                <View key={label} style={styles.broadcastTagPill}>
                  <Text style={styles.broadcastTagPillText}>{label}</Text>
                </View>
              ))
            : null}
        </View>
        <EchoBody style={styles.threadContent}>
          {splitMentionParts(item.content).map((part, index) => (
            <Text key={`${item.id}-${index}`} style={part.mention ? styles.mentionInBody : undefined}>
              {part.text}
            </Text>
          ))}
        </EchoBody>
        <LinkPreviewList previews={item.link_previews} />
      </EchoMediaLayout>
        <View style={styles.threadMetaRow}>
          <Text style={styles.sentAtLabel}>{formatBroadcastSentAt(item.created_at)}</Text>
          {!isReply && (
            <View style={styles.reachPill}>
              <Text style={styles.reachPillText}>{reachLabel}</Text>
            </View>
          )}
          <ShareButton
            broadcastId={item.id}
            senderName={item.sender_display_name}
            content={item.content}
            style={styles.sharePill}
            textStyle={styles.sharePillText}
          />
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  threadCard: { marginBottom: 12 },
  repliesHeader: { color: colors.parchment500, fontSize: 11, marginTop: 12, marginBottom: 8, fontFamily: "monospace" },
  repliesList: { maxHeight: 260 },
  replyItem: { borderWidth: 1, borderColor: colors.dusk700, borderRadius: radii.beacon, padding: 10, marginBottom: 8 },
  senderRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  senderName: { color: colors.parchment500, fontSize: 12 },
  broadcastTagPill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  broadcastTagPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  threadContent: { color: colors.parchment100, marginTop: 4 },
  mentionInBody: { color: colors.signal400, fontWeight: "600" },
  threadMetaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 8 },
  sentAtLabel: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace" },
  reachPill: { borderColor: colors.dusk600, borderWidth: 1, backgroundColor: colors.dusk800, borderRadius: radii.pill, paddingHorizontal: 6, paddingVertical: 1 },
  reachPillText: { color: colors.parchment500, fontSize: 8, fontFamily: "monospace" },
  sharePill: { borderColor: colors.dusk600, borderWidth: 1, borderRadius: radii.pill, paddingHorizontal: 10, paddingVertical: 4 },
  sharePillText: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace" },
  textarea: { color: colors.parchment100, minHeight: 100, textAlignVertical: "top" },
  composerTools: { marginTop: 12 },
  error: { color: colors.rust400, fontSize: 13, marginTop: 8 },
  button: { backgroundColor: colors.signal500, borderRadius: radii.beacon, paddingVertical: 12, alignItems: "center", marginTop: 12 },
  buttonText: { color: colors.dusk950, fontWeight: "700" },
  hint: { color: colors.parchment500, fontSize: 11, marginTop: 8 },
});
