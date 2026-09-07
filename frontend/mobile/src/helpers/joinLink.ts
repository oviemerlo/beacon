const JOIN_PATH_RE = /(?:^|\/)join\/([A-Za-z0-9_-]+)\/?$/;

let pendingJoinToken: string | null = null;

export function parseJoinToken(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/^\/join\/([A-Za-z0-9_-]+)\/?$/);
    if (match) return match[1];
  } catch {
    // Custom schemes like echotocrowd://join/token don't always parse as URLs.
  }
  const fallback = url.match(JOIN_PATH_RE);
  return fallback?.[1] ?? null;
}

export function setPendingJoinToken(token: string): void {
  pendingJoinToken = token;
}

export function takePendingJoinToken(): string | null {
  const token = pendingJoinToken;
  pendingJoinToken = null;
  return token;
}
