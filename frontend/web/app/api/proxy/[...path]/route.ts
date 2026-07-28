import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { isJwtExpired } from "@/lib/jwt";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const isProd = process.env.NODE_ENV === "production";

async function refreshTokens(): Promise<{ access_token: string; refresh_token: string } | null> {
  const refreshToken = cookies().get("beacon_refresh_token")?.value;
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh?refresh_token=${encodeURIComponent(refreshToken)}`, { method: "POST" });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Previously only ever read the access token and never touched the refresh
 * token, even though the web app stores one — an expired access token
 * meant every subsequent Client Component call 401'd until the user
 * manually logged back in. Now: retry once with a refreshed token before
 * giving up, and persist the new tokens as cookies so the next request
 * doesn't have to refresh again.
 */
async function proxy(req: NextRequest, path: string[]) {
  let token = cookies().get("beacon_access_token")?.value;
  let refreshedTokens: { access_token: string; refresh_token: string } | null = null;

  if (!token || isJwtExpired(token)) {
    refreshedTokens = await refreshTokens();
    token = refreshedTokens?.access_token;
  }

  const search = req.nextUrl.search;
  const target = `${API_URL}/${path.join("/")}${search}`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await req.text();

  let res = await fetch(target, {
    method: req.method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });

  // Backend rejected the token even though our local expiry check thought
  // it was fine (clock skew, or it was revoked) — try one refresh-and-retry
  // before surfacing the failure.
  if (res.status === 401 && !refreshedTokens) {
    refreshedTokens = await refreshTokens();
    if (refreshedTokens) {
      res = await fetch(target, {
        method: req.method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${refreshedTokens.access_token}` },
        body,
        cache: "no-store",
      });
    }
  }

  const responseBody = await res.text();
  const response = new NextResponse(responseBody, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });

  if (refreshedTokens) {
    response.cookies.set("beacon_access_token", refreshedTokens.access_token, {
      httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 60 * 60,
    });
    response.cookies.set("beacon_refresh_token", refreshedTokens.refresh_token, {
      httpOnly: true, secure: isProd, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    });
  }

  return response;
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PATCH(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxy(req, params.path);
}
