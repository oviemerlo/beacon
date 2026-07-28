import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/**
 * Middleware sends users here when their access token cookie is missing
 * or expired but a refresh token is still present. We can't refresh a
 * cookie mid-render inside a Server Component (Next.js only allows cookie
 * mutation in Route Handlers and Server Actions), so this does a real
 * round-trip: refresh, set new cookies, redirect back to where the user
 * was headed. Costs one extra redirect, only on the hour-ish boundary
 * where the access token actually expires.
 */
export async function GET(req: NextRequest) {
  const refreshToken = req.cookies.get("beacon_refresh_token")?.value;
  const redirectTo = req.nextUrl.searchParams.get("redirect") || "/feed";

  if (!refreshToken) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const res = await fetch(`${API_URL}/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
  if (!res.ok) {
    const failed = NextResponse.redirect(new URL("/login", req.url));
    failed.cookies.delete("beacon_access_token");
    failed.cookies.delete("beacon_refresh_token");
    return failed;
  }

  const { access_token, refresh_token } = await res.json();
  const redirectRes = NextResponse.redirect(new URL(redirectTo, req.url));
  const isProd = process.env.NODE_ENV === "production";

  redirectRes.cookies.set("beacon_access_token", access_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60,
  });
  redirectRes.cookies.set("beacon_refresh_token", refresh_token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return redirectRes;
}
