const SESSION_PREFIX = "mindbloom-session-";

export function getDateFromSessionId(sessionId: string): string | null {
  if (!sessionId.startsWith(SESSION_PREFIX)) {
    return null;
  }

  const date = sessionId.slice(SESSION_PREFIX.length);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function formatDate(date: string, options?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  }).format(new Date(`${date}T12:00:00`));
}

export function getRecentDateStamps(days = 35): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(date.toISOString().split("T")[0] ?? "");
  }

  return dates;
}
