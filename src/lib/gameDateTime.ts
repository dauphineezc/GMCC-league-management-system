/** League wall-clock timezone for schedule display and comparisons. */
export const LEAGUE_TIMEZONE = "America/Detroit";

export const COMPLETION_GRACE_MINUTES = 120;

export function formatGameDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: LEAGUE_TIMEZONE,
  }).format(new Date(iso));
}

export function formatGameTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: LEAGUE_TIMEZONE,
  }).format(new Date(iso));
}

export function formatGameDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: LEAGUE_TIMEZONE,
  }).format(new Date(iso));
}

/** True only for games that are still scheduled and have not started yet. */
export function isUpcomingScheduledGame(
  g: { dateTimeISO?: string | null; status?: string | null },
  nowMs: number = Date.now()
): boolean {
  const status = String(g.status ?? "").toLowerCase();
  if (status !== "scheduled") return false;
  if (!g.dateTimeISO) return false;
  const start = new Date(g.dateTimeISO).getTime();
  return Number.isFinite(start) && start >= nowMs;
}
