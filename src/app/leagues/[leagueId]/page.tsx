// src/app/leagues/[leagueId]/page.tsx
import { kv } from "@vercel/kv";
import Tabs from "@/components/leagueTabs";
import { DIVISIONS, type DivisionId } from "@/lib/divisions";

type Params = { leagueId: string };

export default async function LeaguePage({ params }: { params: Params }) {
  const leagueId = params.leagueId as DivisionId;

  // 1) Load everything we need from KV in parallel
  const [league, teamCards, teamIds, gamesRaw, standingsRaw] = await Promise.all([
    kv.get<any>(`league:${leagueId}`),             // { id, name, description?, schedulePdfUrl? } | null
    kv.get<any[]>(`league:${leagueId}:teams`),     // [{teamId, name, description?}] | null
    kv.get<string[]>(`league:${leagueId}:teamIds`),// [teamId] | null (fallback source of truth)
    kv.get<any[]>(`league:${leagueId}:schedule`),  // Game[] | null
    kv.get<any[]>(`league:${leagueId}:standings`), // StandingRow[] | null
  ]);

  const leagueName = DIVISIONS.find(d => d.id === leagueId)?.name ?? leagueId;
  const description = league?.description ?? "";

  // 2) Build arrays with fallbacks
  let teams: { teamId: string; name: string; description?: string }[] = teamCards ?? [];
  if ((!teams || teams.length === 0) && teamIds?.length) {
    // fallback to fetching team docs when teams list isn't there yet
    teams = await Promise.all(
      teamIds.map(async (tid) => {
        const t = await kv.get<any>(`team:${tid}`);
        return { teamId: tid, name: t?.name ?? tid, description: t?.description ?? "" };
      })
    );
  }

  const games = gamesRaw ?? [];
  const standings = standingsRaw ?? [];

  // 3) Render the page; feed arrays into Tabs
  return (
    <main style={{ padding: 24, display: "grid", gap: 16 }}>
      <h1 style={{ marginBottom: 4 }}>
        {leagueName} <span style={{ color: "#6b7280" }}>({leagueId})</span>
      </h1>
      {description && <p style={{ marginTop: 0 }}>{description}</p>}

      <Tabs
        initial="teams"
        labels={{ teams: "Teams", schedule: "Schedule", standings: "Standings" }}
        tabs={{
          teams: (
            <div>
              {teams.length === 0 ? (
                <p style={{ color: "#6b7280" }}>No teams yet.</p>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {teams.map((t) => (
                    <li key={t.teamId}>
                      <strong>{t.name}</strong>{" "}
                      {t.description && <span style={{ color: "#6b7280" }}>{t.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ),

          schedule: (
            <div>
              {games.length === 0 ? (
                <p style={{ color: "#6b7280" }}>No games scheduled.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Court</th>
                      <th style={th}>Matchup</th>
                      <th style={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((g: any) => (
                      <tr key={g.id}>
                        <td style={td}>{fmt(g.date)}</td>
                        <td style={td}>{g.court || "—"}</td>
                        <td style={td}>
                          {g.homeName ?? g.homeTeamId} vs {g.awayName ?? g.awayTeamId}
                        </td>
                        <td style={td}>
                          {g.status === "FINAL" && g.score
                            ? `FINAL ${g.score.home}-${g.score.away}`
                            : g.status || "SCHEDULED"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ),

          standings: (
            <div>
              {standings.length === 0 ? (
                <p style={{ color: "#6b7280" }}>No standings yet.</p>
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
                        <td style={td}>{s.name}</td>
                        <td style={td}>{s.wins}</td>
                        <td style={td}>{s.losses}</td>
                        <td style={td}>{s.pointsFor ?? "—"}</td>
                        <td style={td}>{s.pointsAgainst ?? "—"}</td>
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

/* ---------- tiny helpers/styles ---------- */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : "");