// Unified Team Page - Uses permission-based rendering
// OPTIMIZED: Use revalidation instead of force-dynamic for better performance
export const revalidate = 60; // Revalidate every 60 seconds

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import TeamTabs from "@/components/teamTabs";
import AdminTeamTabs from "@/components/adminTeamTabs";
import DeleteTeamButton from "@/components/deleteResourceButton";
import type { Team, RosterEntry, StandingRow, Game, PlayerTeam } from "@/types/domain";
import { batchGetTeamNames, batchGetTeams, batchGetPayments, batchGet } from "@/lib/kvBatch";

/* ---------------- helpers ---------------- */

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

/* ---------------- Page Component ---------------- */

export default async function UnifiedTeamPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId;
  
  // Load team first
  const team = (await kv.get<Team>(`team:${teamId}`)) || null;
  if (!team) notFound();

  const user = await getServerUser();
  
  // Check permissions for this team's league
  const permissions = await PermissionChecker.create(user, team.leagueId ?? "");
  
  // Load roster
  const roster = await readArr<RosterEntry>(`team:${teamId}:roster`);
  
  // Load games
  let games = await readArr<Game>(`team:${teamId}:games`);
  if (!games.length) {
    const leagueGames = await readArr<Game>(`league:${team.leagueId}:games`);
    games = leagueGames.filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
  }

  // Hydrate team names for games - OPTIMIZED: batch fetch instead of N individual queries
  const teamIds = Array.from(
    new Set([teamId, ...games.flatMap((g) => [g.homeTeamId, g.awayTeamId])])
  ).filter((x): x is string => Boolean(x));

  const idToName = await batchGetTeamNames(teamIds);

  const resolveName = (explicit?: string, id?: string) =>
    explicit ?? (id ? idToName.get(id) ?? id : "—");

  const gamesWithNames: Game[] = games.map((g) => ({
    ...g,
    homeTeamName: resolveName(g.homeTeamName, g.homeTeamId),
    awayTeamName: resolveName(g.awayTeamName, g.awayTeamId),
  }));

  // Check user membership
  const memberships = user
    ? await readArr<{ leagueId: string; teamId: string; isManager: boolean }>(
        `user:${user.id}:memberships`
      )
    : [];

  const meOnThisTeam = memberships.find((m) => m.teamId === teamId);
  const isMember = Boolean(meOnThisTeam);
  const isManager = Boolean(meOnThisTeam?.isManager);

  // Admin-specific data
  let rosterRows: Array<RosterEntry & { teamId: string; teamName: string; paid?: boolean }> = [];
  let playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  if (permissions.isAdmin()) {
    // Load payment data
    const paidMap = (await kv.get<Record<string, boolean>>(`team:${teamId}:payments`)) ?? {};
    
    rosterRows = roster.map((r) => ({
      ...r,
      teamId,
      teamName: team.name,
      paid: Boolean(paidMap[r.userId]),
    }));

    // OPTIMIZED: Load player teams for popup with batch operations
    // OLD: ~70 KV calls for 10 players with 3 teams each
    // NEW: ~3-5 batch calls total
    
    // Step 1: Batch fetch all player memberships
    const membershipKeys = roster.map(r => `user:${r.userId}:memberships`);
    const membershipResults = await batchGet<any[]>(membershipKeys);
    
    // Step 2: Collect all unique team IDs from all memberships
    const allTeamIds = new Set<string>([teamId]);
    roster.forEach(r => {
      const playerMemberships = membershipResults.get(`user:${r.userId}:memberships`) ?? [];
      const memberships = Array.isArray(playerMemberships) ? playerMemberships : [];
      memberships.forEach((m: any) => {
        const tid = m?.teamId ?? m?.id ?? m;
        if (tid && typeof tid === 'string') allTeamIds.add(tid);
      });
    });
    
    // Step 3: Batch fetch all teams and payments at once
    const uniqueTeamIds = Array.from(allTeamIds);
    const [teamsMap, paymentsMap] = await Promise.all([
      batchGetTeams(uniqueTeamIds),
      batchGetPayments(uniqueTeamIds),
    ]);
    
    // Step 4: Build player teams data using cached data
    roster.forEach(r => {
      const playerMemberships = membershipResults.get(`user:${r.userId}:memberships`) ?? [];
      const memberships = Array.isArray(playerMemberships) ? playerMemberships : [];
      
      if (!memberships.length) {
        playerTeamsByUser[r.userId] = [
          {
            teamId,
            teamName: team.name,
            leagueId: team.leagueId ?? undefined,
            isManager: r.isManager,
            paid: Boolean(paidMap[r.userId]),
          },
        ];
        return;
      }
      
      const entries: PlayerTeam[] = [];
      memberships.forEach((m: any) => {
        const tid = m?.teamId ?? m?.id ?? m;
        if (!tid) return;
        
        const t = teamsMap.get(`team:${tid}`);
        if (!t) return;
        
        const teamPayments = paymentsMap.get(tid) ?? {};
        entries.push({
          teamId: tid,
          teamName: t.name ?? tid,
          leagueId: t.leagueId ?? undefined,
          isManager: Boolean(m.isManager),
          paid: teamPayments[r.userId] ?? false,
        });
      });
      
      playerTeamsByUser[r.userId] = entries;
    });
  }

  // Standings for record display (public view)
  const standings = ((await kv.get<StandingRow[]>(`league:${team.leagueId}:standings`)) ?? []) as StandingRow[];
  const standing = standings.find((s) => s.teamId === teamId) || null;
  
  const record =
    standing?.rank != null
      ? `Rank #${standing.rank}`
      : standing
      ? `${standing.wins ?? 0}-${standing.losses ?? 0}${
          standing.ties ? `-${standing.ties}` : ""
        }`
      : "—";

  /* ---------------- Server Actions ---------------- */

  const toggleApproval = async () => {
    "use server";
    const t = (await kv.get<Team>(`team:${teamId}`)) || null;
    if (!t) return;
    await kv.set(`team:${teamId}`, { ...t, approved: !t.approved });
    await revalidatePath(`/team/${teamId}`);
    if (t.leagueId) {
      await revalidatePath(`/leagues/${t.leagueId}`);
    }
  };

  const togglePaid = async (formData: FormData) => {
    "use server";
    const uid = String(formData.get("userId") || "");
    if (!uid) return;
    const map = (await kv.get<Record<string, boolean>>(`team:${teamId}:payments`)) ?? {};
    map[uid] = !Boolean(map[uid]);
    await kv.set(`team:${teamId}:payments`, map);
    await revalidatePath(`/team/${teamId}`);
    const t = (await kv.get<Team>(`team:${teamId}`)) || null;
    if (t?.leagueId) {
      await revalidatePath(`/leagues/${t.leagueId}`);
    }
  };

  /* ---------------- Render ---------------- */

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{team.name}</h1>
          {/* {!permissions.isAdmin() && <div className="team-subtle">{record}</div>} */}
        </div>

        <div className="chip-group" style={{ display: "flex", gap: 8 }}>
          <span className={team.approved ? "chip chip--ok" : "chip chip--pending"}>
            {team.approved ? "✅ Approved" : "⏳ Pending Approval"}
          </span>
          
          {/* Admin-only: Approval toggle */}
          {permissions.isAdmin() && !permissions.isSuperAdmin() && (
            <form action={toggleApproval}>
              <button type="submit" className="btn btn--light btn--sm">
                {team.approved ? "Unapprove" : "Approve"}
              </button>
            </form>
          )}
        </div>
      </header>

      {team.description ? (
        <section className="team-desc card--soft">{team.description}</section>
      ) : null}

      {/* Conditional tabs based on permissions */}
      {permissions.isAdmin() ? (
        <AdminTeamTabs
          teamId={teamId}
          teamName={team.name}
          leagueId={team.leagueId ?? ""}
          roster={rosterRows}
          games={gamesWithNames}
          onTogglePaid={togglePaid}
          playerTeamsByUser={playerTeamsByUser}
        />
      ) : (
        <TeamTabs
          teamId={teamId}
          teamName={team.name}
          leagueId={team.leagueId || ""}
          roster={roster}
          games={gamesWithNames}
          isMember={isMember}
          isManager={isManager}
        />
      )}

      {/* Admin-only: Delete button */}
      {permissions.isAdmin() && (
        <DeleteTeamButton
          kind="team"
          id={teamId}
          name={team.name}
          redirectTo={`/leagues/${team.leagueId ?? ""}`}
          variant="link"
        >
          Delete Team
        </DeleteTeamButton>
      )}
    </main>
  );
}
