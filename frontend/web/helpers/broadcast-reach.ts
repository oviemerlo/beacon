export type ReachCategory = "local" | "regional" | "global";

export const LOCAL_MAX_RADIUS_M = 10_000;
export const REGIONAL_MAX_RADIUS_M = 100_000;
export const LOCAL_RADIUS_STEPS_M = [100, 250, 500, 1000, 2000, 3000, 5000, 8000, 10_000] as const;
export const REGIONAL_RADIUS_STEPS_M = [15_000, 25_000, 40_000, 50_000, 75_000, 100_000] as const;

export function radiusLabel(radiusMeters: number): string {
  return radiusMeters >= 1000 ? `${radiusMeters / 1000} km` : `${radiusMeters} m`;
}

export function buildReachPayload(
  reach: ReachCategory,
  radiusMeters: number
): { is_global: true; radius_meters?: never } | { is_global: false; radius_meters: number } {
  if (reach === "global") {
    return { is_global: true };
  }
  return { is_global: false, radius_meters: radiusMeters };
}

export function reachBadgeLabel(isGlobal: boolean, radiusMeters: number | null): "Global" | "Regional" | "Local" {
  if (isGlobal) return "Global";
  if ((radiusMeters ?? 0) > LOCAL_MAX_RADIUS_M) return "Regional";
  return "Local";
}

export function reachCategory(isGlobal: boolean, radiusMeters: number | null): ReachCategory {
  if (isGlobal) return "global";
  if ((radiusMeters ?? 0) > LOCAL_MAX_RADIUS_M) return "regional";
  return "local";
}

/** Muted fills for dark cards: Local cool, Regional pale (not brand amber), Global dusk purple. */
export const REACH_BADGE_COLORS: Record<ReachCategory, { backgroundColor: string; borderColor: string; color: string }> = {
  local: { backgroundColor: "#C9DFF0", borderColor: "#9EC4DC", color: "#1A2A3A" },
  regional: { backgroundColor: "#F6D9B5", borderColor: "#E5C08A", color: "#2A1F12" },
  global: { backgroundColor: "#5B4A82", borderColor: "#6D5B96", color: "#F5F2EA" },
};

export function reachBadgeColors(isGlobal: boolean, radiusMeters: number | null) {
  return REACH_BADGE_COLORS[reachCategory(isGlobal, radiusMeters)];
}

export function reachSelectorColors(category: ReachCategory, selected: boolean, disabled = false) {
  return {
    ...REACH_BADGE_COLORS[category],
    opacity: disabled ? 0.4 : selected ? 1 : 0.5,
  };
}

export const REGIONAL_REACH_LOCKED_MESSAGE =
  "Up to 100 km reach is available on Campus, Connect, and Amplify. Free accounts can send Local echoes.";

export function canUseRegionalReach(
  isVerified: boolean,
  isAdmin = false,
  accountType: "individual" | "business" = "individual"
): boolean {
  return isAdmin || isVerified || accountType === "business";
}
