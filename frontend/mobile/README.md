# Beacon Mobile

Expo (React Native) app, structured to mirror `frontend/web` screen-for-screen
so both clients hit the exact same backend contract.

## Setup

```bash
npm install
cp .env.example .env   # EXPO_PUBLIC_API_URL, EXPO_PUBLIC_GOOGLE_CLIENT_ID
npx expo start
```

Requires a Google OAuth **iOS** or **Web** client ID (not the Android one)
for `expo-auth-session`'s implicit flow, and an Apple Developer account with
Sign in with Apple enabled for the bundle ID in `app.json`.

## How auth compares to web

Web stores tokens in an httpOnly cookie (JS on the page can never read them).
Mobile has no equivalent browser sandbox, so `expo-secure-store` — backed by
Keychain on iOS / Keystore on Android — plays that role instead. Same
token-exchange contract on the backend either way (`src/lib/auth.ts` calls
the same `/auth/google/token-exchange` and `/auth/apple/token-exchange`
routes as the backend scaffold already exposes).

## What's wired vs. stubbed

Same state as `frontend/web` — see that README's breakdown. Screens here
call the exact same backend paths with the same JSON shapes; the three
backend gaps (`GET /tags`, `GET /broadcasts/{id}`, `GET /conversations`)
are marked `TODO` in the same places.

## Structure

```
App.tsx                        entrypoint, renders RootNavigator
src/
  navigation/RootNavigator.tsx  auth gate → onboarding → tab navigator
  screens/                      one file per screen, mirrors app/ in web
  lib/
    api.ts        fetch wrapper with auto refresh-token retry
    auth.ts       Google (expo-auth-session) + Apple (expo-apple-authentication)
    secureStore.ts Keychain/Keystore-backed token storage
  theme/tokens.ts  same palette as frontend/web/tailwind.config.ts
  components/Shared.tsx  Card, SignalPing — same signature element as web
  types/api.ts     mirrors the backend's Pydantic schemas
```

## Known gaps

- Tag picker UI (onboarding + broadcast composer) is a placeholder pending
  a `GET /tags` backend endpoint
- No push notifications wired yet (relevant once the digest job or
  real-time chat need to reach a backgrounded app)
- Real-time chat is polling (4s interval), same stopgap as web, pending
  WebSocket support on the backend
