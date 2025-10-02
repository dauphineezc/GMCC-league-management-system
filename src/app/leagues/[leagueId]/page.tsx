// /src/app/leagues/[leagueId]/page.tsx
export const dynamic = "force-dynamic";
export const dynamicParams = true;

import { kv } from "@vercel/kv";
import Tabs from "@/components/leagueTabs";
import ScheduleViewer from "@/components/scheduleViewer";
import GameHistory from "@/components/gameHistory";
import { DIVISIONS } from "@/lib/divisions";
import { absoluteUrl } from "@/lib/absoluteUrl";

/* ---------- tolerant helpers ---------- */

// Read a SET safely → array of strings. Never throws on WRONGTYPE.
async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers(key)) as unknown;
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  } catch {
    /* ignore */
  }
  return [];
}

// Read a league doc: prefer hash (authoritative), then GET object
async function readLeagueDoc(leagueId: string): Promise<Record<string, any> | null> {
  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, any> | null;
    if (h && typeof h === "object" && Object.keys(h).length) return h;
  } catch {
    /* ignore */
  }
  try {
    const g = (await kv.get(`league:${leagueId}`)) as any;
    if (g && typeof g === "object") return g as Record<string, any>;
  } catch {
    /* ignore */
  }
  return null;
}

export async function generateStaticParams() {
  const ids = await smembersSafe("leagues:index");
  return ids.map((leagueId) => ({ leagueId }));
}

/* ---------- API helpers ---------- */

async function fetchGames(leagueId: string) {
  const url = absoluteUrl(`/api/leagues/${leagueId}/schedule`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

async function fetchStandings(leagueId: string) {
  const url = absoluteUrl(`/api/leagues/${leagueId}/standings`);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json().catch(() => []);
  return Array.isArray(data) ? data : [];
}

/* ---------- tiny display formatter for schedule rows ---------- */
function toDisplay(g: any) {
  const iso = g?.dateTimeISO ?? g?.date ?? g?.startTimeISO ?? g?.start ?? null;
  const dateText = iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";
  const timeText = iso ? new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
  const court = g?.location ?? g?.court ?? g?.venue ?? "—";
  const home = g?.homeTeamName ?? g?.homeName ?? g?.home ?? g?.homeTeamId ?? "";
  const away = g?.awayTeamName ?? g?.awayName ?? g?.away ?? g?.awayTeamId ?? "";
  const statusRaw = String(g?.status ?? "scheduled").toLowerCase();
  const status =
    statusRaw === "final" && g?.homeScore != null && g?.awayScore != null
      ? `final: ${g.homeScore}-${g.awayScore}`
      : statusRaw;
  return { dateText, timeText, court, home, away, status };
}

/* ---------- Page ---------- */

export default async function LeaguePage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;

  // league doc + schedule + standings in parallel
  const [leagueDoc, games, standings] = await Promise.all([
    readLeagueDoc(leagueId),
    fetchGames(leagueId),
    fetchStandings(leagueId),
  ]);

  // Prefer stored name; fallback to divisions mapping; then id
  const leagueName =
    (leagueDoc?.name && String(leagueDoc.name)) ||
    DIVISIONS.find((d) => d.id === leagueId)?.name ||
    leagueId;

  const description = leagueDoc?.description ?? "";

  // Teams are now a SET at league:{leagueId}:teams
  const teamIds = await smembersSafe(`league:${leagueId}:teams`);
  const teams: { teamId: string; name: string; description?: string }[] = await Promise.all(
    teamIds.map(async (tid) => {
      const t = (await kv.get<any>(`team:${tid}`)) || null;
      return { teamId: tid, name: t?.name ?? tid, description: t?.description ?? "" };
    })
  );

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{leagueName}</h1>
        </div>
      </header>

      {description && <section className="team-desc card--soft">{description}</section>}

      <Tabs
        initial="teams"
        labels={{ teams: "Teams", schedule: "Schedule", history: "Game History", standings: "Standings" }}
        tabs={{
          teams: (
            <div className="roster-gradient">
              {teams.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No teams yet.
                </p>
              ) : (
                <ul className="roster-list">
                  {teams.map((t) => (
                    <li key={t.teamId}>
                      <div
                        className="player-card"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 12,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-sport), var(--font-body), system-ui",
                            fontWeight: 500,
                            letterSpacing: ".3px",
                            fontSize: 24,
                          }}
                        >
                          {t.name}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),

          schedule: (
            <div>
              {/* If ScheduleViewer already fetches its own data, you can remove fetchGames above */}
              <ScheduleViewer leagueId={leagueId} />
            </div>
          ),

          history: (
            <div>
              <GameHistory leagueId={leagueId} />
            </div>
          ),

          standings: (
            <div>
              {standings.length === 0 ? (
                <p className="muted">No standings yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Team</th>
                      <th style={th}>Wins</th>
                      <th style={th}>Losses</th>
                      <th style={th}>Points For</th>
                      <th style={th}>Points Against</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standings.map((s: any) => (
                      <tr key={s.teamId}>
                        <td style={td}>{s.teamName || s.name || s.teamId}</td>
                        <td style={td}>{s.gamesPlayed > 0 ? s.wins : "--"}</td>
                        <td style={td}>{s.gamesPlayed > 0 ? s.losses : "--"}</td>
                        <td style={td}>{s.gamesPlayed > 0 ? s.pointsFor : "--"}</td>
                        <td style={td}>{s.gamesPlayed > 0 ? s.pointsAgainst : "--"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ),
        }}
      />
    </main>
  );
}

/* helpers for the standings table */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };