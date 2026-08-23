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
