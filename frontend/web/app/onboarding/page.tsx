"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/client-api";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"location" | "tags">("location");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [locError, setLocError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function requestLocation() {
    setLocError(null);
    if (!navigator.geolocation) {
      setLocError("Location isn't available in this browser — enter your area manually below.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setLocError("Location permission was denied — enter your area manually below.")
    );
  }

  async function saveLocationAndContinue() {
    if (!coords) {
      setLocError("Set your location to continue — this is what broadcasts near you are measured against.");
      return;
    }
    setSubmitting(true);
    try {
      await clientFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ latitude: coords.lat, longitude: coords.lng, location_label: locationLabel || undefined }),
      });
      setStep("tags");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="card w-full max-w-md">
        {step === "location" ? (
          <>
            <h1 className="font-display text-xl font-bold">Where are you based?</h1>
            <p className="text-parchment-500 text-sm mt-2 mb-5">
              This sets what broadcasts can reach your feed. It's never shown to other users directly.
            </p>
            <button onClick={requestLocation} className="btn-secondary w-full mb-3">
              {coords ? "Location set ✓" : "Share my location"}
            </button>
            <input
              className="input-field mb-2"
              placeholder="Neighborhood or city (optional label)"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
            />
            {locError && <p className="text-rust-400 text-sm mt-2">{locError}</p>}
            <button onClick={saveLocationAndContinue} disabled={submitting} className="btn-primary w-full mt-5">
              {submitting ? "Saving…" : "Continue"}
            </button>
          </>
        ) : (
          <TagStep onDone={() => router.replace("/feed")} />
        )}
      </div>
    </main>
  );
}

function TagStep({ onDone }: { onDone: () => void }) {
  // Barebone: in the full build, fetch /tags (a new lightweight backend
  // endpoint, not yet in the API) and render checkboxes grouped by type.
  // Scaffolded here as a static example set + free continue.
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    try {
      await clientFetch("/users/me", { method: "PATCH", body: JSON.stringify({}) });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <h1 className="font-display text-xl font-bold">What describes you?</h1>
      <p className="text-parchment-500 text-sm mt-2 mb-5">
        Tags boost what shows up first in your feed — they never restrict who can see your broadcasts.
      </p>
      <p className="text-parchment-500 text-xs font-mono mb-4">
        TODO: wire to GET /tags once that endpoint exists — render as selectable tag-pill grid
        (nationality tags + hobby tags), POST selected IDs via PATCH /users/me.
      </p>
      <button onClick={finish} disabled={saving} className="btn-primary w-full">
        {saving ? "Saving…" : "Finish setup"}
      </button>
    </>
  );
}
