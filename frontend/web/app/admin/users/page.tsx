import { AppNav } from "@/components/AppNav";
import { apiFetch, getCurrentUserOrNull } from "@/helpers/api";
import type { AdminUser } from "@/types/api";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";

async function toggleAdminAction(formData: FormData) {
  "use server";
  const userId = String(formData.get("user_id") ?? "");
  const currentlyAdmin = String(formData.get("currently_admin") ?? "") === "true";
  if (!userId) return;

  await apiFetch(`/admin/users/${userId}/admin`, {
    method: "PATCH",
    body: JSON.stringify({ is_admin: !currentlyAdmin }),
  });
  revalidatePath("/admin/users");
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await getCurrentUserOrNull();
  if (!user) redirect("/login");
  if (!user.is_admin) redirect("/feed");

  const q = searchParams.q?.trim() ?? "";
  const users = await apiFetch<AdminUser[]>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`);

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-3xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h1 className="font-display text-xl font-bold">Manage admins</h1>
          <Link href="/admin/reports" className="text-sm text-signal-400 hover:text-signal-300">
            Admin reports
          </Link>
        </div>

        <form className="card mb-6 flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            name="q"
            defaultValue={q}
            placeholder="Search by email to grant admin"
            className="input-field"
          />
          <button type="submit" className="btn-secondary shrink-0">
            Search
          </button>
        </form>

        {users.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium">{q ? "No user with that email." : "No admins yet."}</p>
            <p className="text-parchment-500 text-sm mt-1">
              {q ? "Check the address and try again." : "Search an email to grant admin access."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {users.map((row) => {
              const isSelf = row.id === user.id;
              return (
                <div key={row.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{row.display_name}</p>
                      <p className="text-sm text-parchment-500">{row.email || row.username}</p>
                      <p className="text-xs font-mono text-parchment-500 mt-1">@{row.username}</p>
                    </div>
                    {row.is_admin && (
                      <span className="tag-pill tag-pill-active shrink-0">Admin</span>
                    )}
                  </div>
                  <form action={toggleAdminAction} className="mt-4">
                    <input type="hidden" name="user_id" value={row.id} />
                    <input type="hidden" name="currently_admin" value={row.is_admin ? "true" : "false"} />
                    <button
                      type="submit"
                      className={row.is_admin ? "btn-secondary" : "btn-primary"}
                      disabled={isSelf && row.is_admin}
                    >
                      {row.is_admin ? "Remove admin" : "Make admin"}
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
