import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { apiFetch } from "../helpers/api";
import { applyMention, mentionTriggerFromInput, splitMentionParts } from "../helpers/mentions";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { formatMessageSentAt } from "../helpers/time";
import { colors, radii } from "../theme/tokens";
import { LinkPreviewList } from "../components/LinkPreviewCard";
import type { ConversationContext, MentionCandidate, Message, UserProfile } from "../types/api";

export function ConversationDetailScreen({ conversationId }: { conversationId: string }) {
  const navigation = useNavigation<any>();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [context, setContext] = useState<ConversationContext | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [composerHeight, setComposerHeight] = useState(44);
  const [candidates, setCandidates] = useState<MentionCandidate[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionLoading, setMentionLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(0);
  const [cursor, setCursor] = useState(0);
  const listRef = useRef<FlatList>(null);
  const draftRef = useRef("");
  const mentionFetchedFor = useRef<string | null>(null);
  const mentionFetchInFlight = useRef(false);

  async function load() {
    const [me, details, data] = await Promise.all([
      apiFetch<UserProfile>("/users/me"),
      apiFetch<ConversationContext>(`/conversations/${conversationId}`),
      apiFetch<Message[]>(`/conversations/${conversationId}/messages`),
    ]);
    setCurrentUserId(me.id);
    setContext(details);
    setMessages(data);
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  async function loadMentionCandidates(reason: string) {
    const echoId = context?.origin_broadcast_id ?? null;
    const path = `/conversations/${conversationId}/mention-candidates`;
    if (mentionFetchInFlight.current && reason !== "mount") {
      console.log("[mentions] fetch skipped: already in flight", { reason, conversationId, echoId });
      return candidates;
    }
    mentionFetchInFlight.current = true;
    console.log("[mentions] fetch called", { reason, conversationId, echoId, path });
    setMentionLoading(true);
    try {
      const rows = await apiFetch<MentionCandidate[]>(path);
      const responseEchoId = rows[0]?.echo_id ?? echoId;
      console.log("[mentions] response received", {
        conversationId,
        echoId: responseEchoId,
        count: rows.length,
        usernames: rows.map((row) => row.username),
      });
      setCandidates(rows);
      mentionFetchedFor.current = conversationId;
      return rows;
    } catch (error) {
      console.error("[mentions] fetch failed", { conversationId, echoId, path, error });
      setCandidates([]);
      return [];
    } finally {
      mentionFetchInFlight.current = false;
      setMentionLoading(false);
    }
  }

  useEffect(() => {
    mentionFetchedFor.current = null;
    void loadMentionCandidates("mount");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  function updateMentionState(value: string, nextCursor: number) {
    const active = mentionTriggerFromInput(value, nextCursor);
    if (!active) {
      setMentionOpen(false);
      return;
    }
    const echoId = context?.origin_broadcast_id ?? null;
    console.log("[mentions] trigger detected", {
      query: active.query,
      start: active.start,
      cursor: nextCursor,
      conversationId,
      echoId,
    });
    setMentionStart(active.start);
    setMentionQuery(active.query);
    setMentionOpen(true);
    const shouldFetch = mentionFetchedFor.current !== conversationId || candidates.length === 0;
    if (shouldFetch) {
      void loadMentionCandidates("trigger").then((rows) => {
        const filteredCount = rows.filter((candidate) => {
          const q = active.query.toLowerCase();
          return candidate.username.toLowerCase().startsWith(q) || candidate.display_name.toLowerCase().startsWith(q);
        }).length;
        console.log("[mentions] dropdown state updated", {
          mentionOpen: true,
          query: active.query,
          candidateCount: filteredCount,
          fetchedCount: rows.length,
        });
      });
      return;
    }
    const filteredCount = candidates.filter((candidate) => {
      const q = active.query.toLowerCase();
      return candidate.username.toLowerCase().startsWith(q) || candidate.display_name.toLowerCase().startsWith(q);
    }).length;
    console.log("[mentions] dropdown state updated", {
      mentionOpen: true,
      query: active.query,
      candidateCount: filteredCount,
      cachedTotal: candidates.length,
    });
  }

  const filteredCandidates = candidates.filter((candidate) => {
    const q = mentionQuery.toLowerCase();
    return candidate.username.toLowerCase().startsWith(q) || candidate.display_name.toLowerCase().startsWith(q);
  });

  function insertMention(candidate: MentionCandidate) {
    const next = applyMention(draftRef.current, mentionStart, cursor, candidate.username);
    draftRef.current = next;
    setDraft(next);
    setMentionOpen(false);
  }

  async function send() {
    if (!draft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await apiFetch(`/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body: draft }) });
      setDraft("");
      draftRef.current = "";
      setComposerHeight(44);
      setMentionOpen(false);
      await load();
      listRef.current?.scrollToEnd({ animated: true });
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "Couldn't send that message.");
    } finally {
      setSending(false);
    }
  }

  const originWasMine = context?.origin_broadcast_sender_id === currentUserId;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={() => navigation.getParent()?.navigate("Messages", { screen: "ConversationsHome" })}
        style={styles.backLink}
      >
        <Text style={styles.backLinkText}>Back to messages</Text>
      </Pressable>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          context ? (
            <View style={[styles.row, originWasMine ? styles.rowOutgoing : styles.rowIncoming]}>
              <View style={styles.originHeader}>
                <Text style={styles.contextLabel}>
                  {originWasMine
                    ? "Your broadcast:"
                    : `Broadcast from ${context.origin_broadcast_sender_display_name}:`}
                </Text>
                <Text style={styles.contextPreview}>{context.origin_broadcast_preview}</Text>
              </View>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          if (!currentUserId) return null;
          const isMine = String(item.sender_id) === String(currentUserId);
          const isUnread = !isMine && item.read_at == null;
          const mentionedMe = (item.mentioned_user_ids ?? []).includes(currentUserId);
          return (
            <View style={[styles.row, isMine ? styles.rowOutgoing : styles.rowIncoming]}>
              <View style={[styles.bubble, mentionedMe && styles.bubbleMentioned]}>
                {mentionedMe && <Text style={styles.mentionedLabel}>You were mentioned</Text>}
                <Text style={[styles.senderLabel, !isUnread && styles.senderLabelRead]}>
                  {isMine ? "You:" : `${context?.other_participant_display_name ?? "Unknown"}:`}
                </Text>
                <Text style={[styles.bubbleText, isUnread ? styles.bubbleTextUnread : styles.bubbleTextRead]}>
                  {splitMentionParts(item.body).map((part, index) => (
                    <Text key={`${item.id}-${index}`} style={part.mention ? styles.mentionInBody : undefined}>
                      {part.text}
                    </Text>
                  ))}
                </Text>
                <LinkPreviewList previews={item.link_previews} />
                <View style={styles.bubbleMetaRow}>
                  {!isMine ? (
                    <Pressable
                      onPress={async () => {
                        try {
                          await pickReasonAndSubmitReport("message", item.id);
                        } catch {
                          // Keep conversation stable on failure.
                        }
                      }}
                    >
                      <Text style={styles.reportText}>Report</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  <Text style={styles.bubbleTime}>
                    {formatMessageSentAt(item.sent_at)}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />
      {mentionOpen && (
        <View style={styles.mentionMenu}>
          {mentionLoading && <Text style={styles.mentionStatus}>Looking up people in this Echo…</Text>}
          {!mentionLoading && filteredCandidates.length === 0 && (
            <Text style={styles.mentionStatus}>No matching people in this Echo's thread.</Text>
          )}
          {filteredCandidates.map((candidate) => (
            <Pressable key={candidate.id} onPress={() => insertMention(candidate)} style={styles.mentionItem}>
              <Text style={styles.mentionInBody}>@{candidate.username}</Text>
              <Text style={styles.mentionMeta}>{candidate.display_name}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {sendError && <Text style={styles.sendError}>{sendError}</Text>}
      <View style={styles.composerRow}>
        <TextInput
          style={[styles.input, { height: composerHeight }]}
          placeholder="Message… Use @ to mention someone in this Echo"
          placeholderTextColor={colors.parchment500}
          value={draft}
          onChangeText={(value) => {
            draftRef.current = value;
            setDraft(value);
            updateMentionState(value, value.length);
            setCursor(value.length);
          }}
          onSelectionChange={(event) => {
            const nextCursor = event.nativeEvent.selection.end;
            setCursor(nextCursor);
            updateMentionState(draftRef.current, nextCursor);
          }}
          multiline
          blurOnSubmit={false}
          textAlignVertical="top"
          onContentSizeChange={(event) => {
            const measuredHeight = Math.ceil(event.nativeEvent.contentSize.height);
            const nextHeight = Math.max(44, Math.min(140, measuredHeight + 12));
            setComposerHeight(nextHeight);
          }}
        />
        <Pressable style={styles.sendButton} onPress={send} disabled={sending}>
          <Text style={styles.sendButtonText}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950 },
  backLink: {
    alignSelf: "flex-start",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  backLinkText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  listContent: { padding: 16, gap: 10, paddingBottom: 12, flexGrow: 1 },
  originHeader: {
    maxWidth: "78%",
    borderLeftWidth: 3,
    borderLeftColor: colors.signal500,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderRadius: radii.beacon,
    backgroundColor: colors.dusk800,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  contextLabel: { color: colors.signal400, fontWeight: "700", marginBottom: 3, fontSize: 11 },
  contextPreview: { color: colors.parchment300, fontSize: 12, fontStyle: "italic" },
  row: { width: "100%" },
  rowIncoming: { alignItems: "flex-start" },
  rowOutgoing: { alignItems: "flex-end" },
  bubble: {
    backgroundColor: colors.dusk900,
    borderColor: colors.dusk700,
    borderWidth: 1,
    borderRadius: radii.beacon,
    padding: 10,
    maxWidth: "78%",
  },
  bubbleMentioned: { borderColor: colors.signal500, backgroundColor: `${colors.signal500}1A` },
  mentionedLabel: { color: colors.signal400, fontSize: 10, fontFamily: "monospace", marginBottom: 4 },
  mentionInBody: { color: colors.signal400, fontWeight: "600" },
  mentionStatus: { color: colors.parchment500, fontSize: 13, paddingHorizontal: 12, paddingVertical: 10 },
  mentionMenu: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderRadius: radii.beacon,
    backgroundColor: colors.dusk800,
    overflow: "hidden",
  },
  mentionItem: { paddingHorizontal: 12, paddingVertical: 10 },
  mentionMeta: { color: colors.parchment500, fontSize: 12, marginTop: 2 },
  sendError: { color: colors.rust400, fontSize: 13, marginHorizontal: 16, marginBottom: 8 },
  senderLabel: { color: colors.parchment100, fontSize: 14, fontWeight: "700", marginBottom: 2 },
  senderLabelRead: { fontWeight: "400" },
  bubbleText: { color: colors.parchment100, fontSize: 14 },
  bubbleTextUnread: { fontWeight: "700" },
  bubbleTextRead: { fontWeight: "400" },
  bubbleMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  bubbleTime: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginLeft: 12 },
  reportText: { color: colors.rust400, fontSize: 9, fontFamily: "monospace" },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 16, borderTopWidth: 1, borderTopColor: colors.dusk700 },
  input: {
    flex: 1,
    minHeight: 44,
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.parchment100,
    fontSize: 14,
  },
  sendButton: {
    backgroundColor: colors.signal500,
    borderRadius: radii.beacon,
    paddingHorizontal: 18,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonText: { color: colors.dusk950, fontWeight: "700", fontSize: 15 },
});
