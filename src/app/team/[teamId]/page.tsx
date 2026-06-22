// Unified Team Page - Uses permission-based rendering
// OPTIMIZED: Use revalidation instead of force-dynamic for better performance
export const revalidate = 60; // Revalidate every 60 seconds

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import TeamTabs from "@/components/teamTabs";
import AdminTeamTabs from "@/components/adminTeamTabs";
import DeleteTeamButton from "@/components/deleteResourceButton";
import ToggleButton from "@/components/toggleButton";
import EditTeamDescription from "@/components/editTeamDescription";
import WelcomeTeamPopup from "@/components/welcomeTeamPopup";
import type { Team, RosterEntry, Game, PlayerTeam } from "@/types/domain";
import { batchGetTeamNames, batchGetTeams, batchGetPayments, batchGetGames } from "@/lib/kvBatch";
import { readArr, readLeagueDoc, readDoc, readMap } from "@/lib/kvHelpers";
import { readLeagueGames } from "@/lib/leagueData";
import { getUserDisplayName, readMembershipsForUid, readMembershipsForUids } from "@/lib/repositories/usersRepo";
import { toggleMemberPaid, toggleTeamApproved } from "@/lib/repositories/teamsRepo";
import { toggleTeamFeePaid as toggleTeamFeePaidAction } from "@/lib/adminActions";

async function readTeamDoc(teamId: string): Promise<Team | null> {
  return readDoc<Team>(`team:${teamId}`);
}

/* ---------------- Page Component ---------------- */

