import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, FlatList, TextInput, Alert } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiFetch } from "../helpers/api";
import { pickReasonAndSubmitReport } from "../helpers/reportActions";
import { splitMentionParts } from "../helpers/mentions";
import { formatMessageSentAt } from "../helpers/time";
import { Card } from "../components/Shared";
import { colors, radii } from "../theme/tokens";
import type { ConversationSearchHit, ConversationThread, MentionNotification } from "../types/api";

export function ConversationsScreen({ onOpenConversation }: { onOpenConversation: (id: string) => void }) {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [searchHits, setSearchHits] = useState<ConversationSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const isSearching = debouncedQuery.trim().length > 0;

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const loadConversations = async ({ silent }: { silent: boolean }) => {
        if (debouncedQuery.trim()) return;
        const [rows, mentionRows] = await Promise.all([
          apiFetch<ConversationThread[]>("/conversations"),
          apiFetch<MentionNotification[]>("/conversations/mentions").catch(() => []),
        ]);
        if (!active) return;
        setThreads(rows);
        setMentions(mentionRows);
        if (!silent) setLoading(false);
        try {
          await apiFetch("/conversations/mark-seen", { method: "POST" });
          if (!active) return;
          setThreads((current) => current.map((thread) => ({ ...thread, unread_count: 0 })));
        } catch {
          // Keep inbox rendering even if read-state update fails.
        }
      };

      void loadConversations({ silent: false });
      const interval = setInterval(() => {
        void loadConversations({ silent: true });
      }, 5000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [debouncedQuery])
  );

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  useEffect(() => {
    if (!isSearching) {
      setSearchHits([]);
      setSearchError(null);
      return;
    }
    let cancelled = false;
    setSearching(true);
    setSearchError(null);
    apiFetch<ConversationSearchHit[]>(`/conversations/search?q=${encodeURIComponent(debouncedQuery.trim())}`)
      .then((hits) => {
        if (!cancelled) setSearchHits(hits);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchHits([]);
        setSearchError("Couldn't search your messages.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isSearching]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <TextInput
        style={styles.searchInput}
        placeholder="Search your messages"
        placeholderTextColor={colors.parchment500}
        value={searchQuery}
        onChangeText={setSearchQuery}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {isSearching ? (
        searching && searchHits.length === 0 && !searchError ? (
          <ActivityIndicator color={colors.signal500} style={{ marginTop: 20 }} />
        ) : (
          <FlatList
            data={searchHits}
            keyExtractor={(hit) => hit.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.threadList}
            ListHeaderComponent={searchError ? <Text style={styles.searchError}>{searchError}</Text> : null}
            ListEmptyComponent={
              searching ? null : (
                <Card>
                  <Text style={styles.emptyTitle}>No matching messages.</Text>
                  <Text style={styles.emptySubtitle}>Try a different keyword.</Text>
                </Card>
              )
            }
            renderItem={({ item }) => <SearchHitCard hit={item} onOpenConversation={onOpenConversation} />}
          />
        )
      ) : loading ? (
        <ActivityIndicator color={colors.signal500} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={threads}
          keyExtractor={(thread) => thread.id}
          contentContainerStyle={styles.threadList}
          ListHeaderComponent={
            mentions.length > 0 ? (
              <View style={{ gap: 10 }}>
                {mentions.map((mention) => (
                  <Card key={mention.id}>
                    <Text style={styles.mentionedLabel}>You were mentioned</Text>
                    <Text style={styles.threadNameRead}>
                      @{mention.actor_username} mentioned you
                    </Text>
                    <Text style={styles.originPreview}>{mention.origin_broadcast_preview}</Text>
                    <Text style={styles.threadPreviewRead}>
                      <MentionBody text={mention.body} />
                    </Text>
                    <View style={styles.actionRow}>
                      {mention.is_own_conversation ? (
                        <Pressable onPress={() => onOpenConversation(mention.conversation_id)} style={styles.actionPill}>
                          <Text style={styles.actionPillText}>Open conversation</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={async () => {
                            await apiFetch(`/conversations/mentions/${mention.id}/read`, { method: "POST" });
                            setMentions((rows) => rows.filter((row) => row.id !== mention.id));
                          }}
                          style={styles.actionPill}
                        >
                          <Text style={styles.actionPillText}>Dismiss mention</Text>
                        </Pressable>
                      )}
                    </View>
                  </Card>
                ))}
              </View>
            ) : null
          }
          ListEmptyComponent={
            mentions.length > 0 ? null : (
              <Card>
                <Text style={styles.emptyTitle}>No conversations yet.</Text>
                <Text style={styles.emptySubtitle}>Reply privately from a broadcast in your feed to start one.</Text>
              </Card>
            )
          }
          renderItem={({ item: thread }) => {
            const isIncomingLatest = thread.last_message_sender_id === thread.other_participant.id;
            const isUnread = (thread.unread_count ?? 0) > 0;
            const originWasMine = thread.is_reply_to_you;
            const quotePrefix = originWasMine
              ? "Your broadcast: "
              : `Broadcast from ${thread.origin_broadcast_sender_display_name}: `;
            return (
              <Card>
                {thread.has_mention && <Text style={styles.mentionedLabel}>You were mentioned</Text>}
                <Pressable onPress={() => onOpenConversation(thread.id)}>
                  <View style={originWasMine ? styles.quoteOutgoing : styles.quoteIncoming}>
                    <Text style={styles.originPreview}>
                      {quotePrefix}
                      {thread.origin_broadcast_preview}
                    </Text>
                  </View>
                  {isIncomingLatest ? (
                    <View style={styles.incomingColumn}>
                      <Text style={[styles.threadName, !isUnread && styles.threadNameRead]}>
                        {thread.other_participant.display_name}:
                      </Text>
                      <Text style={[styles.threadPreview, !isUnread && styles.threadPreviewRead]}>
                        {thread.last_message ? <MentionBody text={thread.last_message} /> : "No messages yet."}
                      </Text>
                      <Text style={styles.threadTime}>{formatMessageSentAt(thread.last_message_at)}</Text>
                    </View>
                  ) : (
                    <View style={styles.outgoingColumn}>
                      <Text style={styles.threadNameRead}>You:</Text>
                      <Text style={styles.outgoingSummaryMessage}>
                        {thread.last_message ? <MentionBody text={thread.last_message} /> : "No messages yet."}
                      </Text>
                      <Text style={styles.threadTime}>{formatMessageSentAt(thread.last_message_at)}</Text>
                    </View>
                  )}
                </Pressable>
                <View style={styles.actionRow}>
                  <Pressable onPress={() => onOpenConversation(thread.id)} style={styles.actionPill}>
                    <Text style={styles.actionPillText}>View conversation</Text>
                  </Pressable>
                  <Pressable
                    onPress={async () => {
                      try {
                        await pickReasonAndSubmitReport("user", thread.other_participant.id);
                      } catch {
                        // Keep list stable on failure.
                      }
                    }}
                    style={styles.actionPill}
                  >
                    <Text style={styles.actionPillText}>Report profile</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        "Delete this conversation?",
                        "It will disappear from your messages. The other person can still see it and reply.",
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: () => {
                              void (async () => {
                                try {
                                  await apiFetch(`/conversations/${thread.id}/hide`, { method: "PUT" });
                                  setThreads((rows) => rows.filter((row) => row.id !== thread.id));
                                } catch {
                                  Alert.alert("Couldn't delete this conversation.");
                                }
                              })();
                            },
                          },
                        ]
                      );
                    }}
                    style={styles.actionPill}
                  >
                    <Text style={styles.actionPillText}>Delete</Text>
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      )}
    </View>
  );
}

function MentionBody({ text }: { text: string }) {
  return (
    <>
      {splitMentionParts(text).map((part, index) => (
        <Text key={index} style={part.mention ? styles.mentionInBody : undefined}>
          {part.text}
        </Text>
      ))}
    </>
  );
}

function SearchHitCard({
  hit,
  onOpenConversation,
}: {
  hit: ConversationSearchHit;
  onOpenConversation: (id: string) => void;
}) {
  const originWasMine = hit.is_reply_to_you;
  const quotePrefix = originWasMine
    ? "Your broadcast: "
    : `Broadcast from ${hit.origin_broadcast_sender_display_name}: `;
  return (
    <Card>
      <Text style={styles.threadNameRead}>{hit.other_participant.display_name}</Text>
      <View style={originWasMine ? styles.quoteOutgoing : styles.quoteIncoming}>
        <Text style={styles.originPreview}>
          {quotePrefix}
          {hit.origin_broadcast_preview}
        </Text>
      </View>
      {hit.matches.map((match) => (
        <View key={match.id} style={styles.nestedMatch}>
          <Text style={styles.nestedMatchBody}>
            <MentionBody text={match.body} />
          </Text>
          <Text style={styles.threadTime}>{formatMessageSentAt(match.created_at)}</Text>
        </View>
      ))}
      <View style={styles.actionRow}>
        <Pressable onPress={() => onOpenConversation(hit.id)} style={styles.actionPill}>
          <Text style={styles.actionPillText}>Open conversation</Text>
        </Pressable>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.dusk950, padding: 16 },
  title: { color: colors.parchment100, fontSize: 20, fontWeight: "700", marginBottom: 16 },
  searchInput: {
    backgroundColor: colors.dusk800,
    borderColor: colors.dusk600,
    borderWidth: 1,
    borderRadius: radii.beacon,
    color: colors.parchment100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchError: { color: colors.rust400, fontSize: 13, marginBottom: 8 },
  nestedMatch: {
    marginTop: 10,
    marginLeft: 10,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderLeftColor: colors.dusk600,
  },
  nestedMatchBody: { color: colors.parchment100, fontSize: 14 },
  threadList: { gap: 10, paddingBottom: 24 },
  quoteIncoming: {
    marginTop: 2,
    marginBottom: 8,
    alignSelf: "flex-start",
    maxWidth: "62%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.dusk800,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderLeftWidth: 3,
    borderLeftColor: colors.signal500,
  },
  quoteOutgoing: {
    marginTop: 2,
    marginBottom: 8,
    alignSelf: "flex-end",
    maxWidth: "62%",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.dusk800,
    borderWidth: 1,
    borderColor: colors.dusk600,
    borderLeftWidth: 3,
    borderLeftColor: colors.signal500,
  },
  incomingColumn: { alignSelf: "flex-start", maxWidth: "62%" },
  outgoingColumn: { alignSelf: "flex-end", maxWidth: "62%", alignItems: "flex-end" },
  threadName: { color: colors.parchment100, fontWeight: "700" },
  threadNameRead: { color: colors.parchment100, fontWeight: "400" },
  threadTime: { color: colors.parchment500, fontSize: 10, fontFamily: "monospace", marginTop: 4 },
  originPreview: { color: colors.parchment300, fontSize: 12, fontStyle: "italic" },
  threadPreview: { color: colors.parchment100, fontSize: 13, fontWeight: "700", marginTop: 2 },
  threadPreviewRead: { fontWeight: "400" },
  outgoingSummaryMessage: { color: colors.parchment100, fontSize: 13, fontWeight: "400", marginTop: 2, textAlign: "right" },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  actionPill: { borderColor: colors.dusk600, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  actionPillText: { color: colors.parchment300, fontSize: 10, fontFamily: "monospace" },
  mentionedLabel: { color: colors.signal400, fontSize: 10, fontFamily: "monospace", marginBottom: 6 },
  mentionInBody: { color: colors.signal400, fontWeight: "600" },
  emptyTitle: { color: colors.parchment100, fontWeight: "600", textAlign: "center" },
  emptySubtitle: { color: colors.parchment500, fontSize: 13, textAlign: "center", marginTop: 6 },
});
