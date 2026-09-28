import * as Location from "expo-location";

import type { UserProfile } from "../types/api";
import { apiFetch } from "./api";
import { distanceMeters } from "./distance";

const SYNC_INTERVAL_MS = 10 * 60 * 1000;
const MOVE_THRESHOLD_METERS = 500;
const POSITION_TIMEOUT_MS = 10_000;

let lastAttemptAt = 0;

function logLocation(message: string) {
  if (__DEV__) console.log(message);
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

export async function syncLocationIfMoved(registered: {
  latitude: number | null;
  longitude: number | null;
}): Promise<UserProfile | null> {
  try {
    const permissions = await Location.getForegroundPermissionsAsync();
    if (permissions.status !== "granted") {
      logLocation("[location] skipped (permission)");
      return null;
    }

    const now = Date.now();
    if (now - lastAttemptAt < SYNC_INTERVAL_MS) {
      logLocation("[location] skipped (throttled)");
      return null;
    }
    lastAttemptAt = now;

    const pos = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      POSITION_TIMEOUT_MS
    );
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

    await apiFetch("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ latitude, longitude }),
    });
    const profile = await apiFetch<UserProfile>("/users/me");
    logLocation("[location] synced");
    return profile;
  } catch {
    logLocation("[location] skipped (error)");
    return null;
  }
}
