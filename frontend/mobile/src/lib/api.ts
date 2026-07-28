import { TokenStore } from "./secureStore";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await TokenStore.getRefreshToken();
  if (!refreshToken) return null;

  const res = await fetch(`${API_URL}/auth/refresh?refresh_token=${refreshToken}`, { method: "POST" });
  if (!res.ok) return null;

  const { access_token, refresh_token } = await res.json();
  await TokenStore.save(access_token, refresh_token);
  return access_token;
}

/**
 * Same contract as frontend/web/lib/client-api.ts's clientFetch — same
 * paths, same JSON shapes, hitting the FastAPI backend directly (no proxy
 * needed on mobile since there's no browser JS context to protect the
 * token from; SecureStore is the mobile equivalent of the web's httpOnly
 * cookie).
 */
export async function apiFetch<T>(path: string, init?: RequestInit, _retried = false): Promise<T> {
  const token = await TokenStore.getAccessToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && !_retried) {
    const newToken = await refreshAccessToken();
    if (newToken) return apiFetch<T>(path, init, true);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
