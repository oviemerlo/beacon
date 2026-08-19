"use client";

import { REPORT_REASONS, submitReport } from "@/helpers/reports";
import type { ReportReason, ReportTargetType } from "@/types/api";

export async function promptAndSubmitReport(targetType: ReportTargetType, targetId: string, targetLabel: string): Promise<void> {
  const reasonInput = window.prompt(
    `Report ${targetLabel}\nReason (${REPORT_REASONS.map((item) => item.value).join(", ")}):`,
    "harassment"
  );
  if (!reasonInput) return;
  const normalizedReason = reasonInput.trim().toLowerCase() as ReportReason;
  const reasonIsValid = REPORT_REASONS.some((item) => item.value === normalizedReason);
  if (!reasonIsValid) {
    window.alert("Invalid reason.");
    return;
  }

  const details = window.prompt("Additional details (optional):")?.trim();
  await submitReport({
    target_type: targetType,
    target_id: targetId,
    reason: normalizedReason,
    details: details || undefined,
  });
}
