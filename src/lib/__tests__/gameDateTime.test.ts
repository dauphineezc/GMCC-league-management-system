import {
  COMPLETION_GRACE_MINUTES,
  formatGameDate,
  formatGameDateTime,
  formatGameTime,
  isUpcomingScheduledGame,
  LEAGUE_TIMEZONE,
} from "@/lib/gameDateTime";

describe("gameDateTime", () => {
  it("formats in America/Detroit regardless of host timezone", () => {
    // 2025-10-18 17:00 UTC = 1:00 PM EDT
    const iso = "2025-10-18T17:00:00.000Z";
    expect(formatGameTime(iso)).toMatch(/1:00\s*PM/i);
    expect(formatGameDate(iso)).toMatch(/Oct\s*18/i);
    expect(formatGameDateTime(iso)).toMatch(/Oct\s*18/i);
    expect(formatGameDateTime(iso)).toMatch(/1:00\s*PM/i);
    expect(LEAGUE_TIMEZONE).toBe("America/Detroit");
  });

  it("only treats future scheduled games as upcoming", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const past = new Date(Date.now() - 60_000).toISOString();

    expect(isUpcomingScheduledGame({ dateTimeISO: future, status: "scheduled" })).toBe(true);
    expect(isUpcomingScheduledGame({ dateTimeISO: past, status: "scheduled" })).toBe(false);
    expect(isUpcomingScheduledGame({ dateTimeISO: future, status: "completed" })).toBe(false);
    expect(isUpcomingScheduledGame({ dateTimeISO: future, status: "final" })).toBe(false);
    expect(COMPLETION_GRACE_MINUTES).toBe(120);
  });
});
