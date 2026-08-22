# Security fixes

Findings from code review, and what changed. Kept as a record since a few
of these are the kind of regression that's easy to reintroduce without
realizing it (e.g. swapping back to unverified token decoding "just for a
quick local test").

## Critical — OAuth token exchange trusted unverified identity tokens

**Before**: `app/api/routes/auth.py`'s mobile token-exchange routes called
`jose_jwt.decode(id_token, key=None)`. Decoding without a key does not
check the signature — a forged JWT with any `sub` claim would have been
accepted, letting an attacker create or log into arbitrary accounts.

**After**: `app/utils/oauth_verify.py` adds real verification —
`verify_google_id_token` uses the official `google-auth` library, which
checks signature (against Google's rotating certs), issuer, audience, and
expiry in one call. `verify_apple_identity_token` fetches Apple's JWKS,
matches the token's `kid`, and verifies signature/issuer/audience with
`python-jose`. Both routes in `auth.py` now call these and reject with 401
on any verification failure.

## High — Web OAuth flow was broken end-to-end

**Before**: `google_callback` returned `TokenPairOut` as JSON. The
frontend's callback page expected a redirect with tokens as query params.
Neither side matched, so browser login never actually completed.

**After**: rather than just making the two sides agree (which would have
meant putting live tokens in a redirect URL — visible in browser history,
referrer headers, and server logs), the backend now mints a **one-time
exchange code** (`app/utils/oauth_exchange.py`, 60s TTL, single use) and
redirects to `${FRONTEND_URL}/auth/exchange?code=...`. The frontend's new
`app/auth/exchange/route.ts` (a Route Handler, not a Client Component)
trades the code for real tokens server-side via `POST /auth/exchange` and
sets them as httpOnly cookies — a token never appears in a URL at any
point, and a code intercepted mid-redirect is useless after one use.

## High — `POST /broadcasts` didn't match what either frontend sends

**Before**: the route declared `content`, `latitude`, `longitude`, etc. as
individual function parameters. FastAPI treats bare primitive parameters
as query params, not a request body — both frontends send a JSON body
(matching the existing but unused `BroadcastCreateIn` schema), so every
real call would have 422'd.

**After**: the route takes `payload: BroadcastCreateIn` as its body, which
is what both `frontend/web/app/broadcasts/new/page.tsx` and
`frontend/mobile/src/screens/NewBroadcastScreen.tsx` already send.

## High — internal digest trigger was publicly callable

**Before**: `POST /internal/jobs/run-digest-now` had no auth check at all.
Anyone who could reach the API could force a full digest run repeatedly —
email volume/cost abuse, or just spamming every user.

**After**: requires an `X-Internal-Job-Token` header matching a new
`INTERNAL_JOB_TOKEN` setting. That setting defaults to an empty string,
which can never match a real header value, so the route 403s by default
until explicitly configured — safer than "remember to protect this before
shipping."

## Medium — web had a refresh token cookie but never used it

**Before**: `frontend/web` stored `beacon_refresh_token` on login but
neither `lib/api.ts` nor the proxy route ever attempted `/auth/refresh`.
Users were silently logged out roughly every hour (the access token's
lifetime) instead of transparently refreshed.

**After**: two paths, because Server Components can't mutate cookies
mid-render (only Route Handlers and Server Actions can):
- **Page loads**: `middleware.ts` checks the access token's expiry
  (`lib/jwt.ts` — a local, unverified check used only as a routing hint;
  the backend remains the actual trust boundary) and redirects through
  `app/auth/refresh/route.ts` first if it's expired, which refreshes,
  sets new cookies, and redirects back to the original destination.
- **Client-initiated calls mid-session**: `app/api/proxy/[...path]/route.ts`
  now checks expiry before forwarding, and retries once with a refreshed
  token if the backend still returns 401.
