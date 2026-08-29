from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.api.routes import admin, auth, blocks, broadcasts, feed, geocode, internal, messages, reports, schools, search, tags, uploads, users
from app.api.routes.search import limiter
from app.api.error_handlers import register_error_handlers
from app.utils.config import settings
from app.jobs.digest_job import run_weekly_digest
from app.jobs.reverification_job import run_daily_reverification_check

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Weekly digest — Monday 09:00 UTC. Swap for an Azure Function timer
    # trigger in production if you'd rather not run a scheduler in-process.
    scheduler.add_job(run_weekly_digest, CronTrigger(day_of_week="mon", hour=9))
    # Daily school reverification — 08:00 UTC. Windows are per-user (verified_at + 3 months).
    scheduler.add_job(run_daily_reverification_check, CronTrigger(hour=8))
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(title="Beacon API", version="0.1.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
register_error_handlers(app)

app.add_middleware(
    SessionMiddleware,
    secret_key=settings.JWT_SECRET,
    same_site="lax",
    https_only=settings.ENVIRONMENT == "production",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(users.router)
app.include_router(broadcasts.router)
app.include_router(feed.router)
app.include_router(search.router)
app.include_router(messages.router)
app.include_router(blocks.router)
app.include_router(geocode.router)
app.include_router(tags.router)
app.include_router(reports.router)
app.include_router(schools.router)
app.include_router(uploads.router)
app.include_router(internal.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
