/**
 * Reads the `exp` claim out of a JWT without verifying its signature.
 * This is NOT a security check — the backend verifies every request
 * independently regardless of what this says. It's purely a cheap,
 * local way to decide "is it worth sending this token, or should we
 * refresh first" without making a network round-trip to find out.
 */
export function isJwtExpired(token: string, skewSeconds = 10): boolean {
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(Buffer.from(payload, "base64").toString("utf-8"));
    if (typeof decoded.exp !== "number") return true;
    return Date.now() / 1000 > decoded.exp - skewSeconds;
  } catch {
    return true;
  }
}
