const URL_RE = /https?:\/\/[^\s<>\]\)"']+/gi;

export function stripUrls(text: string): string {
  return text.replace(URL_RE, "").replace(/\s+/g, " ").trim();
}

export function echoSharePath(broadcastId: string): string {
  return `/e/${broadcastId}`;
}

export function echoShareUrl(broadcastId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}${echoSharePath(broadcastId)}`;
}

export function echoShareTitle(displayName: string): string {
  return `${displayName} on EchoToCrowd`;
}
