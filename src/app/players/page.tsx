// Players Page (Superadmin Only)
export const runtime = "nodejs";
export const revalidate = 30;

import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import SuperPlayerList from "@/components/superPlayerList";
import type { PlayerTeam, RosterRow } from "@/types/domain";
import type { CSSProperties } from "react";
import { smembersSafe, readDoc } from "@/lib/kvHelpers";
import { batchGetTeams, batchGetRosters, batchGetPayments } from "@/lib/kvBatch";
import { exportHref } from "@/lib/csv";

const CANONICAL_SPORTS = ["basketball", "volleyball"] as const;
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function normalizeSport(v: unknown) {
  const s = norm(v).replace(/\s+/g, "");
  if (!s) return null;
  if (/(basket|bball)/.test(s)) return "basketball";
  if (/(volley|vball)/.test(s)) return "volleyball";
  return s;
}

type SearchParams = {
  displayName?: string;
  sport?: string;
  league?: string;
};

type LeagueOption = { leagueId: string; name: string; sport: string | null };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) notFound();

  const [teamIds, leagueIds] = await Promise.all([
    smembersSafe("teams:index"),
    smembersSafe("leagues:index"),
  ]);

  const [teamsMap, rostersMap, paymentsMap, leagueDocs] = await Promise.all([
    batchGetTeams(teamIds),
    batchGetRosters(teamIds),
    batchGetPayments(teamIds),
    Promise.all(
      leagueIds.map(async (id) => {
        const L = await readDoc<Record<string, any>>(`league:${id}`);
        return {
          leagueId: id,
          name: String(L?.name ?? id),
          sport: normalizeSport(L?.sport),
        } as LeagueOption;
      })
    ),
  ]);

  const leagues = leagueDocs.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  const leagueById = new Map(leagues.map((l) => [l.leagueId, l]));

  const roster: RosterRow[] = [];
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};
  /** sport keyed by membership for filtering (not shown in list UI) */
  const membershipSport = new Map<string, string | null>();

  for (const teamId of teamIds) {
    const team = teamsMap.get(`team:${teamId}`) as Record<string, unknown> | null | undefined;
    if (!team) continue;

    const teamName = (team.name as string | undefined) ?? teamId;
    const leagueId = (team.leagueId as string | undefined) ?? undefined;
    const league = leagueId ? leagueById.get(leagueId) : undefined;
    const sport = normalizeSport(team.sport) ?? league?.sport ?? null;
    const teamRoster = rostersMap.get(teamId) ?? [];
    const payments = paymentsMap.get(teamId) ?? {};

    for (const r of teamRoster) {
      const paid = Boolean(payments[r.userId]);
      const membershipKey = `${r.userId}:${teamId}`;
      membershipSport.set(membershipKey, sport);

      roster.push({
        userId: r.userId,
        displayName: r.displayName,
        isManager: Boolean(r.isManager),
        paid,
        teamId,
        teamName,
        leagueId,
        leagueName: league?.name,
      });

      const bucket = (playerTeamsByUser[r.userId] ||= []);
      bucket.push({
        teamId,
        leagueId,
        leagueName: league?.name,
        teamName,
        isManager: Boolean(r.isManager),
        paid,
      });
    }
  }

  roster.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const q = (searchParams.displayName ?? "").trim().toLowerCase();
  const sportFilter = normalizeSport(searchParams.sport ?? "");
  const leagueFilter = String(searchParams.league ?? "");

  const filteredRows = roster.filter((r) => {
    if (q && !r.displayName.toLowerCase().includes(q)) return false;
    if (leagueFilter && r.leagueId !== leagueFilter) return false;
    if (sportFilter) {
      const sport = membershipSport.get(`${r.userId}:${r.teamId}`);
      if (sport !== sportFilter) return false;
    }
    return true;
  });

  const uniqByUser = Array.from(
    new Map(filteredRows.map((r) => [r.userId, r])).values()
  );

  const CONTROL: CSSProperties = { minWidth: 160 };
  const hasFilters = Boolean(q) || !!sportFilter || !!leagueFilter;
  const resultCount = uniqByUser.length;

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title" style={{ marginBottom: 0 }}>Players</h1>

      <div style={{ display: "flex", justifyContent: "end" }}>
        <a
          className="btn btn--outline"
          href={exportHref("/export/players.csv", {
            displayName: searchParams.displayName ?? "",
            sport: sportFilter ?? "",
            league: leagueFilter,
          })}
        >
          Download CSV
        </a>
      </div>

      <form method="GET" className="card--soft">
        <input
          name="displayName"
          placeholder="Search by player name…"
          defaultValue={searchParams.displayName ?? ""}
          className="input filters-search"
          style={{ marginBottom: 12 }}
          aria-label="Search by player name"
        />

        <div className="teams-filters-grid">
          <select
            name="sport"
            defaultValue={sportFilter ?? ""}
            className="input"
            style={CONTROL}
            aria-label="Filter by sport"
          >
            <option value="">All sports</option>
            {CANONICAL_SPORTS.map((s) => (
              <option key={s} value={s}>
                {title(s)}
              </option>
            ))}
          </select>

          <select
            name="league"
            defaultValue={leagueFilter}
            className="input"
            style={CONTROL}
            aria-label="Filter by league"
          >
            <option value="">Any league</option>
            {leagues.map((l) => (
              <option key={l.leagueId} value={l.leagueId}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 12,
          }}
        >
          <div className="subtle-text">
            {resultCount} {resultCount === 1 ? "result" : "results"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasFilters && (
              <a href="/players" className="btn btn--light">
                Reset
              </a>
            )}
            <button className="btn btn--outline" type="submit">
              Apply
            </button>
          </div>
        </div>
      </form>

      <SuperPlayerList roster={uniqByUser} playerTeamsByUser={playerTeamsByUser} />
    </main>
  );
}
