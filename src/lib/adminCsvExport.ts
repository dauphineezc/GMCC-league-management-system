import { NextResponse } from "next/server";
import { toCsv, yyyymmdd } from "@/lib/csv";
import { getLeagueScheduleView } from "@/lib/leagueData";
import { getSchedulePdfInfo } from "@/lib/repositories/schedulePdfsRepo";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

/** True when a schedule PDF exists and there are no structured game rows. */
export async function isLeagueSchedulePdfOnly(leagueId: string): Promise<boolean> {
  const [pdf, games] = await Promise.all([
    getSchedulePdfInfo(leagueId),
    getLeagueScheduleView(leagueId),
  ]);
  return !!pdf && games.length === 0;
}

export function csvDownloadRedirect(kind: "login" | "denied") {
  const path = kind === "login" ? "/login" : "/";
  return NextResponse.redirect(new URL(path, SITE()));
}

export function csvAttachment(
  filenameBase: string,
  headers: string[],
  rows: Array<Record<string, unknown>>
) {
  const csv = toCsv(rows, headers);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename=${filenameBase}-${yyyymmdd()}.csv`,
    },
  });
}

function formatSetScores(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "";
  return raw
    .map((s: any) => {
      const h = s?.homeScore ?? s?.home;
      const a = s?.awayScore ?? s?.away;
      if (h == null || a == null) return "";
      return `${h}-${a}`;
    })
    .filter(Boolean)
    .join("; ");
}

export function gameToCsvRow(g: {
  id?: string;
  dateTimeISO?: string | null;
  location?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  status?: string;
  homeScore?: number | null;
  awayScore?: number | null;
  setScores?: unknown;
}) {
  return {
    gameId: g.id ?? "",
    dateTimeISO: g.dateTimeISO ?? "",
    location: g.location ?? "",
    homeTeamId: g.homeTeamId ?? "",
    homeTeamName: g.homeTeamName ?? "",
    awayTeamId: g.awayTeamId ?? "",
    awayTeamName: g.awayTeamName ?? "",
    status: g.status ?? "",
    homeScore: g.homeScore ?? "",
    awayScore: g.awayScore ?? "",
    setScores: formatSetScores(g.setScores),
  };
}

export const GAME_CSV_HEADERS = [
  "gameId",
  "dateTimeISO",
  "location",
  "homeTeamId",
  "homeTeamName",
  "awayTeamId",
  "awayTeamName",
  "status",
  "homeScore",
  "awayScore",
  "setScores",
];

export function isHistoryStatus(status: string) {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "final";
}

export function isScheduleStatus(status: string) {
  return (status || "").toLowerCase() === "scheduled";
}
