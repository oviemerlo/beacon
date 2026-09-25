import Constants from "expo-constants";
import { Platform } from "react-native";
import { TokenStore } from "./secureStore";
import { extractErrorMessage } from "./httpError";

export type AppEnv = "local" | "dev" | "prod";

const LOCAL_API_PORT = 8000;
const RAILWAY_API_URL = "https://beacon-production-37c7.up.railway.app";

// Point dev at a separate Railway service later if you add one.
const REMOTE_API_URLS: Record<Exclude<AppEnv, "local">, string> = {
  dev: RAILWAY_API_URL,
  prod: RAILWAY_API_URL,
};

export function appEnv(): AppEnv {
  const raw = (process.env.EXPO_PUBLIC_APP_ENV ?? "").trim().toLowerCase();
  if (raw === "local" || raw === "dev" || raw === "prod") return raw;
  // No env set: development builds talk to your machine, release builds to Railway.
  return __DEV__ ? "local" : "prod";
}

function localApiUrl(): string {
  // Metro's host, e.g. "192.168.2.214:8081". Using it means a physical phone
  // on the same Wi-Fi reaches your Mac's backend too, not just the simulator.
  const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (metroHost && metroHost !== "localhost" && metroHost !== "127.0.0.1") {
    return `http://${metroHost}:${LOCAL_API_PORT}`;
  }
  return Platform.OS === "android"
    ? `http://10.0.2.2:${LOCAL_API_PORT}` // Android emulator -> host machine
    : `http://127.0.0.1:${LOCAL_API_PORT}`; // iOS simulator
}

export function apiBaseUrl(): string {
  const env = appEnv();
  return env === "local" ? localApiUrl() : REMOTE_API_URLS[env];
}

if (__DEV__) {
  console.log("[api] env", { env: appEnv(), apiUrl: apiBaseUrl() });
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

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
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
