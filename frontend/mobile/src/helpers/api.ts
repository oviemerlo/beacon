import { Platform } from "react-native";
import { TokenStore } from "./secureStore";
import { extractErrorMessage } from "./httpError";

export function apiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000";
  if (Platform.OS !== "android") return configured;
  return configured.replace("://127.0.0.1", "://10.0.2.2").replace("://localhost", "://10.0.2.2");
}

const API_URL = apiBaseUrl();

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
  const isFormData = typeof FormData !== "undefined" && init?.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
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
    throw new ApiError(res.status, extractErrorMessage(body, res.statusText));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
