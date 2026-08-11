export type ReachCategory = "local" | "regional" | "global";

export const LOCAL_RADIUS_STEPS_M = [100, 250, 500, 1000, 2000, 3000, 5000] as const;
export const REGIONAL_RADIUS_STEPS_M = [5000, 8000, 15000, 25000, 50000] as const;

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
  if ((radiusMeters ?? 0) >= 5000) return "Regional";
  return "Local";
}
