import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class TagOut(BaseModel):
    id: int
    tag_type: str
    label: str

    class Config:
        from_attributes = True


class UserProfileOut(BaseModel):
    """What a user can see about THEMSELVES — never returned for another user."""

    id: uuid.UUID
    username: str
    display_name: str
    account_type: str
    is_verified: bool
    is_admin: bool = False
    is_suspended: bool = False
    location_label: str | None
    age: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    feed_radius_meters: int
    discoverable_in_broadcasts: bool
    tags: list[TagOut] = []
    course_codes: list[str] = []
    followed_tag_limit: int = 2
    avatar_file_id: uuid.UUID | None = None
    avatar_scan_status: str | None = None

    class Config:
        from_attributes = True


class PublicProfileOut(BaseModel):
    """
    What ANY other user can see about a profile — via search result or a
    broadcast sender. Deliberately excludes location, tags, and nationality.
    """

    id: uuid.UUID
    username: str
    display_name: str
    account_type: str
    is_verified: bool

    class Config:
        from_attributes = True


class BlockedUserOut(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str

    class Config:
        from_attributes = True


class BlockedUsersListOut(BaseModel):
    blocked_users: list[BlockedUserOut]


class ProfileUpdateIn(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=100)
    date_of_birth: date | None = None
    location_label: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    feed_radius_meters: int | None = Field(default=None, gt=0)
    discoverable_in_broadcasts: bool | None = None
    nationality_tag_ids: list[int] | None = None
    hobby_tag_ids: list[int] | None = None


class FollowedTagsReplaceIn(BaseModel):
    nationality: list[int] = Field(default_factory=list)
    region: list[int] = Field(default_factory=list)
    school: list[int] = Field(default_factory=list)
    hobby: list[int] = Field(default_factory=list)
    community: list[int] = Field(default_factory=list)  # ignored; community tags are removed


class CountrySlotOut(BaseModel):
    slot: int
    tag_id: int | None = None
    changed_at: datetime | None = None
    next_change_at: datetime | None = None
    locked: bool = False


class FollowedTagsOut(BaseModel):
    tag_ids: list[int]
    country_slot_limit: int | None = None
    country_slots: list[CountrySlotOut] = []


class BroadcastCreateIn(BaseModel):
    content: str = Field(min_length=1, max_length=200)
    latitude: float
    longitude: float
    is_global: bool = False
    radius_meters: int | None = Field(default=None, gt=0)
    tag_match_mode: str = Field(default="any", pattern="^(any|all)$")
    tag_ids: list[int] = []
    course_code: str | None = Field(default=None, max_length=30)
    course_codes: list[str] = Field(default_factory=list)
    expires_in_days: int | None = Field(default=14, ge=1, le=90)
    reply_to_broadcast_id: uuid.UUID | None = None
    include_sender_avatar: bool = False


class PublicBroadcastOut(BaseModel):
    """Unauthenticated share page — no distance or location."""

    id: uuid.UUID
    sender: PublicProfileOut
    content: str
    created_at: datetime
    tags: list[TagOut] = []
    og_image_url: str | None = None


class BroadcastOut(BaseModel):
    id: uuid.UUID
    sender: PublicProfileOut
    content: str
    is_global: bool = False
    radius_meters: int | None = None
    distance_m: float | None = None
    shared_tag_count: int | None = None
    course_code: str | None = None
    course_codes: list[str] = []
    created_at: datetime
    tags: list[TagOut] = []


class BroadcastAttachmentOut(BaseModel):
    file_id: uuid.UUID
    original_filename: str
    content_type: str


class LinkPreviewOut(BaseModel):
    id: uuid.UUID
    normalized_url: str
    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    site_name: str | None = None
    favicon_url: str | None = None
    status: str


class LatestFeedReplyOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_display_name: str
    sender_is_verified: bool = False
    content: str
    created_at: datetime
    attachments: list[BroadcastAttachmentOut] = []
    link_previews: list[LinkPreviewOut] = []


class FeedBroadcastOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_display_name: str
    sender_is_verified: bool = False
    sender_avatar_file_id: uuid.UUID | None = None
    content: str
    distance_m: float
    shared_tag_count: int | None = None
    tags: list[TagOut] = []
    is_global: bool
    radius_meters: int | None = None
    course_code: str | None = None
    course_codes: list[str] = []
    created_at: datetime
    last_activity_at: datetime | None = None
    reply_count: int = 0
    latest_reply: LatestFeedReplyOut | None = None
    attachments: list[BroadcastAttachmentOut] = []
    link_previews: list[LinkPreviewOut] = []


class BroadcastThreadOut(BaseModel):
    parent: FeedBroadcastOut
    replies: list[FeedBroadcastOut]


class ConversationStartIn(BaseModel):
    broadcast_id: uuid.UUID
    first_message: str = Field(min_length=1, max_length=2000)


class ConversationContextOut(BaseModel):
    id: uuid.UUID
    origin_broadcast_id: uuid.UUID
    origin_broadcast_preview: str
    origin_broadcast_sender_id: uuid.UUID | None
    origin_broadcast_sender_display_name: str
    other_participant_id: uuid.UUID
    other_participant_display_name: str


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    sent_at: datetime
    read_at: datetime | None
    mentioned_user_ids: list[uuid.UUID] = []
    link_previews: list[LinkPreviewOut] = []

    class Config:
        from_attributes = True


class TokenPairOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


ReportTargetType = Literal["broadcast", "message", "user"]
ReportReason = Literal["harassment", "spam", "inappropriate_content", "fake_profile", "other"]
ReportStatus = Literal["pending", "dismissed", "actioned"]
ResolveAction = Literal["dismiss", "suspend_user"]


class ReportCreateIn(BaseModel):
    target_type: ReportTargetType
    target_id: uuid.UUID
    reason: ReportReason
    details: str | None = Field(default=None, max_length=2000)


class ReportResolveIn(BaseModel):
    action: ResolveAction
    resolution_notes: str | None = Field(default=None, max_length=2000)


class ReportOut(BaseModel):
    id: uuid.UUID
    reporter_id: uuid.UUID
    target_type: ReportTargetType
    target_id: uuid.UUID
    reason: ReportReason
    details: str | None
    status: ReportStatus
    created_at: datetime
    reviewed_by: uuid.UUID | None
    reviewed_at: datetime | None
    resolution_notes: str | None

    class Config:
        from_attributes = True


class ReportQueueItemOut(BaseModel):
    id: uuid.UUID
    status: ReportStatus
    reason: ReportReason
    details: str | None
    created_at: datetime
    reporter: PublicProfileOut
    target_type: ReportTargetType
    target_id: uuid.UUID
    target_preview: str


class AdminStatsOut(BaseModel):
    total_users: int
    total_suspended_users: int
    new_users_7d: int


class SchoolSearchOut(BaseModel):
    id: int
    name: str
    country: str | None


class SchoolVerifyStartIn(BaseModel):
    school_id: int
    school_email: str = Field(min_length=3, max_length=255)


class SchoolVerifyConfirmIn(BaseModel):
    code: str = Field(min_length=6, max_length=6)


class SchoolVerifyStatusOut(BaseModel):
    school_id: int | None
    school_name: str | None
    verified: bool


class SchoolCourseIn(BaseModel):
    course_code: str = Field(min_length=1, max_length=30)


class FeedSearchMatchOut(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime
    source: str
    conversation_id: uuid.UUID | None = None
    sender_display_name: str | None = None
    sender_id: uuid.UUID | None = None


class FeedSearchHitOut(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime
    match_type: Literal["echo", "message", "both"]
    sender_id: uuid.UUID
    sender_display_name: str
    sender_is_verified: bool = False
    sender_avatar_file_id: uuid.UUID | None = None
    tags: list[TagOut] = []
    matches: list[FeedSearchMatchOut] = []


class ConversationSearchMatchOut(BaseModel):
    id: uuid.UUID
    body: str
    created_at: datetime


class ConversationSearchHitOut(BaseModel):
    id: uuid.UUID
    origin_broadcast_id: uuid.UUID
    origin_broadcast_preview: str
    origin_broadcast_sender_display_name: str
    is_reply_to_you: bool
    other_participant: dict
    matches: list[ConversationSearchMatchOut] = []


class GuardDutyScanResultIn(BaseModel):
    bucket: str
    s3_key: str
    scan_status: str
    raw_guardduty_status: str | None = None
