import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { JoinGroupButton } from "@/components/JoinGroupButton";
import { apiFetch, ApiError, getCurrentUserOrNull } from "@/helpers/api";
import type { InvitePreview } from "@/types/api";

const FALLBACK_OG_IMAGE = "/og-share.png";

function siteOrigin(): string {
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

async function loadInvite(token: string): Promise<InvitePreview | null> {
  try {
    return await apiFetch<InvitePreview>(`/join/${token}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 422)) return null;
    throw error;
  }
}

function memberCountLabel(preview: InvitePreview): string {
  if (preview.max_participants == null) {
    return `${preview.participant_count} joined`;
  }
  return `${preview.participant_count}/${preview.max_participants} joined`;
}

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const preview = await loadInvite(params.token);
  const origin = siteOrigin();
  const image = `${origin}${FALLBACK_OG_IMAGE}`;
  if (!preview) {
    return {
      title: "This invite is no longer active — EchoToCrowd",
      openGraph: { title: "This invite is no longer active", images: [{ url: image }] },
    };
  }
  const title = preview.conversation_name || "Group chat";
  const description = preview.description || `Join this group chat · ${memberCountLabel(preview)}`;
  return {
    title: `${title} — EchoToCrowd`,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: image }],
      siteName: "EchoToCrowd",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function JoinGroupPage({ params }: { params: { token: string } }) {
  const preview = await loadInvite(params.token);
  const user = await getCurrentUserOrNull();

  return (
    <main className="min-h-screen px-6 pb-24">
      <header className="max-w-2xl mx-auto py-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 text-signal-400">
          <img src="/echotocrowd-favicon.png" alt="EchoToCrowd logo" className="h-10 w-10 rounded-md" />
          <span className="font-display text-xl font-bold tracking-tight">ECHOTOCROWD</span>
        </Link>
        <Link href={user ? "/groups" : "/login"} className="text-parchment-500 hover:text-parchment-100 text-sm transition-colors">
          {user ? "Open groups" : "Sign in"}
        </Link>
      </header>

      <article className="max-w-2xl mx-auto">
        {!preview ? (
          <div className="card text-center py-10">
            <p className="font-medium">This invite is no longer active</p>
            <p className="text-parchment-500 text-sm mt-2">
              The link may have been revoked, or this group may no longer exist.
            </p>
          </div>
        ) : (
          <div className="card">
            <p className="text-parchment-100 text-lg font-semibold">{preview.conversation_name || "Group chat"}</p>
            {preview.description && (
              <p className="text-parchment-300 text-sm mt-2">{preview.description}</p>
            )}
            <p className="text-parchment-500 text-sm mt-3">{memberCountLabel(preview)}</p>
            <JoinGroupButton token={params.token} loggedIn={Boolean(user)} isFull={preview.is_full} />
            {!user && !preview.is_full && (
              <p className="text-parchment-500 text-xs text-center mt-3">
                You&apos;ll sign in first, then return here to join.
              </p>
            )}
          </div>
        )}
      </article>
    </main>
  );
}
