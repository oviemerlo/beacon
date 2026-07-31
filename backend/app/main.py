from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler

from app.api.routes import auth, broadcasts, feed, geocode, messages, search, users
from app.api.routes.search import limiter
from app.api.error_handlers import register_error_handlers
from app.core.config import settings
from app.jobs.digest_job import run_weekly_digest

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Weekly digest — Monday 09:00 UTC. Swap for an Azure Function timer
    # trigger in production if you'd rather not run a scheduler in-process.
    scheduler.add_job(run_weekly_digest, CronTrigger(day_of_week="mon", hour=9))
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
app.include_router(users.router)
app.include_router(broadcasts.router)
app.include_router(feed.router)
app.include_router(search.router)
app.include_router(messages.router)
app.include_router(geocode.router)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/internal/jobs/run-digest-now", include_in_schema=False)
async def trigger_digest_manually(x_internal_job_token: str | None = Header(default=None)):
    """
    Manual trigger for local testing/ops. Previously had no auth at all —
    anyone who could reach the API could force a full digest run (email
    volume / cost abuse, or just repeated spam to every user). Now requires
    a header matching INTERNAL_JOB_TOKEN; with that setting unset (the
    default), no header value can match and the route always 403s.
    """
    if not settings.INTERNAL_JOB_TOKEN or x_internal_job_token != settings.INTERNAL_JOB_TOKEN:
        raise HTTPException(403, "Not authorized to trigger internal jobs")
    await run_weekly_digest()
    return {"status": "digest run triggered"}
