# Beacon Web

Next.js (App Router) frontend for Beacon. Barebone scaffold — screens are
wired to real backend logic where that logic matters (feed, broadcast
targeting, DM eligibility) and left as clearly-marked TODOs where it's
routine CRUD not yet built on the backend.

## Setup

```bash
npm install
cp .env.local.example .env.local   # point NEXT_PUBLIC_API_URL at your backend
npm run dev
```

## Auth flow

Tokens never touch client-side JS. The flow (fixed per security review —
see backend's `docs/SECURITY_FIXES.md` for the full before/after):

1. `/login` links straight to the backend's `GET /auth/google/login`.
2. Backend handles the Google OAuth exchange, mints its own JWTs, and
   stashes them behind a short-lived **one-time exchange code** — never
   puts the actual tokens in a redirect URL, where they'd land in browser
   history and referrer headers.
3. Backend redirects to `${FRONTEND_URL}/auth/exchange?code=...`.
4. `/auth/exchange` (a Route Handler, not a Client Component) trades the
   code for the real tokens server-side via `POST /auth/exchange`, sets
   them as httpOnly cookies, and redirects to `/onboarding` or `/feed`.
5. Every subsequent request either runs server-side (`lib/api.ts`, reads
   the cookie directly) or goes through `/api/proxy/*`
   (`lib/client-api.ts`), which attaches the cookie server-side.
6. When the access token expires, `middleware.ts` catches it (checked via
   `lib/jwt.ts`'s expiry check) and routes through `/auth/refresh` — a
   Route Handler that calls the backend's refresh endpoint and sets new
   cookies — before the protected page ever renders. The `/api/proxy`
   route does the same refresh-and-retry for client-initiated calls that
   outlive the access token mid-session.

This means a Client Component never has an access token to accidentally log,
send to Sentry, or leak via XSS — it only ever talks to our own domain, and
a code intercepted mid-redirect is useless after one use within 60 seconds.

## What's scaffolded vs. stubbed

Wired to real backend logic:
- OAuth login → one-time code → session cookie → protected routes, with
  transparent refresh (`middleware.ts`, `/auth/refresh`, `/api/proxy`)
- Feed (For You / Opt-in tabs) — `GET /feed/for-you`, `GET /feed/opt-in`
- Broadcast composer, including the radius slider mapped to real meter values
- Starting a conversation from a broadcast (surfaces the backend's

  eligibility error if the broadcast was never in your feed)
- Message thread (polling — swap for WebSocket once backend adds it)

Marked `TODO` in the code, backend endpoint needed:
- `GET /tags` — tag picker in onboarding and the broadcast composer currently
  has nowhere to fetch the taxonomy from
- `GET /broadcasts/{id}` — broadcast detail page doesn't show sender/content
  yet, only the reply box
- `GET /conversations` — no "list my threads" endpoint yet in the backend

## Structure

```
app/
  page.tsx                landing (redirects to /feed if signed in)
  login/                  OAuth entry
  auth/exchange/           one-time code → cookie exchange (server-side)
  auth/refresh/            silent token refresh, invoked by middleware
  onboarding/             location + tags, gates first feed visit
  feed/                   For You / Opt-in tabs
  broadcasts/new/         targeting builder (radius, tag match mode)
  broadcasts/[id]/        reply flow (DM-initiation rule surfaces here)
  conversations/          thread list + detail
  profile/                self-view profile
  api/proxy/[...path]/    forwards Client Component calls to the backend, with refresh-and-retry
lib/
  api.ts          server-side fetch (Server Components, Route Handlers)
  client-api.ts   client-side fetch (always via the proxy)
  jwt.ts          local (unverified) expiry check — routing hint only, not a trust boundary
components/       AppNav, SignalPing (see docs/DESIGN.md)
types/api.ts      mirrors the backend's Pydantic schemas
middleware.ts     redirects signed-out users away from protected routes
docs/DESIGN.md    design token rationale
```
