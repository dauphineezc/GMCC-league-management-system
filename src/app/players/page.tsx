// Players Page (Superadmin Only)
export const runtime = "nodejs";
export const revalidate = 30;

import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import SuperPlayerList from "@/components/superPlayerList";
import type { PlayerTeam, RosterRow } from "@/types/domain";
import type { CSSProperties } from "react";
import { smembersSafe } from "@/lib/kvHelpers";
import { batchGetTeams, batchGetRosters, batchGetPayments } from "@/lib/kvBatch";

type SearchParams = { displayName?: string };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) notFound();

  const teamIds = await smembersSafe("teams:index");
  const [teamsMap, rostersMap, paymentsMap] = await Promise.all([
    batchGetTeams(teamIds),
    batchGetRosters(teamIds),
    batchGetPayments(teamIds),
  ]);

  const roster: RosterRow[] = [];
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  for (const teamId of teamIds) {
    const team = teamsMap.get(`team:${teamId}`) as Record<string, unknown> | null | undefined;
    if (!team) continue;

    const teamName = (team.name as string | undefined) ?? teamId;
    const leagueId = (team.leagueId as string | undefined) ?? undefined;
    const teamRoster = rostersMap.get(teamId) ?? [];
    const payments = paymentsMap.get(teamId) ?? {};

    for (const r of teamRoster) {
      const paid = Boolean(payments[r.userId]);
      roster.push({
        userId: r.userId,
        displayName: r.displayName,
        isManager: Boolean(r.isManager),
        paid,
        teamId,
        teamName,
      });

      const bucket = (playerTeamsByUser[r.userId] ||= []);
      bucket.push({
        teamId,
        leagueId,
        teamName,
        isManager: Boolean(r.isManager),
        paid,
      });
    }
  }

  roster.sort((a, b) => a.displayName.localeCompare(b.displayName));

  const q = (searchParams.displayName ?? "").trim().toLowerCase();
  const filteredRows = q
    ? roster.filter((r) => r.displayName.toLowerCase().includes(q))
    : roster;

  const uniqByUser = Array.from(
    new Map(filteredRows.map((r) => [r.userId, r])).values()
  );

  const CONTROL: CSSProperties = { minWidth: 160 };
  const hasFilters = Boolean(q);
  const resultCount = uniqByUser.length;

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title" style={{ marginBottom: 0 }}>Players</h1>

      <div style={{ display: "flex", justifyContent: "end" }}>
      <a className="btn btn--outline" href="/export/players.csv">
        Download CSV
      </a>
      </div>

      <form method="GET" className="card--soft" style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 320px) max-content",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            name="displayName"
            placeholder="Search by player name…"
            defaultValue={searchParams.displayName ?? ""}
            className="input"
            style={CONTROL}
            aria-label="Search by player name"
          />
          <div style={{ display: "flex", gap: 8 }}>
            {hasFilters && (
              <a href="?" className="btn btn--light">
                Reset
              </a>
            )}
            <button className="btn btn--outline" type="submit">
              Apply
            </button>
          </div>
        </div>

        <div
          className="subtle-text"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}
          >
          <span>{resultCount} {resultCount === 1 ? "result" : "results"}</span>
        </div>
      </form>

      <SuperPlayerList roster={uniqByUser} playerTeamsByUser={playerTeamsByUser} />
    </main>
  );
}
