// Unified Team Page - Uses permission-based rendering
// OPTIMIZED: Use revalidation instead of force-dynamic for better performance
export const revalidate = 60; // Revalidate every 60 seconds

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Suspense } from "react";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import TeamTabs from "@/components/teamTabs";
import AdminTeamTabs from "@/components/adminTeamTabs";
import DeleteTeamButton from "@/components/deleteResourceButton";
import ToggleButton from "@/components/toggleButton";
import EditTeamDescription from "@/components/editTeamDescription";
import WelcomeTeamPopup from "@/components/welcomeTeamPopup";
import type { Team, RosterEntry, StandingRow, Game, PlayerTeam } from "@/types/domain";
import { batchGetTeamNames, batchGetTeams, batchGetPayments, batchGet } from "@/lib/kvBatch";

/* ---------------- helpers ---------------- */

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

async function readLeagueDoc(leagueId: string): Promise<Record<string, any> | null> {
  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, any> | null;
    if (h && typeof h === "object" && Object.keys(h).length) return h;
  } catch {}
  try {
    const g = (await kv.get(`league:${leagueId}`)) as any;
    if (g && typeof g === "object") return g as Record<string, any>;
  } catch {}
  return null;
}

async function readTeamDoc(teamId: string): Promise<Team | null> {
  try {
    const h = (await kv.hgetall(`team:${teamId}`)) as Record<string, any> | null;
    if (h && typeof h === "object" && Object.keys(h).length) {
      return h as Team;
    }
  } catch {}
  try {
    const g = (await kv.get<Team>(`team:${teamId}`)) || null;
    if (g && typeof g === "object") return g;
  } catch {}
  return null;
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
  
  // Refresh display names for roster entries that have userId as displayName
  // This handles cases where roster entries were created before user had a displayName
  let rosterUpdated = false;
  const refreshedRoster = await Promise.all(
    roster.map(async (entry) => {
      // If displayName is missing or equals userId, try to refresh from user profile
      if (!entry.displayName || entry.displayName === entry.userId) {
        // User profile might be stored as HASH or JSON object, so try both
        let userProfile: any = null;
        const userKey = `user:${entry.userId}`;
        
        // Try HASH first
        try {
          const h = (await kv.hgetall(userKey)) as Record<string, unknown> | null;
          if (h && typeof h === "object" && Object.keys(h).length) {
            userProfile = h;
          }
        } catch {}
        
        // Fall back to GET if HASH didn't work
        if (!userProfile) {
          try {
            const g = await kv.get(userKey);
            if (g && typeof g === "object") {
              userProfile = g;
            }
          } catch {}
        }
        
        const displayName = userProfile?.displayName || userProfile?.email || entry.userId;
        if (displayName !== entry.displayName) {
          rosterUpdated = true;
          return { ...entry, displayName };
        }
      }
      return entry;
    })
  );
  
  // Update roster in KV if any entries were refreshed
  if (rosterUpdated) {
    await kv.set(`team:${teamId}:roster`, refreshedRoster);
    roster = refreshedRoster;
  }

  // Load league deadline info for player adds and team size requirements
  let playerAddDeadline: string | null = null;
  let playerAddDeadlineOverride = false;
  let isPlayerAddLocked = false;
  let minTeamSize: number | undefined;
  let maxTeamSize: number | undefined;
  
  if (team.leagueId) {
    const league = await readLeagueDoc(team.leagueId);
    if (league) {
      if (league.playerAddDeadline) {
        playerAddDeadline = league.playerAddDeadline;
        playerAddDeadlineOverride = league.playerAddDeadlineOverride || false;
        const deadlineDate = new Date(league.playerAddDeadline);
        const deadlinePassed = deadlineDate < new Date();
        isPlayerAddLocked = deadlinePassed && !playerAddDeadlineOverride;
      }
      minTeamSize = league.minTeamSize;
      maxTeamSize = league.maxTeamSize;
    }
  }
  
  // Count paid players for team size memo
  const paymentsMap = (await kv.get<Record<string, boolean>>(`team:${teamId}:payments`)) ?? {};
  const paidPlayerCount = roster.filter(r => paymentsMap[r.userId]).length;
  
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
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};

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

  const toggleTeamFeePaid = async () => {
    "use server";
    const t = (await kv.get<Team>(`team:${teamId}`)) || null;
    if (!t) return;

    const now = new Date().toISOString();
    const nextPaid = !(t.teamFee?.paid ?? false);

    const teamFee = {
      required: t.teamFee?.required ?? false,
      amountCents: t.teamFee?.amountCents,
      paid: nextPaid,
      paidAt: nextPaid ? now : undefined,
      payerNote: t.teamFee?.payerNote,
    };

    await kv.set(`team:${teamId}`, { ...t, teamFee, updatedAt: now });
    await revalidatePath(`/team/${teamId}`);
    if (t.leagueId) {
      await revalidatePath(`/leagues/${t.leagueId}`);
    }
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
