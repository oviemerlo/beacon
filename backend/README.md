# Beacon Backend

FastAPI + Postgres/PostGIS backend for Beacon. See `docs/PRODUCT_BRIEF.md`
for what the app does and why each guardrail exists, and
`docs/SECURITY_FIXES.md` for a record of issues found in review and how
they were fixed — the code comments reference both throughout.

## Setup

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# edit .env: DATABASE_URL, JWT_SECRET, GOOGLE_CLIENT_ID/SECRET, Apple keys,
# INTERNAL_JOB_TOKEN if you want to use the manual digest trigger

# Requires Postgres with the PostGIS extension available (postgis/postgis
# Docker image, or `CREATE EXTENSION postgis;` on a managed instance that
# supports it — Azure Database for PostgreSQL Flexible Server does).
alembic upgrade head

python -m scripts.seed_tags     # starter nationality/hobby taxonomy
python -m scripts.seed_schools  # universities + email domains for school verification

uvicorn app.main:app --reload
```

API docs at `http://localhost:8000/docs`.

## Architecture

Three layers, each with one job:

- **`app/api/routes/`** — HTTP only. Parses the request (Pydantic does
  most of this for free), calls exactly one service function, and either
  returns its result or lets a raised domain exception bubble up to the
  handlers in `app/api/error_handlers.py`. No business logic, no direct
  database access.
- **`app/services/`** — business rules and transaction boundaries. This is
  where the app's actual guardrails live — DM eligibility
  (`conversation_service.py`), the aggregate-only digest
  (`digest_service.py`), radius validation (`broadcast_service.py`).
  Services call one or more repositories, and own the `commit()`/rollback
  boundary — a service can make several repository calls that all succeed
  or all roll back together. Services raise `app/services/exceptions.py`
  types (`NotFoundError`, `ForbiddenError`, `ValidationError`,
  `ConflictError`) rather than importing FastAPI's `HTTPException` — that
  keeps them usable from a script or a background job without needing a
  fake HTTP request to call into them.
- **`app/repositories/`** — data access only. Every query lives here, one
  file per aggregate (`user_repository.py`, `broadcast_repository.py`,
  `conversation_repository.py`, `block_repository.py`, `tag_repository.py`).
  Repositories never commit — they `flush()` (to get generated IDs within
  the current transaction) and leave the commit to whichever service
  called them. This is also the enforcement boundary for the app's central
  privacy rule: `user_repository.py` and `broadcast_repository.py` are the
  *only* modules that query the `users`/`broadcasts` tables, so "no
  search-by-location-or-tag" has exactly one place to audit instead of
  being an implicit convention a new query could quietly break.

Shared infrastructure that isn't really business logic lives in
`app/utils/`: JWT signing (`security.py`), OAuth token verification against
Google/Apple (`oauth_verify.py`), the one-time exchange-code store used by
the web OAuth redirect (`oauth_exchange.py`), and settings (`config.py`).

```
app/
  utils/           settings, JWT, OAuth verification, exchange-code store, age checks
  db/              async engine/session, declarative base
  models/          SQLAlchemy models (see docs/PRODUCT_BRIEF.md for schema rationale)
  schemas/         Pydantic request/response models
  repositories/     data access — one file per aggregate, no business logic
  services/
    auth_service.py           identity upsert, token issuance
    user_service.py           profile updates, tag follows
    feed_service.py           feed assembly + impression recording
    broadcast_service.py      broadcast create/delete
    conversation_service.py   DM eligibility (the core guardrail) + messaging
    search_service.py         username search validation
    digest_service.py         weekly digest payload + orchestration
    exceptions.py             domain exceptions routes translate to HTTP codes
  jobs/
    digest_job.py    scheduled job, wired in main.py via APScheduler
  api/
    routes/          auth (OAuth), users, broadcasts, feed, search, messages — thin
    deps.py          get_current_user
    error_handlers.py  maps domain exceptions to HTTP responses
alembic/           migrations (0001 creates the full schema + PostGIS extension)
scripts/           one-off scripts (tag + school seeding)
docs/              product brief, security fixes changelog
```

A request flows `route -> service -> repository -> db`, always in that
direction — routes never call repositories directly, and repositories
never call services.

## Testing the digest locally

`POST /internal/jobs/run-digest-now` triggers the weekly job immediately.
Requires an `X-Internal-Job-Token` header matching `INTERNAL_JOB_TOKEN` in
your `.env` — the route always 403s if that setting is left unset, so
there's no accidental "forgot to protect this before shipping" state.

## OAuth setup notes

- **Google**: create OAuth 2.0 credentials in Google Cloud Console, add
  `GOOGLE_REDIRECT_URI` as an authorized redirect URI. Mobile apps use
  Google's native Sign-In SDK and call `/auth/google/token-exchange` with
  the resulting ID token rather than the web redirect flow.
- **Apple**: requires a Services ID, a Sign in with Apple key (.p8), and
  your Team ID from the Apple Developer portal. Apple only sends the
  user's name on first authorization — the frontend must capture and pass
  it through on that first call.
- Both token-exchange routes verify the identity token's signature,
  issuer, and audience before trusting anything in it
  (`app/utils/oauth_verify.py`) — Google via the official `google-auth`
  library, Apple via its published JWKS. See `docs/SECURITY_FIXES.md` for
  what this replaced.
- The web redirect flow never puts tokens in a URL — the callback mints a
  one-time exchange code (`app/utils/oauth_exchange.py`) that the frontend
  trades for real tokens server-side. That store is in-memory and
  process-local; swap for Redis before running more than one backend
  worker, since a code minted on worker A won't be found on worker B.

## What's next

Frontend (`frontend/web`, `frontend/mobile` — see the top-level repo)
covers most of the UI; wiring up the group-thread routes (models exist in
`app/models/group.py`, no repository/service/routes yet) and real-time
chat (message routes are currently request/response only, both frontends
poll) are the two biggest remaining gaps.
