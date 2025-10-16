// Players Page (Superadmin Only)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import SuperPlayerList from "@/components/superPlayerList";
import type { PlayerTeam, RosterRow, Team } from "@/types/domain";
import type { CSSProperties } from "react";

async function smembers(key: string): Promise<string[]> {
  const v = (await kv.smembers(key)) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
}

type SearchParams = { displayName?: string };

export default async function PlayersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) notFound();

  // Build roster rows (one per team membership) + teams-by-user map
  const teamIds = await smembers("teams:index");
  const roster: RosterRow[] = [];
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  await Promise.all(
    teamIds.map(async (teamId) => {
      const team = (await kv.get<Team>(`team:${teamId}`)) || null;
      if (!team) return;
      const teamName = team.name ?? teamId;
      const leagueId = team.leagueId ?? undefined;

      const teamRoster =
        ((await kv.get<any[]>(`team:${teamId}:roster`)) as any[]) ?? [];
      const payments =
        ((await kv.get<Record<string, boolean>>(
          `team:${teamId}:payments`
        )) as Record<string, boolean>) ?? {};

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
    })
  );

  roster.sort((a, b) => a.displayName.localeCompare(b.displayName));

  // Apply search
  const q = (searchParams.displayName ?? "").trim().toLowerCase();
  const filteredRows = q
    ? roster.filter((r) => r.displayName.toLowerCase().includes(q))
    : roster;

  // ✅ Deduplicate by userId so counts and list match (unique players)
  const uniqByUser = Array.from(
    new Map(filteredRows.map((r) => [r.userId, r])).values()
  );

  const CONTROL: CSSProperties = { minWidth: 160 };
  const hasFilters = Boolean(q);
  const resultCount = uniqByUser.length;

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title" style={{ marginBottom: 0 }}>Players</h1>

      {/* Download CSV */}
      <div style={{ display: "flex", justifyContent: "end" }}>
      <a className="btn btn--outline" href="/export/players.csv">
        Download CSV
      </a>
      </div>

      {/* Filters (compact: search + buttons on same row) */}
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