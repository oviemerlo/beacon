const URL_RE = /https?:\/\/[^\s<>\]\)"']+/gi;

export function stripUrls(text: string): string {
  return text.replace(URL_RE, "").replace(/\s+/g, " ").trim();
}
