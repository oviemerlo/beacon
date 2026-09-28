import { clientFetch } from "@/helpers/client-api";
import { distanceMeters } from "@/helpers/distance";
import type { UserProfile } from "@/types/api";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const MOVE_THRESHOLD_METERS = 500;
const POSITION_TIMEOUT_MS = 10_000;

let lastAttemptAt = 0;

function logLocation(message: string) {
  if (process.env.NODE_ENV === "development") console.log(message);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export async function geolocationPermission(): Promise<PermissionState | "unknown"> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "denied";
  if (!navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" });
    return status.state;
  } catch {
    return "unknown";
  }
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: POSITION_TIMEOUT_MS,
      maximumAge: 60_000,
    });
  });
}

export async function syncLocationIfMoved(registered: {
  latitude: number | null;
  longitude: number | null;
}): Promise<UserProfile | null> {
  try {
    const permission = await geolocationPermission();
    if (permission !== "granted") {
      logLocation("[location] skipped (permission)");
      return null;
    }

    const now = Date.now();
    if (now - lastAttemptAt < SYNC_INTERVAL_MS) {
      logLocation("[location] skipped (throttled)");
      return null;
    }
    lastAttemptAt = now;

    const pos = await withTimeout(currentPosition(), POSITION_TIMEOUT_MS);
    const { latitude, longitude } = pos.coords;
    const registeredLatitude = registered.latitude;
    const registeredLongitude = registered.longitude;
    const moved =
      registeredLatitude == null ||
      registeredLongitude == null ||
      distanceMeters(registeredLatitude, registeredLongitude, latitude, longitude) > MOVE_THRESHOLD_METERS;
    if (!moved) {
      logLocation("[location] skipped (within 500m)");
      return null;
    }

    await clientFetch("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ latitude, longitude }),
    });
    const profile = await clientFetch<UserProfile>("/users/me");
    logLocation("[location] synced");
    return profile;
  } catch {
    logLocation("[location] skipped (error)");
    return null;
  }
}
