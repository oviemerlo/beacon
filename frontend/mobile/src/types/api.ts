export type TagType = "nationality" | "hobby";

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
  location_label: string | null;
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

export interface FeedBroadcast {
  id: string;
  sender_id: string;
  content: string;
  distance_m: number;
  shared_tag_count?: number;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  body: string;
  sent_at: string;
  read_at: string | null;
}
