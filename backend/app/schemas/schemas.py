import uuid
from datetime import datetime

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
    location_label: str | None
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
    display_name: str | None = None
    location_label: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    feed_radius_meters: int | None = Field(default=None, ge=500, le=50000)
    discoverable_in_broadcasts: bool | None = None
    nationality_tag_ids: list[int] | None = None
    hobby_tag_ids: list[int] | None = None


class BroadcastCreateIn(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
    latitude: float
    longitude: float
    radius_meters: int = Field(ge=500, le=50000)
    tag_match_mode: str = Field(default="any", pattern="^(any|all)$")
    tag_ids: list[int] = []
    expires_in_days: int | None = Field(default=14, ge=1, le=90)


class BroadcastOut(BaseModel):
    id: uuid.UUID
    sender: PublicProfileOut
    content: str
    radius_meters: int
    distance_m: float | None = None
    shared_tag_count: int | None = None
    created_at: datetime
    tags: list[TagOut] = []


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
