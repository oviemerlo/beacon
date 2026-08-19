import { Alert } from "react-native";
import { REPORT_REASONS, submitReport } from "./reports";
import type { ReportTargetType } from "../types/api";

function selectReason(): Promise<(typeof REPORT_REASONS)[number]["value"] | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Report content",
      "Choose a reason.",
      [
        ...REPORT_REASONS.map((reason) => ({
          text: reason.label,
          onPress: () => resolve(reason.value),
        })),
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
  });
}

export async function pickReasonAndSubmitReport(targetType: ReportTargetType, targetId: string): Promise<void> {
  const reason = await selectReason();
  if (!reason) return;
  await submitReport({
    target_type: targetType,
    target_id: targetId,
    reason,
  });
}
