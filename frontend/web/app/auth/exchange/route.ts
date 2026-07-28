import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Replaces the old app/auth/callback Client Component. The backend's
 * /auth/google/callback now redirects here with a one-time `code` (see
 * beacon-backend's docs/SECURITY_FIXES.md) instead of returning JSON or
 * putting tokens directly in the URL. This Route Handler:
 *   1. Trades the code for real tokens server-side (POST /auth/exchange)
 *   2. Sets them as httpOnly cookies directly on the redirect response
 *   3. Sends the browser to /onboarding or /feed depending on whether
 *      the user has completed onboarding yet
 *
 * At no point does client-side JS ever see an access or refresh token.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", req.url));
  }

  const exchangeRes = await fetch(`${API_URL}/auth/exchange?code=${encodeURIComponent(code)}`, { method: "POST" });
  if (!exchangeRes.ok) {
    return NextResponse.redirect(new URL("/login?error=exchange_failed", req.url));
  }
  const { access_token, refresh_token } = await exchangeRes.json();

  // Check onboarding status with the fresh token before deciding where to send them.
  let needsOnboarding = true;
  try {
    const meRes = await fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${access_token}` } });
    if (meRes.ok) {
      const me = await meRes.json();
      needsOnboarding = !me.location_label;
    }
  } catch {
    // If this check fails, default to onboarding — it's a safe landing
    // spot either way and will no-op if the user already has a location.
  }

  const destination = needsOnboarding ? "/onboarding" : "/feed";
  const res = NextResponse.redirect(new URL(destination, req.url));
  const isProd = process.env.NODE_ENV === "production";

  res.cookies.set("beacon_access_token", access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  res.cookies.set("beacon_refresh_token", refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
