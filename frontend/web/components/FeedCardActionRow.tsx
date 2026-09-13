"use client";

import Link from "next/link";
import { ShareButton } from "@/components/ShareButton";
import { clientFetch } from "@/helpers/client-api";

export async function startPrivateConversation(broadcastId: string, firstMessage: string) {
  return clientFetch<{ conversation_id: string }>("/conversations", {
    method: "POST",
    body: JSON.stringify({ broadcast_id: broadcastId, first_message: firstMessage }),
  });
}

export function FeedCardActionRow({
  broadcastId,
  isOwn,
  senderName,
  content,
  onReplyPrivately,
}: {
  broadcastId: string;
  isOwn: boolean;
  senderName: string;
  content: string;
  onReplyPrivately?: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      {!isOwn && (
        <>
          <Link href={`/broadcasts/${broadcastId}`} className="feed-card-action">
            Reply in feed
          </Link>
          {onReplyPrivately ? (
            <button type="button" onClick={onReplyPrivately} className="feed-card-action">
              Reply privately
            </button>
          ) : null}
        </>
      )}
      <Link href={`/broadcasts/${broadcastId}`} className="feed-card-action">
        View thread
      </Link>
      <ShareButton
        broadcastId={broadcastId}
        senderName={senderName}
        content={content}
        className="feed-card-action"
      />
    </div>
  );
}
