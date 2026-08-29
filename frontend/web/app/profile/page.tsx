import { apiFetch, getCurrentUserOrNull } from "@/helpers/api";
import { AppNav } from "@/components/AppNav";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { echoAudienceLabels } from "@/helpers/tags";
import type { BlockedUsersList } from "@/types/api";

export default async function ProfilePage() {
  async function updateDisplayName(formData: FormData) {
    "use server";
    const displayName = String(formData.get("display_name") ?? "").trim();
    if (!displayName) return;

    await apiFetch("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ display_name: displayName }),
    });
    revalidatePath("/profile");
  }

  const user = await getCurrentUserOrNull();
  if (!user) redirect("/login");

  let blockedCount = 0;
  try {
    const blocked = await apiFetch<BlockedUsersList>("/blocks");
    blockedCount = blocked.blocked_users.length;
  } catch {
    blockedCount = 0;
  }

  const audienceLabels = echoAudienceLabels(user.tags, user.course_codes);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-2xl mx-auto px-5 py-6">
        <h1 className="font-display text-xl font-bold mb-5">Your profile</h1>

        <div className="card mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold">{user.display_name}</p>
              <p className="text-parchment-500 text-sm font-mono">@{user.username}</p>
              {typeof user.age === "number" && <p className="text-parchment-500 text-sm mt-2">{user.age} years old</p>}
              {user.location_label && <p className="text-parchment-500 text-sm mt-2">{user.location_label}</p>}
            </div>
            <ProfileAvatar fileId={user.avatar_file_id} scanStatus={user.avatar_scan_status} />
          </div>
        </div>

        <form action={updateDisplayName} className="card mb-4">
          <p className="font-medium mb-2">Display name</p>
          <input
            type="text"
            name="display_name"
            defaultValue={user.display_name}
            required
            minLength={1}
            maxLength={100}
            className="input-field mb-3"
          />
          <button type="submit" className="btn-primary w-full">
            Save name
          </button>
        </form>

        <div className="card mb-4">
          <p className="font-medium mb-2">Tags</p>
          <Link href="/follow-tags" className="inline-block text-sm text-signal-400 hover:text-signal-300 mb-3">
            Echo Tags
          </Link>
          {audienceLabels.length === 0 ? (
            <p className="text-parchment-500 text-sm">No tags yet.</p>
          ) : (
            <>
              <p className="text-parchment-500 text-sm mb-2">
                {audienceLabels.length} selected
              </p>
              <div className="flex flex-wrap gap-2">
                {audienceLabels.map((label) => (
                  <span key={label} className="tag-pill">{label}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="card mb-4">
          <p className="font-medium mb-2">Blocked users</p>
          <Link href="/blocked-users" className="inline-block text-sm text-signal-400 hover:text-signal-300 mb-3">
            Manage
          </Link>
          <p className="text-parchment-500 text-sm">{blockedCount} blocked</p>
        </div>

        <div className="card">
          <p className="font-medium">Discoverable in broadcasts</p>
          <p className="text-parchment-500 text-sm mt-1">
            Controls whether you're counted in aggregate "people near you" stats — like the weekly
            digest — for others who share your tags. This never exposes your identity individually.
          </p>
          <p className="text-parchment-500 text-xs font-mono mt-3">
            Current: {user.discoverable_in_broadcasts ? "On" : "Off"} — TODO: wire toggle to PATCH /users/me
          </p>
        </div>

        {user.is_admin && (
          <div className="card mt-4">
            <p className="font-medium mb-2">Moderation</p>
            <Link href="/admin/reports" className="inline-block text-sm text-signal-400 hover:text-signal-300">
              Open admin reports queue
            </Link>
          </div>
        )}

        <form action="/auth/logout" method="post" className="mt-4">
          <button type="submit" className="btn-secondary w-full border border-rust-400 text-rust-400 hover:text-rust-300">
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
