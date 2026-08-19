"use client";

import { useEffect, useMemo, useState } from "react";
import { distanceMeters } from "@/helpers/distance";

const LOCATION_DRIFT_THRESHOLD_METERS = 50000;
const DISMISS_KEY = "beacon.locationDrift.dismissed";

type Props = {
  registeredLatitude: number | null;
  registeredLongitude: number | null;
  onConfirmUpdate: (latitude: number, longitude: number) => Promise<void>;
};

export function LocationDriftBanner({ registeredLatitude, registeredLongitude, onConfirmUpdate }: Props) {
  const [distance, setDistance] = useState<number | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }
    if (registeredLatitude == null || registeredLongitude == null) return;
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        const drift = distanceMeters(
          registeredLatitude,
          registeredLongitude,
          pos.coords.latitude,
          pos.coords.longitude
        );
        setDistance(drift);
      },
      () => {
        setDistance(null);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }, [registeredLatitude, registeredLongitude]);

  const show = useMemo(
    () => !dismissed && distance != null && distance > LOCATION_DRIFT_THRESHOLD_METERS,
    [dismissed, distance]
  );
  if (!show || distance == null || currentCoords == null) return null;

  function dismissForSession() {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "1");
    }
    setDismissed(true);
  }

  async function confirmUpdate() {
    if (!currentCoords) return;
    setSaving(true);
    try {
      await onConfirmUpdate(currentCoords.latitude, currentCoords.longitude);
      dismissForSession();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card border-rust-400/50 bg-rust-400/10 mb-4">
      <p className="text-rust-200 text-sm">
        You seem to be about <strong>{Math.round(distance)}m</strong> from your registered location.
        Update your location for more accurate nearby results?
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={confirmUpdate}
          disabled={saving}
          className="btn-primary px-3 py-2 text-xs disabled:opacity-60"
        >
          {saving ? "Updating…" : "Update location"}
        </button>
        <button
          type="button"
          onClick={dismissForSession}
          disabled={saving}
          className="btn-secondary px-3 py-2 text-xs"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
