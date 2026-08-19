export type TagType = "nationality" | "continent" | "hobby" | "community";

export interface Tag {
  id: number;
  tag_type: TagType;
  label: string;
}

export interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  account_type: "individual" | "business";
  is_verified: boolean;
  is_admin: boolean;
  is_suspended: boolean;
  location_label: string | null;
  age: number | null;
  latitude: number | null;
  longitude: number | null;
  feed_radius_meters: number;
  discoverable_in_broadcasts: boolean;
  tags: Tag[];
}

/** What's ever visible about ANOTHER user — deliberately narrow. */
export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  account_type: "individual" | "business";
  is_verified: boolean;
}

export interface FeedBroadcast {
  id: string;
  sender_id: string;
  sender_display_name: string;
  content: string;
  distance_m: number;
  shared_tag_count?: number;
  tags: Tag[];
  is_global: boolean;
  radius_meters: number | null;
  created_at: string;
  reply_count?: number;
  replies?: FeedReply[];
}

export interface FeedReply {
  id: string;
  sender_id: string;
  sender_display_name: string;
  content: string;
  distance_m: number;
  shared_tag_count?: number;
  tags: Tag[];
  is_global: boolean;
  radius_meters: number | null;
  created_at: string;
  reply_count?: number;
}

export interface BroadcastThread {
  parent: FeedBroadcast;
  replies: FeedBroadcast[];
}

export interface TagGroups {
  nationality: Tag[];
  continent: Tag[];
  hobby: Tag[];
  community: Tag[];
}

export interface Conversation {
  id: string;
  origin_broadcast_id: string;
}

export interface ConversationThread {
  id: string;
  origin_broadcast_id: string;
  origin_broadcast_preview: string;
  other_participant: { id: string; display_name: string };
  last_message: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  body: string;
  sent_at: string;
  read_at: string | null;
}

export type ReportTargetType = "broadcast" | "message" | "user";
export type ReportReason = "harassment" | "spam" | "inappropriate_content" | "fake_profile" | "other";

export interface ReportPayload {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
}

export interface ReportQueueItem {
  id: string;
  status: "pending" | "dismissed" | "actioned";
  reason: ReportReason;
  details: string | null;
  created_at: string;
  reporter: PublicProfile;
  target_type: ReportTargetType;
  target_id: string;
  target_preview: string;
}

export interface AdminStats {
  total_users: number;
  total_suspended_users: number;
  new_users_7d: number;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
