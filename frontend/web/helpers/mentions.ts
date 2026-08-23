export interface MentionCandidate {
  id: string;
  username: string;
  display_name: string;
}

const MENTION_TOKEN = /@([A-Za-z0-9._-]{1,50})/g;

export function mentionQueryAtCursor(text: string, cursor: number): { start: number; query: string } | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[A-Za-z0-9_]/.test(before[at - 1] ?? "")) return null;
  const query = before.slice(at + 1);
  if (query.includes(" ") || query.includes("\n")) return null;
  return { start: at, query };
}

/** Prefer the caret, but recover when a controlled input reports cursor=0 on change. */
export function mentionTriggerFromInput(text: string, cursor: number): { start: number; query: string } | null {
  const clamped = Math.max(0, Math.min(cursor, text.length));
  const fromCursor = mentionQueryAtCursor(text, clamped);
  if (fromCursor) return fromCursor;
  if (clamped === 0 && text.length > 0) {
    return mentionQueryAtCursor(text, text.length);
  }
  return null;
}

export function applyMention(text: string, start: number, cursor: number, username: string): string {
  return `${text.slice(0, start)}@${username} ${text.slice(cursor)}`;
}

export function splitMentionParts(body: string): { text: string; mention: boolean }[] {
  const parts: { text: string; mention: boolean }[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ text: body.slice(last, index), mention: false });
    parts.push({ text: match[0], mention: true });
    last = index + match[0].length;
  }
  if (last < body.length) parts.push({ text: body.slice(last), mention: false });
  return parts.length > 0 ? parts : [{ text: body, mention: false }];
}
