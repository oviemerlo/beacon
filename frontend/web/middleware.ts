import { NextRequest, NextResponse } from "next/server";
import { isJwtExpired } from "./helpers/jwt";

const PROTECTED_PREFIXES = ["/feed", "/broadcasts", "/conversations", "/profile", "/follow-tags", "/onboarding", "/admin"];

export function middleware(req: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const accessToken = req.cookies.get("beacon_access_token")?.value;
  const refreshToken = req.cookies.get("beacon_refresh_token")?.value;

  if (accessToken && !isJwtExpired(accessToken)) {
    return NextResponse.next();
  }

  // Access token missing/expired. Previously this fell straight through to
  // /login even when a valid refresh token was sitting right there — users
  // got silently logged out every hour instead of transparently refreshed.
  // Route through /auth/refresh (a Route Handler, which CAN mutate cookies)
  // instead, and only give up if there's no refresh token to try.
  if (refreshToken) {
    const refreshUrl = new URL("/auth/refresh", req.url);
    refreshUrl.searchParams.set("redirect", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(refreshUrl);
  }

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/feed/:path*", "/broadcasts/:path*", "/conversations/:path*", "/profile/:path*", "/follow-tags/:path*", "/onboarding/:path*", "/admin/:path*"],
};
