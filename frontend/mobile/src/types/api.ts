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

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  account_type: "individual" | "business";
  is_verified: boolean;
}

export interface BlockedUser {
  id: string;
  username: string;
  display_name: string;
}

export interface BlockedUsersList {
  blocked_users: BlockedUser[];
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
  course_code?: string | null;
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
  course_code?: string | null;
  created_at: string;
  reply_count?: number;
}

export interface BroadcastCreatePayload {
  content: string;
  latitude: number;
  longitude: number;
  is_global: boolean;
  radius_meters?: number;
  tag_match_mode: "any" | "all";
  tag_ids: number[];
  course_code?: string | null;
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

export interface School {
  id: number;
  name: string;
  country: string | null;
}

export interface SchoolVerificationStatus {
  school_id: number | null;
  school_name: string | null;
  verified: boolean;
}

export interface ConversationThread {
  id: string;
  origin_broadcast_id: string;
  origin_broadcast_preview: string;
  origin_broadcast_sender_display_name: string;
  is_reply_to_you: boolean;
  other_participant: { id: string; display_name: string };
  last_message_sender_id: string;
  last_message: string;
  last_message_at: string;
  unread_count: number;
  has_mention?: boolean;
}

export interface ConversationContext {
  id: string;
  origin_broadcast_id: string;
  origin_broadcast_preview: string;
  origin_broadcast_sender_id: string | null;
  origin_broadcast_sender_display_name: string;
  other_participant_id: string;
  other_participant_display_name: string;
}

export interface Message {
  id: string;
  sender_id: string;
  body: string;
  sent_at: string;
  read_at: string | null;
  mentioned_user_ids?: string[];
}

export interface MentionCandidate {
  id: string;
  username: string;
  display_name: string;
  echo_id?: string | null;
}

export interface MentionNotification {
  id: string;
  kind: "mentioned";
  conversation_id: string;
  message_id: string;
  actor_id: string;
  actor_username: string;
  actor_display_name: string;
  body: string;
  origin_broadcast_preview: string;
  created_at: string;
  is_own_conversation: boolean;
}

export type ReportTargetType = "broadcast" | "message" | "user";
export type ReportReason = "harassment" | "spam" | "inappropriate_content" | "fake_profile" | "other";

export interface ReportPayload {
  target_type: ReportTargetType;
  target_id: string;
  reason: ReportReason;
  details?: string;
}

export interface UnreadCount {
  count: number;
  mention_count?: number;
}

export type FeedSearchMatchType = "echo" | "message" | "both";

export interface FeedSearchMatch {
  id: string;
  body: string;
  created_at: string;
  source: "reply" | "message";
  conversation_id: string | null;
}

export interface FeedSearchHit {
  id: string;
  body: string;
  created_at: string;
  match_type: FeedSearchMatchType;
  sender_id: string;
  sender_display_name: string;
  tags: Tag[];
  matches: FeedSearchMatch[];
}

export interface ConversationSearchMatch {
  id: string;
  body: string;
  created_at: string;
}

export interface ConversationSearchHit {
  id: string;
  origin_broadcast_id: string;
  origin_broadcast_preview: string;
  origin_broadcast_sender_display_name: string;
  is_reply_to_you: boolean;
  other_participant: { id: string; display_name: string };
  matches: ConversationSearchMatch[];
}
