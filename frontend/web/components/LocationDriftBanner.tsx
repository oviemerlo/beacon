"use client";

import { useEffect, useState } from "react";

import { clientFetch } from "@/helpers/client-api";
import { geolocationPermission, syncLocationIfMoved } from "@/helpers/locationSync";
import type { UserProfile } from "@/types/api";

const DISMISS_KEY = "beacon.locationDrift.dismissed";

type Props = {
  registeredLatitude: number | null;
  registeredLongitude: number | null;
  onProfile: (profile: UserProfile) => void;
};

export function LocationDriftBanner({ registeredLatitude, registeredLongitude, onProfile }: Props) {
  const [needsPermission, setNeedsPermission] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && sessionStorage.getItem(DISMISS_KEY) === "1") {
      setDismissed(true);
      return;
    }

    let active = true;
    async function check() {
      const permission = await geolocationPermission();
      if (!active) return;
      setNeedsPermission(permission !== "granted");
    }

    void check();
    function onVisible() {
      if (document.visibilityState === "visible") void check();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (dismissed || !needsPermission) return null;

  function dismissForSession() {
    if (typeof window !== "undefined") sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  function enableLocation() {
    if (!navigator.geolocation) return;
    setSaving(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          setNeedsPermission(false);
          const profile = await syncLocationIfMoved({
            latitude: registeredLatitude,
            longitude: registeredLongitude,
          });
          if (profile) {
            onProfile(profile);
            return;
          }
          // Browsers that hide the Permissions API still need this click to save the fix.
          if ((await geolocationPermission()) === "unknown") {
            await clientFetch("/users/me", {
              method: "PATCH",
              body: JSON.stringify({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
            });
            onProfile(await clientFetch<UserProfile>("/users/me"));
          }
        } finally {
          setSaving(false);
        }
      },
      () => setSaving(false),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="card border-rust-400/50 bg-rust-400/10 mb-4">
      <p className="text-parchment-100 text-sm">Turn on location to see echoes near you.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={enableLocation} disabled={saving} className="btn-primary px-3 py-2 text-xs disabled:opacity-60">
          {saving ? "Updating…" : "Turn on location"}
        </button>
        <button type="button" onClick={dismissForSession} disabled={saving} className="btn-secondary px-3 py-2 text-xs">
          Not now
        </button>
      </div>
    </div>
  );
}
