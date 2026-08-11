import { apiFetch } from "./api";
import type { ReportPayload, ReportReason } from "../types/api";

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "inappropriate_content", label: "Inappropriate content" },
  { value: "fake_profile", label: "Fake profile" },
  { value: "other", label: "Other" },
];

export async function submitReport(payload: ReportPayload): Promise<void> {
  await apiFetch("/reports", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
