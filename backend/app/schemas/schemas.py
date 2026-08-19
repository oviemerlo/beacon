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


class BroadcastCreateIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    latitude: float
    longitude: float
    is_global: bool = False
    radius_meters: int | None = Field(default=None, gt=0)
    tag_match_mode: str = Field(default="any", pattern="^(any|all)$")
    tag_ids: list[int] = []
    expires_in_days: int | None = Field(default=14, ge=1, le=90)
    reply_to_broadcast_id: uuid.UUID | None = None


class BroadcastOut(BaseModel):
    id: uuid.UUID
    sender: PublicProfileOut
    content: str
    is_global: bool = False
    radius_meters: int | None = None
    distance_m: float | None = None
    shared_tag_count: int | None = None
    created_at: datetime
    tags: list[TagOut] = []


class FeedBroadcastOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    sender_display_name: str
    content: str
    distance_m: float
    shared_tag_count: int | None = None
    tags: list[TagOut] = []
    is_global: bool
    radius_meters: int | None = None
    created_at: datetime
    reply_count: int = 0


class BroadcastThreadOut(BaseModel):
    parent: FeedBroadcastOut
    replies: list[FeedBroadcastOut]


class ConversationStartIn(BaseModel):
    broadcast_id: uuid.UUID
    first_message: str = Field(min_length=1, max_length=2000)


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: uuid.UUID
    sender_id: uuid.UUID
    body: str
    sent_at: datetime
    read_at: datetime | None

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
