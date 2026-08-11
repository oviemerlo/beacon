import { AppNav } from "@/components/AppNav";
import { apiFetch, getCurrentUserOrNull } from "@/lib/api";
import { reasonLabel } from "@/lib/reports";
import type { AdminStats, ReportQueueItem } from "@/types/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function resolveReportAction(formData: FormData) {
  "use server";
  const reportId = String(formData.get("report_id") ?? "");
  const action = String(formData.get("action") ?? "");
  const notes = String(formData.get("resolution_notes") ?? "").trim();
  if (!reportId || (action !== "dismiss" && action !== "suspend_user")) return;

  await apiFetch(`/reports/${reportId}/resolve`, {
    method: "POST",
    body: JSON.stringify({
      action,
      resolution_notes: notes || undefined,
    }),
  });
  revalidatePath("/admin/reports");
}

export default async function AdminReportsPage() {
  const user = await getCurrentUserOrNull();
  if (!user) redirect("/login");
  if (!user.is_admin) redirect("/feed");

  const stats = await apiFetch<AdminStats>("/admin/stats");
  const reports = await apiFetch<ReportQueueItem[]>("/reports?status=pending&limit=100");

  return (
    <div className="min-h-screen">
      <AppNav />
      <main className="max-w-3xl mx-auto px-5 py-6">
        <h1 className="font-display text-xl font-bold mb-5">Admin reports</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <div className="card">
            <p className="text-parchment-500 text-xs font-mono">Total users</p>
            <p className="font-display text-2xl font-bold mt-1">{stats.total_users.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-parchment-500 text-xs font-mono">New users (7d)</p>
            <p className="font-display text-2xl font-bold mt-1">{stats.new_users_7d.toLocaleString()}</p>
          </div>
          <div className="card">
            <p className="text-parchment-500 text-xs font-mono">Suspended users</p>
            <p className="font-display text-2xl font-bold mt-1">{stats.total_suspended_users.toLocaleString()}</p>
          </div>
        </div>

        {reports.length === 0 ? (
          <div className="card text-center py-10">
            <p className="font-medium">No pending reports.</p>
            <p className="text-parchment-500 text-sm mt-1">The moderation queue is clear.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {reports.map((report) => (
              <div key={report.id} className="card">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{reasonLabel(report.reason)}</p>
                  <p className="text-xs font-mono text-parchment-500">{new Date(report.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm text-parchment-500 mt-1">
                  Reporter: {report.reporter.display_name} ({report.reporter.username})
                </p>
                <p className="text-sm text-parchment-500">
                  Target: {report.target_type} {report.target_id}
                </p>
                {report.details && <p className="text-sm mt-3">{report.details}</p>}
                {!report.details && <p className="text-sm mt-3 text-parchment-500">No additional details provided.</p>}

                <form action={resolveReportAction} className="mt-4 flex flex-col gap-2">
                  <input type="hidden" name="report_id" value={report.id} />
                  <input
                    type="text"
                    name="resolution_notes"
                    maxLength={2000}
                    placeholder="Resolution notes (optional)"
                    className="input-field"
                  />
                  <div className="flex gap-2">
                    <button type="submit" name="action" value="dismiss" className="btn-secondary">
                      Dismiss
                    </button>
                    <button type="submit" name="action" value="suspend_user" className="btn-primary">
                      Suspend user
                    </button>
                  </div>
                </form>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
