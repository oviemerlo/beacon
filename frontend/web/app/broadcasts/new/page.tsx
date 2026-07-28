"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppNav } from "@/components/AppNav";
import { clientFetch } from "@/lib/client-api";

const RADIUS_STEPS_M = [1000, 2000, 5000, 8000, 15000, 25000, 50000];

export default function NewBroadcastPage() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [radiusIdx, setRadiusIdx] = useState(3); // 8km default
  const [matchMode, setMatchMode] = useState<"any" | "all">("any");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const radiusMeters = RADIUS_STEPS_M[radiusIdx];
  const radiusLabel = radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`;

  async function publish() {
    if (!content.trim()) return;
    setPosting(true);
    setError(null);
    try {
      // Uses the sender's own registered location as the origin point.
      // A future "choose a different point" toggle (for businesses
      // targeting a neighborhood they haven't moved into yet) reuses this
      // same radius control — just swaps where origin lat/lng comes from.
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject)
      );
      await clientFetch("/broadcasts", {
        method: "POST",
        body: JSON.stringify({
          content,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          radius_meters: radiusMeters,
          tag_match_mode: matchMode,
          tag_ids: [], // TODO: wire tag picker once GET /tags exists
        }),
      });
      router.push("/feed");
    } catch {
      setError("Couldn't post your broadcast — check location permissions and try again.");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <h1 className="font-display text-xl font-bold mb-5">New broadcast</h1>

        <div className="card">
          <textarea
            className="input-field min-h-[120px] resize-none mb-5"
            placeholder="What do you want people nearby to know?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={2000}
          />

          <label className="block text-sm font-medium mb-2">
            Reach people within <span className="text-signal-400 font-mono">{radiusLabel}</span>
          </label>
          <input
            type="range"
            min={0}
            max={RADIUS_STEPS_M.length - 1}
            value={radiusIdx}
            onChange={(e) => setRadiusIdx(Number(e.target.value))}
            className="w-full accent-signal-500 mb-6"
          />

          <label className="block text-sm font-medium mb-2">Tag matching</label>
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMatchMode("any")}
              className={`tag-pill ${matchMode === "any" ? "tag-pill-active" : ""}`}
            >
              Match any tag
            </button>
            <button
              onClick={() => setMatchMode("all")}
              className={`tag-pill ${matchMode === "all" ? "tag-pill-active" : ""}`}
            >
              Match all tags
            </button>
          </div>
          <p className="text-parchment-500 text-xs font-mono mb-6">
            TODO: tag picker grid here once GET /tags exists on the backend.
            Remember: tags boost ranking within the radius, they never
            exclude someone from seeing this broadcast.
          </p>

          {error && <p className="text-rust-400 text-sm mb-3">{error}</p>}
          <button onClick={publish} disabled={posting || !content.trim()} className="btn-primary w-full">
            {posting ? "Posting…" : "Post broadcast"}
          </button>
        </div>
      </main>
    </div>
  );
}
