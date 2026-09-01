import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { EchoBody } from "@/components/EchoBody";
import { SignalPing } from "@/components/SignalPing";
import { VerifiedMark } from "@/components/VerifiedMark";
import { apiFetch, ApiError, getCurrentUserOrNull } from "@/helpers/api";
import { echoShareTitle } from "@/helpers/share";
import { displayTagLabel, echoAudienceLabels } from "@/helpers/tags";
import { echoPreview, formatBroadcastSentAt } from "@/helpers/time";
import type { PublicBroadcast } from "@/types/api";

const FALLBACK_OG_IMAGE = "/og-share.png";

function siteOrigin(): string {
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function loadEcho(id: string): Promise<PublicBroadcast | null> {
  try {
    return await apiFetch<PublicBroadcast>(`/public/echoes/${id}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const echo = await loadEcho(params.id);
  if (!echo) {
    return { title: "Echo not found — EchoToCrowd" };
  }
  const title = echoShareTitle(echo.sender.display_name);
  const description = echoPreview(echo.content, 160);
  const origin = siteOrigin();
  const image = echo.og_image_url || `${origin}${FALLBACK_OG_IMAGE}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images: [{ url: image }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function PublicEchoPage({ params }: { params: { id: string } }) {
  const echo = await loadEcho(params.id);
  if (!echo) notFound();

  const user = await getCurrentUserOrNull();
  const ctaHref = user ? `/broadcasts/${echo.id}` : "/login";
  const ctaLabel = user ? "View full thread" : "Join to view the thread";
  const audienceLabels = echoAudienceLabels(echo.tags);

  return (
    <main className="min-h-screen px-6 pb-24">
      <header className="max-w-2xl mx-auto py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-signal-400">
          <img src="/echotocrowd-favicon.png" alt="EchoToCrowd logo" className="h-10 w-10 rounded-md" />
          <span className="font-display text-xl font-bold tracking-tight">ECHOTOCROWD</span>
        </Link>
        <Link href={user ? "/feed" : "/login"} className="text-parchment-500 hover:text-parchment-100 text-sm transition-colors">
          {user ? "Open feed" : "Sign in"}
        </Link>
      </header>

      <article className="max-w-2xl mx-auto">
        <div className="mb-4 flex items-center gap-2 text-signal-400 font-mono text-xs uppercase tracking-widest">
          <SignalPing size={8} />
          <span>Shared Echo</span>
        </div>
        <div className="card">
          <p className="text-parchment-100 text-base font-semibold inline-flex items-center gap-2">
            {echo.sender.display_name}
            <VerifiedMark verified={echo.sender.is_verified} />
          </p>
          {audienceLabels.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {audienceLabels.map((label) => (
                <span key={label} className="tag-pill">
                  {displayTagLabel(label)}
                </span>
              ))}
            </div>
          )}
          <EchoBody className="text-parchment-100 text-base font-normal leading-snug mt-3">
            {echo.content}
          </EchoBody>
          <p className="text-parchment-500 text-xs font-mono mt-4">{formatBroadcastSentAt(echo.created_at)}</p>
          <Link href={ctaHref} className="btn-primary w-full inline-block text-center mt-5">
            {ctaLabel}
          </Link>
          {!user && (
            <p className="text-parchment-500 text-xs text-center mt-3">
              New here?{" "}
              <Link href="/onboarding" className="text-signal-400 hover:text-signal-300">
                Create an account
              </Link>{" "}
              to reply and see the full thread.
            </p>
          )}
        </div>
      </article>
    </main>
  );
}
