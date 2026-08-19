export function extractErrorMessage(rawBody: string, fallback: string): string {
  try {
    const parsed = JSON.parse(rawBody) as { detail?: unknown };
    if (typeof parsed.detail === "string" && parsed.detail.trim()) {
      return parsed.detail;
    }
    if (parsed.detail !== undefined) {
      return JSON.stringify(parsed.detail);
    }
  } catch {
    // Non-JSON response; fall back to plain text/status below.
  }
  return rawBody || fallback;
}
