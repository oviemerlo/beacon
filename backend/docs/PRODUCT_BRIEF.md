# Beacon — Product Brief

## What it is

Beacon lets people connect with others nearby who share their nationality
and/or hobbies, and lets local businesses reach a nearby audience. It exists
to solve a gap neither general social apps (Bumble BFF, Meetup, Nextdoor)
nor newcomer-specific tools currently cover safely: proximity- and
identity-affinity-based discovery for people who've just moved somewhere new.

## Core functionality

### 1. Profile & onboarding
Every user sets a registered location, optional nationality tag(s), and
hobby tag(s). Businesses get a distinct `account_type` and can be verified.
Location is stored precisely but is never exposed directly to other users —
see "What is never exposed" below.

### 2. Broadcasts
A user (or business) posts a broadcast: free-text content, a set of target
tags (`any` or `all` match mode), and a radius. The radius is measured from
either the sender's own location or an arbitrary point they choose
(Indeed-style — e.g. a business targeting a neighborhood before opening).

### 3. Feed (discovery)
Two tabs, both feed-only — there is no user-search-by-attribute anywhere:
- **For You**: every broadcast within its own radius of the viewer,
  ranked by shared-tag count, then distance, then recency. No opt-in
  required to see this tab. Tags **boost ranking**, they never gate
  visibility — this is deliberate (see "Why tags don't hard-filter" below).
- **Opt-in**: broadcasts tagged with something the user has explicitly
  followed. This is the only feed where a tag acts as a filter rather than
  a ranking signal, because the user opted into it themselves.

### 4. Messaging
1:1 conversations can **only** be started by someone who saw a broadcast in
their feed, reaching out to that broadcast's sender. The sender cannot
initiate first contact with a stranger. Once a thread exists it's
bidirectional. Eligibility is enforced server-side via a recorded
`BroadcastImpression`, not a live re-check of distance — this means a
legitimately-started conversation survives the user moving or the broadcast
expiring.

### 5. Weekly digest (retention)
A scheduled job (`app/jobs/digest_job.py`) builds a per-user digest of:
new broadcasts in their feed since last digest, an **aggregate count** of
new same-tag users nearby, and unread message count. Sent only if there's
something to say. See "Why the digest is aggregate-only" below.

### 6. Group threads (planned, schema included)
Once a broadcast has generated 3+ independent 1:1 conversations, the
sender can promote it to a group. Membership is restricted to users who
already have a valid 1:1 conversation tied to that broadcast — this keeps
group formation consistent with the same "you must have seen the broadcast"
rule as DMs. Not yet wired into API routes; models exist in
`app/models/group.py` for the next milestone.

## Guardrails and the reasoning behind them

These aren't arbitrary restrictions — they're the result of walking through
what happens when the same feature is used by someone with bad intent
against a population (newcomers) that is more vulnerable to being targeted
by nationality and location than the general population.

**No user search by location, nationality, or hobby, anywhere.**
The only thing ever queried by location is broadcasts. A user table query
filtered by nationality + radius is a targeting tool, full stop — it doesn't
matter what the stated intent is. This is not hypothetical: USAHello shut
down its FindHello app (a directory for immigrants, filterable by location)
in Feb 2026, explicitly because they became concerned the information could
be misused to target the people it was meant to help.

**Username search is exact/prefix-only, capped, and rate-limited, and does
NOT unlock messaging.** It exists so someone can find a handle they already
know, not so anyone can browse a directory. If it unlocked DMs it would be
a backdoor around the broadcast-initiation rule.

**Why tags don't hard-filter the For You feed.** A hard filter would let a
sender construct a query like "only show this to people tagged X within
500m" — functionally identical to the search we've deliberately excluded,
just relabeled as "targeting." Boosting instead of filtering keeps the
targeting expressive for senders (their message is more likely to reach
people who'd care) without ever becoming a precise, queryable audience
selector.

**Why the digest is aggregate-only.** "14 people who share your tags joined
nearby this week" is safe. A list of those 14 people is not — it's the same
targeting surface as open search, just delivered weekly instead of on
demand. Every digest field is a count or content the user could already see
in their feed.

**Why DM eligibility uses a stored impression, not live distance.** Checking
live distance at message-send time means a broadcast expiring, or the
recipient moving, silently revokes a conversation that was legitimately
started. Recording the impression at feed-render time makes eligibility a
fact about what happened, not a moving target.

## Tech stack

- **Backend**: FastAPI (async), SQLAlchemy 2.0 (async), Postgres + PostGIS,
  Alembic migrations, APScheduler for the digest job (swap for an Azure
  Function timer trigger at scale)
- **Auth**: OAuth (Google, Apple) via Authlib for web; native SDK token
  exchange for mobile. App issues its own JWT access/refresh pair after
  verifying the provider identity.
- **Frontend** (next phase): Next.js (web, SEO), React Native or a
  Next.js-shared-logic mobile shell (to be decided) for mobile
- **Real-time chat** (next phase): WebSockets, or Socket.io as a small
  companion Node service if reconnect/room handling is needed
