from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

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

    APPLE_CLIENT_ID: str = ""
    APPLE_TEAM_ID: str = ""
    APPLE_KEY_ID: str = ""
    APPLE_PRIVATE_KEY_PATH: str = ""
    APPLE_REDIRECT_URI: str = ""

    FRONTEND_URL: str = "http://localhost:3000"
    # Comma-separated list of additional allowed CORS origins — e.g. an
    # Expo dev server (exp://<lan-ip>:8081) alongside the web app's origin.
    # FRONTEND_URL is always included even if this is left empty.
    CORS_ORIGINS: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        extra = [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
        return list(dict.fromkeys([self.FRONTEND_URL, *extra]))

    # Product rules — see /docs/PRODUCT_BRIEF.md for rationale.
    MIN_RADIUS_METERS: int = 100
    DEFAULT_FEED_RADIUS_METERS: int = 8000
    MAX_FEED_RADIUS_METERS: int = 50000
    MAX_BROADCAST_RADIUS_METERS: int = 100_000
    LOCAL_MAX_RADIUS_METERS: int = 10_000  # free / local reach; above this is regional
    USERNAME_SEARCH_MIN_CHARS: int = 3
    USERNAME_SEARCH_MAX_RESULTS: int = 5
    GROUP_THREAD_DM_THRESHOLD: int = 3  # DMs on one broadcast before "start a group" is offered
    MIN_AGE_YEARS: int = 13
    FOLLOWED_TAG_LIMIT_DEFAULT: int = 2  # student / non-student
    FOLLOWED_TAG_LIMIT_BUSINESS: int = 4
    FOLLOWED_TAG_LIMIT_ADMIN: int = 10_000

    # Guards POST /internal/jobs/run-digest-now — required header value.
    # Leave unset (empty string) to disable the route entirely in an
    # environment, since an empty expected token never matches a real header.
    INTERNAL_JOB_TOKEN: str = ""

    AWS_REGION: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    SES_FROM_EMAIL: str = ""


settings = Settings()
