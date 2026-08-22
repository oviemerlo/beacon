export function formatBroadcastSentAt(isoTimestamp: string): string {
  return formatMessageSentAt(isoTimestamp);
}

export function formatMessageSentAt(isoTimestamp: string): string {
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const dayDiff = Math.round((startOfToday - startOfDate) / 86_400_000);

  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Yesterday, ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    const weekday = date.toLocaleDateString([], { weekday: "long" });
    return `${weekday}, ${time}`;
  }

  const day = date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
  return `${day}, ${time}`;
}
