import json

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic_settings.sources import DotEnvSettingsSource, EnvSettingsSource, PydanticBaseSettingsSource


class _AppleClientIdsEnvSource(EnvSettingsSource):
    def prepare_field_value(self, field_name, field, value, value_is_complex):
        if field_name == "APPLE_CLIENT_IDS" and isinstance(value, str):
            return value
        return super().prepare_field_value(field_name, field, value, value_is_complex)


class _AppleClientIdsDotEnvSource(DotEnvSettingsSource):
    def prepare_field_value(self, field_name, field, value, value_is_complex):
        if field_name == "APPLE_CLIENT_IDS" and isinstance(value, str):
            return value
        return super().prepare_field_value(field_name, field, value, value_is_complex)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @classmethod
    def settings_customise_sources(
        cls,
        settings_cls: type[BaseSettings],
        init_settings: PydanticBaseSettingsSource,
        env_settings: PydanticBaseSettingsSource,
        dotenv_settings: PydanticBaseSettingsSource,
        file_secret_settings: PydanticBaseSettingsSource,
    ) -> tuple[PydanticBaseSettingsSource, ...]:
        return (
            init_settings,
            _AppleClientIdsEnvSource(settings_cls),
            _AppleClientIdsDotEnvSource(settings_cls),
            file_secret_settings,
        )

    ENVIRONMENT: str = "development"
    DATABASE_URL: str

    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    GOOGLE_REDIRECT_URI: str = ""
    GOOGLE_GEOCODING_API_KEY: str = ""
    # Google issues a different OAuth client (and therefore a different
    # `aud` claim in the resulting ID token) per platform — a Web client
    # for the browser redirect flow, and typically iOS/Android clients for
    # the native mobile flow. All of them are legitimately "this app" and
    # should be accepted; comma-separated, e.g. the iOS and Android client
    # IDs from Google Cloud Console.
    GOOGLE_MOBILE_CLIENT_IDS: str = ""
    @property 
    def google_allowed_audiences(self) -> set[str]:
        extra = [cid.strip() for cid in self.GOOGLE_MOBILE_CLIENT_IDS.split(",") if cid.strip()]
        return {self.GOOGLE_CLIENT_ID, *extra} - {""}

    # Bundle ID. Used as client_id for Apple's token and revoke endpoints,
    # not as the identity-token audience check (that is APPLE_CLIENT_IDS).
    APPLE_CLIENT_ID: str = ""
    # Audiences accepted on Sign in with Apple identity tokens. Native iOS
    # tokens use aud == "com.echotocrowd.app"; a web Services ID is a
    # different aud. Env may be a JSON list or a comma-separated string.
    APPLE_CLIENT_IDS: list[str] = ["com.echotocrowd.app"]
    APPLE_TEAM_ID: str = ""
    APPLE_KEY_ID: str = ""
    APPLE_PRIVATE_KEY_PATH: str = ""
    # PEM contents of the Sign in with Apple .p8 key, with literal \n escapes.
    # Preferred over APPLE_PRIVATE_KEY_PATH on Railway.
    APPLE_PRIVATE_KEY: str = ""
    # Fernet key used to encrypt Apple refresh tokens at rest.
    APPLE_TOKEN_ENCRYPTION_KEY: str = ""
    APPLE_REDIRECT_URI: str = ""

    @field_validator("APPLE_CLIENT_IDS", mode="before")
    @classmethod
    def parse_apple_client_ids(cls, value):
        if value is None or (isinstance(value, str) and not value.strip()):
            return ["com.echotocrowd.app"]
        if isinstance(value, str):
            stripped = value.strip()
            if stripped.startswith("["):
                parsed = json.loads(stripped)
                if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
                    raise ValueError("APPLE_CLIENT_IDS must be a JSON list of strings or a comma-separated string")
                ids = [item.strip() for item in parsed if item.strip()]
            else:
                ids = [item.strip() for item in stripped.split(",") if item.strip()]
            if not ids:
                raise ValueError("APPLE_CLIENT_IDS must contain at least one client id")
            return ids
        if isinstance(value, list):
            ids = [item.strip() for item in value if isinstance(item, str) and item.strip()]
            if len(ids) != len(value):
                raise ValueError("APPLE_CLIENT_IDS must be a list of non-empty strings")
            return ids
        return value

    FRONTEND_URL: str = "http://localhost:3000"
    # Comma-separated list of additional allowed CORS origins — e.g. an
    # Expo dev server (exp://<lan-ip>:8081) alongside the web app's origin.
    # FRONTEND_URL is always included even if this is left empty.
    CORS_ORIGINS: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        extra = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return list(dict.fromkeys([self.FRONTEND_URL, *extra]))

    CURRENT_TERMS_VERSION: str = "2026-09"

    # Product rules — see /docs/PRODUCT_BRIEF.md for rationale.
    MIN_RADIUS_METERS: int = 100
    DEFAULT_FEED_RADIUS_METERS: int = 8000
    MAX_FEED_RADIUS_METERS: int = 50000
    MAX_BROADCAST_RADIUS_METERS: int = 100_000
    LOCAL_MAX_RADIUS_METERS: int = 10_000  # free / local reach; above this is regional
    USERNAME_SEARCH_MIN_CHARS: int = 3
    USERNAME_SEARCH_MAX_RESULTS: int = 5
    GROUP_THREAD_DM_THRESHOLD: int = 3  # DMs on one broadcast before "start a group" is offered
    MIN_AGE_YEARS: int = 16
    FOLLOWED_TAG_LIMIT_DEFAULT: int = 2  # student / non-student
    FOLLOWED_TAG_LIMIT_BUSINESS: int = 4
    FOLLOWED_TAG_LIMIT_ADMIN: int = 10_000
    COUNTRY_SLOT_LIMIT_FREE: int = 1
    COUNTRY_SLOT_LIMIT_PAID: int = 2
    COUNTRY_SLOT_CHANGE_DAYS: int = 30
    LINK_PREVIEW_FETCH_TIMEOUT_SECONDS: float = 5
    LINK_PREVIEW_MAX_BYTES: int = 1_048_576

    # Guards POST /internal/jobs/run-digest-now — required header value.
    # Leave unset (empty string) to disable the route entirely in an
    # environment, since an empty expected token never matches a real header.
    INTERNAL_JOB_TOKEN: str = ""

    AWS_REGION: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    SES_FROM_EMAIL: str = ""

    # Distinct IAM user from SES and S3 — AmazonRekognitionReadOnlyAccess only.
    AWS_REKOGNITION_ACCESS_KEY_ID: str = ""
    AWS_REKOGNITION_SECRET_ACCESS_KEY: str = ""
    AWS_REKOGNITION_REGION: str = "us-east-1"
    MODERATION_REJECT_CONFIDENCE: float = 90.0
    MODERATION_FLAG_CONFIDENCE: float = 60.0

    OPENAI_API_KEY: str = ""
    # OpenAI category_scores are 0.0–1.0, unlike Rekognition's 0–100 labels.
    MODERATION_TEXT_REJECT_CONFIDENCE: float = 0.90
    MODERATION_TEXT_FLAG_CONFIDENCE: float = 0.50

    # Distinct IAM user from SES — scoped to echo2crowd/* only.
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_BUCKET_NAME: str = "echo2crowd"
    S3_REGION: str = "us-east-1"
    # Shared secret for the GuardDuty scan-result Lambda callback.
    # Leave unset to disable the webhook (empty never matches a real header).
    INTERNAL_WEBHOOK_SECRET: str = ""
    MAX_IMAGE_UPLOAD_BYTES: int = 10 * 1024 * 1024
    MAX_DOCUMENT_UPLOAD_BYTES: int = 20 * 1024 * 1024

    # Promotes this OAuth email to admin on startup if the user exists.
    # Empty = no-op. Only ever grants admin; never removes it.
    BOOTSTRAP_ADMIN_EMAIL: str = ""


settings = Settings()