export default async function UnifiedTeamPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  
  // Load team first
  const team = await readTeamDoc(teamId);
  if (!team) notFound();

  const user = await getServerUser();
  
  // Check permissions for this team's league
  const permissions = await PermissionChecker.create(user, team.leagueId ?? "");
  
  // Load roster
  let roster = await readArr<RosterEntry>(`team:${teamId}:roster`);

  const refreshedRoster = await Promise.all(
    roster.map(async (entry) => {
      if (!entry.displayName || entry.displayName === entry.userId) {
        const displayName = await getUserDisplayName(entry.userId);
        if (displayName !== entry.displayName) {
          return { ...entry, displayName, joinedAt: entry.joinedAt ?? new Date().toISOString(), paid: entry.paid ?? false };
        }
      }
      return { ...entry, joinedAt: entry.joinedAt ?? new Date().toISOString(), paid: entry.paid ?? false };
    })
  );
  roster = refreshedRoster;

  // Load league deadline info for player adds and team size requirements
  let playerAddDeadline: string | null = null;
  let playerAddDeadlineOverride = false;
  let isPlayerAddLocked = false;
  let minTeamSize: number | undefined;
  let maxTeamSize: number | undefined;
  
  if (team.leagueId) {
    const league = await readLeagueDoc(team.leagueId);
    if (league) {
      if (league.playerAddDeadline != null) {
        playerAddDeadline = String(league.playerAddDeadline);
        playerAddDeadlineOverride = Boolean(league.playerAddDeadlineOverride);
        const deadlineDate = new Date(playerAddDeadline);
        const deadlinePassed = deadlineDate < new Date();
        isPlayerAddLocked = deadlinePassed && !playerAddDeadlineOverride;
      }
      const rawMin = league.minTeamSize;
      const rawMax = league.maxTeamSize;
      minTeamSize =
        typeof rawMin === "number" ? rawMin : rawMin != null ? Number(rawMin) : undefined;
      maxTeamSize =
        typeof rawMax === "number" ? rawMax : rawMax != null ? Number(rawMax) : undefined;
    }
  }
  
  // Count paid players for team size memo
  const paymentsMap = await readMap<Record<string, boolean>>(`team:${teamId}:payments`);
  const paidPlayerCount = roster.filter((r) => paymentsMap[r.userId]).length;

  let games = (await batchGetGames([teamId])).get(teamId) ?? [];
  if (!games.length && team.leagueId) {
    const leagueGames = await readLeagueGames(String(team.leagueId));
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
  const memberships = user ? await readMembershipsForUid(user.id) : [];

  const meOnThisTeam = memberships.find((m) => m.teamId === teamId);
  const isMember = Boolean(meOnThisTeam);
  const isManager = Boolean(meOnThisTeam?.isManager);

  // Admin-specific data
  let rosterRows: Array<RosterEntry & { teamId: string; teamName: string; paid?: boolean }> = [];
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

  if (permissions.isAdmin()) {
    // Load payment data
    const paidMap = paymentsMap;
    
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
    const membershipResults = await readMembershipsForUids(roster.map((r) => r.userId));
    const allTeamIds = new Set<string>([teamId]);
    roster.forEach((r) => {
      const playerMemberships = membershipResults.get(r.userId) ?? [];
      playerMemberships.forEach((m) => {
        if (m.teamId) allTeamIds.add(m.teamId);
      });
    });
    const uniqueTeamIds = Array.from(allTeamIds);
    const [teamsMap, paymentsByTeam] = await Promise.all([
      batchGetTeams(uniqueTeamIds),
      batchGetPayments(uniqueTeamIds),
    ]);

    roster.forEach((r) => {
      const memberships = membershipResults.get(r.userId) ?? [];

      if (!memberships.length) {
        playerTeamsByUser[r.userId] = [
          {
            teamId,
            teamName: String(team.name),
            leagueId: team.leagueId != null ? String(team.leagueId) : undefined,
            isManager: r.isManager,
            paid: Boolean(paidMap[r.userId]),
          },
        ];
        return;
      }

      const entries: PlayerTeam[] = [];
      memberships.forEach((m) => {
        const tid = m.teamId;
        const t = teamsMap.get(`team:${tid}`) ?? teamsMap.get(tid);
        if (!t) return;

        const teamPayments = paymentsByTeam.get(tid) ?? {};
        entries.push({
          teamId: tid,
          teamName: String(t.name ?? tid),
          leagueId: t.leagueId != null ? String(t.leagueId) : undefined,
          isManager: Boolean(m.isManager),
          paid: teamPayments[r.userId] ?? false,
        });
      });

      playerTeamsByUser[r.userId] = entries;
    });
  }

  /* ---------------- Server Actions ---------------- */

  const toggleApproval = async () => {
    "use server";
    await toggleTeamApproved(teamId);
    await revalidatePath(`/team/${teamId}`);
    const t = await readDoc<Team>(`team:${teamId}`);
    if (t?.leagueId) {
      await revalidatePath(`/leagues/${t.leagueId}`);
    }
  };

  const togglePaid = async (formData: FormData) => {
    "use server";
    const uid = String(formData.get("userId") || "");
    if (!uid) return;
    await toggleMemberPaid(teamId, uid);
    await revalidatePath(`/team/${teamId}`);
    const t = await readDoc<Team>(`team:${teamId}`);
    if (t?.leagueId) {
      await revalidatePath(`/leagues/${t.leagueId}`);
    }
  };

  const toggleTeamFeePaid = async () => {
    "use server";
    await toggleTeamFeePaidAction(teamId);
  };

  /* ---------------- Render ---------------- */

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <Suspense fallback={null}>
        <WelcomeTeamPopup teamName={team.name} />
      </Suspense>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{team.name}</h1>
          {/* {!permissions.isAdmin() && <div className="team-subtle">{record}</div>} */}
        </div>

        <div className="chip-group" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "0px" }}>
          {/* Admin toggle for approval */}
          {permissions.isAdmin() ? (
            <form action={toggleApproval}>
              <ToggleButton
                isActive={team.approved}
                activeLabel="APPROVED"
                inactiveLabel="PENDING"
                activeColor="var(--green)"
                inactiveColor="#ec720e"
                activeBg="#EAF7EE"
                inactiveBg="#FFF3E6"
                activeCircleBg="var(--green)"
                inactiveCircleBg="#ec720e"
                minWidth="120px"
              />
            </form>
          ) : (
            /* Regular badge for non-admin users */
            <span className={team.approved ? "chip chip--ok" : "chip chip--pending"} style={{ fontSize: "14px" }}>
              {team.approved ? "Approved" : "Pending"}
            </span>
          )}
        </div>
      </header>

      <div className="team-fee-container" style={{ marginTop: "-15px" }}>
        {/* Team Fee Badge - Show if fee is required */}
        {team.teamFee?.required && team.teamFee?.amountCents !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "end" }}>
          <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--navy)", alignSelf: "center" }}>
            Team Fee: ${(team.teamFee.amountCents / 100).toFixed(2)}
          </span>
          {permissions.isAdmin() ? (
            /* Admin: Toggleable badge */
            <form action={toggleTeamFeePaid}>
              <ToggleButton
                isActive={team.teamFee.paid}
                activeLabel="PAID"
                inactiveLabel="UNPAID"
                activeColor="var(--green)"
                inactiveColor="#ec720e"
                activeBg="#EAF7EE"
                inactiveBg="#FFF3E6"
                activeCircleBg="var(--green)"
                inactiveCircleBg="#ec720e"
                minWidth="80px"
                variant="paid"
              />
            </form>
          ) : (
            /* Player: View-only badge */
            <span 
              className={team.teamFee.paid ? "chip chip--ok" : "chip chip--pending"} 
              style={{ fontSize: "14px" }}
            >
              {team.teamFee.paid ? "Paid" : "Unpaid"}
            </span>
            )}
          </div>
        )}
      </div>

      {/* Team Description - editable by managers and admins */}
      {isManager ? (
        <EditTeamDescription 
          teamId={teamId}
          initialDescription={team.description}
        />
      ) : team.description ? (
        <p style={{ margin: 0, fontSize: 16, color: 'var(--text)', marginTop: "-30px" }}>
          {team.description}
        </p>
      ) : null}

      {/* Team Size Memo - Show if league has team size requirements */}
      {(minTeamSize !== undefined || maxTeamSize !== undefined) && (
        <div className="card--soft" style={{ padding: '12px 16px', maxWidth: 800, fontSize: 14, marginTop: "0"}}>
          {/* <strong style={{ color: "var(--navy)" }}>Team Size: </strong> */}
          <strong>{paidPlayerCount}</strong> player{paidPlayerCount !== 1 ? 's' : ''} (registered and paid)
          {minTeamSize !== undefined && (
            <> out of the required <strong>{minTeamSize}</strong></>
          )}
          {maxTeamSize !== undefined && (
            <>. Maximum of <strong>{maxTeamSize}</strong> players</>
          )}.
        </div>
      )}

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
          playerAddDeadline={playerAddDeadline}
          isPlayerAddLocked={isPlayerAddLocked}
        />
      )}

      {/* Player-only: payment/registration link */}
      {isMember && !permissions.isAdmin() && (
        <p style={{ fontSize: 14, color: '#666', marginTop: 0, marginBottom: 0, fontStyle: "italic" }}>
          Have you completed your registration and paid your team fee? If not, please do so{" "}
          <a 
            href="https://register.greatermidland.org/webtrac/web/search.html?category=ADULT&module=AR&subtype=LEAGS&display=Detail" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ color: "var(--navy)", textDecoration: "underline", fontWeight: 500 }}>
            here
          </a>.
        </p>
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
