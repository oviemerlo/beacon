# Beacon

## Layout

```
backend/           FastAPI + Postgres/PostGIS (delivered separately as beacon-backend.zip)
frontend/
  web/              Next.js — see frontend/web/README.md
  mobile/           Expo (React Native) — see frontend/mobile/README.md
```

`web` and `mobile` are two independent apps, not a shared-code monorepo —
each has its own `package.json` and dependency tree. What they share is a
**contract**, not code:

- The same REST paths and JSON shapes (`frontend/web/types/api.ts` and
  `frontend/mobile/src/types/api.ts` are hand-kept in sync — worth
  replacing with a generated client from the backend's OpenAPI schema once
  the API stabilizes, so they can't drift silently)
- The same design tokens (`frontend/web/tailwind.config.ts` and
  `frontend/mobile/src/theme/tokens.ts`)
- The same product rules, most importantly the DM-initiation rule: both
  clients call `POST /conversations` with a `broadcast_id` and surface the
  backend's rejection if that broadcast was never in the user's feed —
  neither client tries to reproduce that logic locally

## Where each functional requirement lives

| Requirement | Backend | Web | Mobile |
|---|---|---|---|
| Targeting builder (tags + radius) | `POST /broadcasts` | `app/broadcasts/new` | `src/screens/NewBroadcastScreen.tsx` |
| Feed (For You / Opt-in) | `GET /feed/for-you`, `GET /feed/opt-in` | `app/feed` | `src/screens/FeedScreen.tsx` |
| No user search by location/tags | enforced in `app/services/matching.py` | N/A — no such UI exists | N/A — no such UI exists |
| Username-only search | `GET /search/users` | not yet wired to a UI | not yet wired to a UI |
| Broadcast-initiated DM | `POST /conversations` (eligibility check) | `app/broadcasts/[id]` | `BroadcastDetailScreen.tsx` |
| Messaging | `GET/POST /conversations/{id}/messages` | `app/conversations/[id]` | `ConversationDetailScreen.tsx` |
| OAuth (Google + Apple) | `app/api/routes/auth.py` | redirect flow, `app/auth/callback` | native SDK, `src/lib/auth.ts` |
| Weekly digest | `app/jobs/digest_job.py` | (server-side, no UI needed yet) | (server-side, no UI needed yet) |

## Known gaps across both clients

Three backend endpoints don't exist yet and both `web` and `mobile` have
matching `TODO`s waiting on them:
- `GET /tags` — tag picker in onboarding and the broadcast composer
- `GET /broadcasts/{id}` — broadcast detail (currently reply-box only)
- `GET /conversations` — list-my-threads

Real-time chat is polling on both clients (4s interval) pending WebSocket
support on the backend.

## Running everything locally

```bash
# 1. Backend
cd backend && alembic upgrade head && uvicorn app.main:app --reload

# 2. Web
cd frontend/web && npm install && npm run dev

# 3. Mobile
cd frontend/mobile && npm install && npx expo start
```
