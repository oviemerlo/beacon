"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { EchoBody } from "@/components/EchoBody";
import { EchoMediaLayout } from "@/components/EchoAttachments";
import { LinkPreviewList } from "@/components/LinkPreviewCard";
import { FeedCardActionRow, startPrivateConversation } from "@/components/FeedCardActionRow";
import { buildFeedCardActions, FeedCardOverflowMenu } from "@/components/FeedCardOverflowMenu";
import { SenderAvatar } from "@/components/SenderAvatar";
import { VerifiedMark } from "@/components/VerifiedMark";
import { LocationDriftBanner } from "@/components/LocationDriftBanner";
import { reachBadgeLabel } from "@/helpers/broadcast-reach";
import { clientFetch } from "@/helpers/client-api";
import { audienceFilterActive, echoAudienceLabels, feedSearchChips, pathWithTagQuery, retainKnown, toggleItem } from "@/helpers/tags";
import { echoPreview, formatBroadcastSentAt } from "@/helpers/time";
import { usePolling } from "@/helpers/usePolling";
import type { FeedBroadcast, FeedSearchHit, UserProfile } from "@/types/api";

export default function FeedPage() {
  const router = useRouter();
  const [broadcasts, setBroadcasts] = useState<FeedBroadcast[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [selectedCourseCodes, setSelectedCourseCodes] = useState<string[]>([]);
  const [searchHits, setSearchHits] = useState<FeedSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const isSearching = debouncedQuery.trim().length > 0;

  const loadFeed = useCallback(async ({ silent }: { silent: boolean }) => {
    if (debouncedQuery.trim()) return;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const rows = await clientFetch<FeedBroadcast[]>(
        pathWithTagQuery("/feed/for-you", { tagIds: selectedTagIds, courseCodes: selectedCourseCodes })
      );
      setBroadcasts(rows);
      await clientFetch("/feed/mark-seen", { method: "POST" });
    } catch {
      if (!silent) setError("Couldn't load your feed. Try refreshing.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [debouncedQuery, selectedTagIds, selectedCourseCodes]);

  useEffect(() => {
    clientFetch<UserProfile>("/users/me")
      .then((me) => {
        setUser(me);
        setSelectedTagIds((ids) => retainKnown(ids, me.tags.map((tag) => tag.id)));
        setSelectedCourseCodes((codes) => retainKnown(codes, me.course_codes ?? []));
      })
      .catch(() => setUser(null));
  }, []);

  const chips = feedSearchChips(user?.tags ?? [], selectedTagIds, user?.course_codes ?? [], selectedCourseCodes);
  const filterActive = audienceFilterActive(selectedTagIds, selectedCourseCodes);

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => window.clearTimeout(handle);
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
    clientFetch<FeedSearchHit[]>(
      pathWithTagQuery("/feed/search", { tagIds: selectedTagIds, courseCodes: selectedCourseCodes, extra: { q: debouncedQuery.trim() } })
    )
      .then((hits) => {
        if (!cancelled) setSearchHits(hits);
      })
      .catch(() => {
        if (cancelled) return;
        setSearchHits([]);
        setSearchError("Couldn't search your feed history.");
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, isSearching, selectedTagIds, selectedCourseCodes]);

  useEffect(() => {
    const markSeen = async () => {
      try {
        await clientFetch("/feed/mark-seen", { method: "POST" });
      } catch {
        // Keep feed rendering stable on network failures.
      }
    };
    void markSeen();
  }, []);

  usePolling(loadFeed, [loadFeed], 5000);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <LocationDriftBanner
          registeredLatitude={user?.latitude ?? null}
          registeredLongitude={user?.longitude ?? null}
          onConfirmUpdate={async (latitude, longitude) => {
            await clientFetch("/users/me", {
              method: "PATCH",
              body: JSON.stringify({ latitude, longitude }),
            });
            const refreshed = await clientFetch<UserProfile>("/users/me");
            setUser(refreshed);
          }}
        />

        <div className="mb-5">
          <input
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your feed history"
            aria-label="Search your feed history"
          />
          {chips.length > 0 && (
            <div className="mt-3">
              <p className="text-parchment-500 text-xs mb-1.5">Search by tags</p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      if (chip.kind === "tag") setSelectedTagIds((ids) => toggleItem(ids, chip.id));
                      else setSelectedCourseCodes((codes) => toggleItem(codes, chip.code));
                    }}
                    className={chip.selected ? "tag-pill tag-pill-active" : "tag-pill"}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {isSearching ? (
          <>
            {searching && <p className="text-parchment-500 font-mono text-sm">Searching…</p>}
            {searchError && <p className="text-rust-400 text-sm">{searchError}</p>}
            {!searching && !searchError && searchHits.length === 0 && (
              <div className="card text-center py-10">
                <p className="font-medium">No matches in your feed history.</p>
                <p className="text-parchment-500 text-sm mt-1">Try a different keyword or clear a tag filter.</p>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {searchHits.map((hit) => (
                <SearchHitCard
                  key={hit.id}
                  hit={hit}
                  currentUserId={user?.id ?? null}
                  onOpenConversation={(id) => router.push(`/conversations/${id}`)}
                  onBlocked={(senderId) => setSearchHits((rows) => rows.filter((row) => row.sender_id !== senderId))}
                  onRemoved={(broadcastId) => setSearchHits((rows) => rows.filter((row) => row.id !== broadcastId))}
                />
              ))}
            </div>
          </>
        ) : (
          <>
            {loading && <p className="text-parchment-500 font-mono text-sm">Loading nearby broadcasts…</p>}
            {error && <p className="text-rust-400 text-sm">{error}</p>}
            {!loading && !error && broadcasts.length === 0 && (
              <EmptyState tagFilterActive={filterActive} />
            )}
            <div className="flex flex-col gap-3">
              {broadcasts.map((b) => (
                <BroadcastCard
                  key={b.id}
                  broadcast={b}
                  currentUserId={user?.id ?? null}
                  onOpenConversation={(id) => router.push(`/conversations/${id}`)}
                  onBlocked={(senderId) => setBroadcasts((rows) => rows.filter((row) => row.sender_id !== senderId))}
                  onRemoved={(broadcastId) => setBroadcasts((rows) => rows.filter((row) => row.id !== broadcastId))}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SearchHitCard({
  hit,
  currentUserId,
  onOpenConversation,
  onBlocked,
  onRemoved,
}: {
  hit: FeedSearchHit;
  currentUserId: string | null;
  onOpenConversation: (conversationId: string) => void;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
}) {
  const matchLabel = hit.match_type === "both" ? "Echo + replies" : hit.match_type === "echo" ? "Echo" : "Reply";
  const isOwn = currentUserId === hit.sender_id;
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center flex-wrap gap-x-5 gap-y-2 min-w-0">
          <p className="text-parchment-500 text-sm inline-flex items-center gap-1.5 mr-2">
            <SenderAvatar fileId={hit.sender_avatar_file_id} name={hit.sender_id === currentUserId ? "You" : hit.sender_display_name} />
            {hit.sender_id === currentUserId ? "You" : hit.sender_display_name}
            <VerifiedMark verified={hit.sender_is_verified} />
          </p>
          {echoAudienceLabels(hit.tags, hit.course_codes, hit.course_code).map((label) => (
            <span key={label} className="tag-pill">
              {label}
            </span>
          ))}
        </div>
        <div className="flex flex-col items-end shrink-0">
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
            />
          ) : null}
          <span className="feed-card-meta mt-8">{matchLabel}</span>
        </div>
      </div>
      <Link href={`/broadcasts/${hit.id}`} className="block">
        <EchoBody>{hit.body}</EchoBody>
      </Link>
      <p className="feed-card-time mt-2">{formatBroadcastSentAt(hit.created_at)}</p>
      <FeedCardActionRow
        broadcastId={hit.id}
        isOwn={isOwn}
        senderName={isOwn ? "You" : hit.sender_display_name}
        content={hit.body}
        onReplyPrivately={
          isOwn
            ? undefined
            : () => {
                void startPrivateConversation(hit.id, "Hi")
                  .then((res) => onOpenConversation(res.conversation_id))
                  .catch(() => window.alert("Couldn't start private reply."));
              }
        }
      />
      {hit.matches.length > 0 && (
        <div className="mt-3 ml-3 border-l border-dusk-600 pl-3 flex flex-col gap-3">
          {hit.matches.map((match) => (
            <div key={match.id}>
              <p className="text-parchment-500 text-sm mb-1">
                {match.sender_id && match.sender_id === currentUserId ? "You" : match.sender_display_name || "Unknown"}
              </p>
              <p className="text-parchment-300 text-sm">{match.body}</p>
              <p className="feed-card-time mt-1">
                {formatBroadcastSentAt(match.created_at)}
                {match.source === "message" ? " · private reply" : " · feed reply"}
              </p>
              {match.conversation_id ? (
                <button type="button" className="feed-card-action mt-1.5" onClick={() => onOpenConversation(match.conversation_id!)}>
                  Open conversation
                </button>
              ) : (
                <Link href={`/broadcasts/${hit.id}`} className="feed-card-action mt-1.5">
                  View thread
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BroadcastCard({
  broadcast,
  currentUserId,
  onOpenConversation,
  onBlocked,
  onRemoved,
}: {
  broadcast: FeedBroadcast;
  currentUserId: string | null;
  onOpenConversation: (conversationId: string) => void;
  onBlocked: (senderId: string) => void;
  onRemoved: (broadcastId: string) => void;
}) {
  const km = (broadcast.distance_m / 1000).toFixed(1);
  const reachLabel = reachBadgeLabel(broadcast.is_global, broadcast.radius_meters);
  const isOwn = currentUserId === broadcast.sender_id;
  const featuredReply = broadcast.latest_reply ?? null;
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
  const [showPrivateComposer, setShowPrivateComposer] = useState(false);
  const [privateMessage, setPrivateMessage] = useState("");
  const [sendingPrivate, setSendingPrivate] = useState(false);

  async function sendPrivateReply() {
    const firstMessage = privateMessage.trim();
    if (!firstMessage || sendingPrivate) return;
    setSendingPrivate(true);
    try {
      const res = await startPrivateConversation(broadcast.id, firstMessage);
      setPrivateMessage("");
      setShowPrivateComposer(false);
      onOpenConversation(res.conversation_id);
    } catch {
      window.alert("Couldn't start private reply.");
    } finally {
      setSendingPrivate(false);
    }
  }

  return (
    <div className="card flex flex-col hover:border-signal-500/50 transition-colors !pb-2.5">
      <EchoMediaLayout
        attachments={featuredReply ? featuredReply.attachments : broadcast.attachments}
        corner={
          currentUserId ? (
            <FeedCardOverflowMenu
              senderName={isOwnDisplayed ? "your post" : displayedEntity.sender_display_name}
              actions={buildFeedCardActions({
                isOwn: isOwnDisplayed,
                broadcastId: displayedEntity.id,
                senderId: displayedEntity.sender_id,
                senderDisplayName: displayedEntity.sender_display_name,
                onBlocked,
                onRemoved,
                removeFromFeedId: broadcast.id,
              })}
            />
          ) : undefined
        }
      >
        <div className="flex items-center flex-wrap gap-x-5 gap-y-2 min-w-0 mb-2">
          <p className="text-parchment-100 text-base font-semibold inline-flex items-center gap-2 mr-2">
            <SenderAvatar fileId={headerAvatarId} name={headerAvatarName} className="h-9 w-9 shrink-0 rounded-full border border-dusk-600" />
            {headerName}
            <VerifiedMark verified={headerVerified} />
          </p>
          {echoAudienceLabels(broadcast.tags, broadcast.course_codes, broadcast.course_code).map((label) => (
            <span key={label} className="tag-pill text-xs font-medium">
              {label}
            </span>
          ))}
        </div>
        {featuredReply && (
          <div className="mt-2.5 mb-1 border-l-2 border-dusk-600 pl-2.5">
            <p className="text-parchment-500 text-[11px]">Replying to</p>
            <p className="text-parchment-500 text-sm font-normal truncate">{echoPreview(broadcast.content)}</p>
          </div>
        )}
        <EchoBody className="text-parchment-100 text-base font-normal leading-snug mt-2 mb-1">
          {featuredReply ? featuredReply.content : broadcast.content}
        </EchoBody>
        <LinkPreviewList previews={featuredReply ? featuredReply.link_previews : broadcast.link_previews} />
      </EchoMediaLayout>
      <div className="mt-auto pt-5">
      <div className="flex items-center flex-nowrap gap-2 text-[10px] leading-tight font-mono text-parchment-500">
        <span className="feed-card-time whitespace-nowrap">
          {formatBroadcastSentAt(featuredReply ? featuredReply.created_at : broadcast.created_at)}
          {!isOwn ? `  ·  ${km} km away` : ""}
        </span>
        <span className="feed-card-reach">{reachLabel}</span>
        <Link
          href={`/broadcasts/${broadcast.id}`}
          className="text-parchment-500 hover:text-parchment-100 whitespace-nowrap"
        >
          {broadcast.reply_count ?? 0} repl{(broadcast.reply_count ?? 0) === 1 ? "y" : "ies"}
        </Link>
      </div>
      <FeedCardActionRow
        broadcastId={broadcast.id}
        isOwn={isOwn}
        senderName={isOwn ? "You" : broadcast.sender_display_name}
        content={featuredReply ? featuredReply.content : broadcast.content}
        onReplyPrivately={() => setShowPrivateComposer((v) => !v)}
      />
      </div>
      {showPrivateComposer && !isOwn && (
        <div className="mt-3 flex flex-col gap-2">
          <input
            className="input-field"
            placeholder="Private message"
            value={privateMessage}
            onChange={(e) => setPrivateMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void sendPrivateReply();
              }
            }}
          />
          <div className="flex gap-2">
            <button
              className="btn-primary px-4 py-2 disabled:opacity-50"
              onClick={() => void sendPrivateReply()}
              disabled={sendingPrivate || !privateMessage.trim()}
            >
              {sendingPrivate ? "Sending..." : "Send privately"}
            </button>
            <button
              className="btn-secondary px-4 py-2"
              onClick={() => {
                setShowPrivateComposer(false);
                setPrivateMessage("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ tagFilterActive }: { tagFilterActive: boolean }) {
  return (
    <div className="card text-center py-10">
      <p className="font-medium">
        {tagFilterActive ? "No Echoes targeting these tags nearby." : "Nothing nearby yet."}
      </p>
      <p className="text-parchment-500 text-sm mt-1">
        {tagFilterActive
          ? "Clear a tag to see everything in reach."
          : "Broadcasts from people and businesses within your radius will show up here."}
      </p>
    </div>
  );
}
