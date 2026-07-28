import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Server-side fetch to the FastAPI backend. Reads the access token from an
 * httpOnly cookie (set in /app/auth/exchange's Route Handler after the
 * OAuth redirect) so the token never touches client-side JS. Client
 * Components should call our own /api/proxy/* route instead of this
 * directly — see lib/client-api.ts.
 *
 * Token refresh for Server Component reads happens in middleware.ts
 * (before this ever runs) rather than here, since Server Components can't
 * mutate cookies mid-render — only Route Handlers and Server Actions can.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = cookies().get("beacon_access_token")?.value;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function getCurrentUserOrNull() {
  try {
    return await apiFetch<import("@/types/api").UserProfile>("/users/me");
  } catch {
    return null;
  }
}
