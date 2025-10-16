// Unified League Page - Uses permission-based rendering
// OPTIMIZED: Use revalidation for better performance
export const revalidate = 30; // Revalidate every 30 seconds
export const dynamicParams = true;

import { kv } from "@vercel/kv";
import { getServerUser, isLeagueAdminAsync } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { IfAdmin, IfSuperAdmin } from "@/components/conditionalDisplay";
import AdminLeagueSplitTabs from "@/components/adminLeagueSplitTabs";
import AdminAssignmentEditor from "@/components/adminAssignmentEditor";
import Tabs from "@/components/leagueTabs";
import ScheduleViewerServer from "@/components/scheduleViewer.server";
import GameHistory from "@/components/gameHistory";
import { DIVISIONS } from "@/lib/divisions";
import { absoluteUrl } from "@/lib/absoluteUrl";
import type { RosterEntry } from "@/types/domain";
import { getAdminDisplayName } from "@/lib/adminUserLookup";
import { readLeagueDocJSON } from "@/lib/leagueDoc";
import { batchGetRosters, batchGetPayments } from "@/lib/kvBatch";
import { buildPlayerTeamsByUserFromMemberships } from "@/lib/playerTeams";

/* ---------------- tolerant helpers ---------------- */

async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers(key)) as unknown;
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  } catch {
    /* ignore WRONGTYPE */
  }
  return [];
}

async function readArr<T = any>(key: string): Promise<T[]> {
  let raw: unknown;
  try {
    raw = await kv.get(key);
  } catch {
    return [];
  }
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? (arr as T[]) : [];
    } catch {
      return [];
    }
  }
  if (raw && typeof raw === "object") {
    return [];
  }
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

export async function generateStaticParams() {
  const ids = await smembersSafe("leagues:index");
  return ids.map((leagueId) => ({ leagueId }));
}

/* ---------------- API helpers ---------------- */

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

/* ---------------- page helpers ---------------- */

type TeamCard = { teamId: string; name: string; description?: string; approved?: boolean };

async function getTeamsForLeague(leagueId: string): Promise<TeamCard[]> {
  const teamIds = await smembersSafe(`league:${leagueId}:teams`);
  const seeds = new Set<string>(teamIds);
  
  if (seeds.size === 0) {
    const players = await readArr<any>(`league:${leagueId}:players`);
    for (const tid of players.map((p) => String(p?.teamId ?? "")).filter(Boolean)) {
      seeds.add(tid);
    }
  }

  const ids = Array.from(seeds);
  
  // OPTIMIZED: Batch fetch all teams at once instead of N individual fetches
  const { batchGetTeams } = await import("@/lib/kvBatch");
  const teamsMap = await batchGetTeams(ids);
  
  const rows = ids.map((id) => {
    const t = teamsMap.get(`team:${id}`);
    return {
      teamId: id,
      name: t?.name ?? id,
      description: t?.description ?? "",
      approved: Boolean(t?.approved),
    } as TeamCard;
  });

  return rows.sort((a, b) => (a.name || a.teamId).localeCompare(b.name || b.teamId, undefined, { sensitivity: "base" }));
}

/* ---------------- Page Component ---------------- */

export default async function UnifiedLeaguePage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await getServerUser();
  
  // Create permission checker
  const permissions = await PermissionChecker.create(user, leagueId);

  // Fetch data (everyone needs this)
  const [leagueDoc, teams, games, standings] = await Promise.all([
    readLeagueDoc(leagueId),
    getTeamsForLeague(leagueId),
    fetchGames(leagueId),
    fetchStandings(leagueId),
  ]);

  const leagueName =
    (leagueDoc?.name && String(leagueDoc.name)) ||
    DIVISIONS.find((d) => d.id === leagueId)?.name ||
    leagueId;

  const description = leagueDoc?.description ?? "";

  // Admin-specific data (only fetch if needed)
  let masterRoster: Array<RosterEntry & { teamId: string; teamName: string; paid?: boolean }> = [];
  let adminInfo: { adminUserId: string | null; leagueAdminName: string | null } = {
    adminUserId: null,
    leagueAdminName: null,
  };

  if (permissions.isAdmin()) {
    // Build master roster for admins - OPTIMIZED with batch operations
    // OLD: 2N KV calls (N rosters + N payments)
    // NEW: 2 batch calls total
    try {
      const teamIds = teams.map(t => t.teamId);
      const [rostersMap, paymentsMap] = await Promise.all([
        batchGetRosters(teamIds),
        batchGetPayments(teamIds),
      ]);

      teams.forEach((t) => {
        const roster = rostersMap.get(t.teamId) ?? [];
        const payMap = paymentsMap.get(t.teamId) ?? {};
        
        roster.forEach(entry => {
          masterRoster.push({
            ...entry,
            teamId: t.teamId,
            teamName: t.name,
            paid: Boolean(payMap[entry.userId]),
          });
        });
      });
    } catch (error) {
      console.error('Error fetching admin roster data:', error);
      // Continue with empty master roster if batch operations fail
    }
  }

  const userIds = masterRoster.map(r => r.userId);
  let playerTeamsByUser: Record<string, any[]> = {};
  
  try {
    playerTeamsByUser = await buildPlayerTeamsByUserFromMemberships(userIds);
  } catch (error) {
    console.error('Error fetching player teams:', error);
    // Continue with empty object if player teams lookup fails
  }


  if (permissions.isSuperAdmin()) {
    // Fetch league admin info for superadmins
    try {
      const leagueDocFull = await readLeagueDocJSON(leagueId);
      const adminUserId = leagueDocFull?.adminUserId ?? null;
      const leagueAdminName = await getAdminDisplayName(adminUserId);
      adminInfo = { adminUserId, leagueAdminName };
    } catch (error) {
      console.error('Error fetching admin info:', error);
      // Continue with null values if admin lookup fails
      adminInfo = { adminUserId: null, leagueAdminName: null };
    }
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{leagueName}</h1>
        </div>
        
        {/* Admin-only CSV export */}
        <IfAdmin checker={permissions}>
          <div className="mt-2">
            <a 
              className="btn btn--outline" 
              href={`/leagues/${encodeURIComponent(leagueId)}/export.csv`}
            >
              Download Roster CSV
            </a>
          </div>
        </IfAdmin>
      </header>

      {description && (
        <section className="card--soft" style={{ maxWidth: 720 }}>
          {description}
        </section>
      )}

      {/* Superadmin-only: Admin assignment editor */}
      <IfSuperAdmin checker={permissions}>
        <AdminAssignmentEditor 
          leagueId={leagueId}
          leagueAdminName={adminInfo.leagueAdminName}
        />
      </IfSuperAdmin>

      {/* Admin view: show admin tabs */}
      <IfAdmin 
        checker={permissions}
        fallback={
          // Public/Player view: show public tabs
          <Tabs
            initial="teams"
            labels={{ teams: "Teams", schedule: "Schedule", history: "Game History", standings: "Standings" }}
            tabs={{
              teams: (
                <div className="roster-gradient">
                  {teams.length === 0 ? (
                    <div className="p-4 text-center">
                      <div className="text-gray-500">No teams yet.</div>
                    </div>
                  ) : (
                    <ul className="roster-list">
                      {teams.map((t) => (
                        <li key={t.teamId}>
                          <div className="player-card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                            <span style={{ fontFamily: "var(--font-sport), var(--font-body), system-ui", fontWeight: 500, letterSpacing: ".3px", fontSize: 24 }}>
                              {t.name}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ),
              schedule: <ScheduleViewerServer leagueId={leagueId} />,
              history: <GameHistory leagueId={leagueId} />,
              standings: (
                <div>
                  {standings.length === 0 ? (
                    <div className="p-4 text-center">
                      <div className="text-gray-500">No standings yet.</div>
                    </div>
                  ) : (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={th}>Team</th>
                          <th style={thCenter}>Wins</th>
                          <th style={thCenter}>Losses</th>
                          <th style={thCenter}>Win %</th>
                          <th style={thCenter}>Points For</th>
                          <th style={thCenter}>Points Against</th>
                        </tr>
                      </thead>
                      <tbody>
                        {standings.map((s: any) => (
                          <tr key={s.teamId}>
                            <td style={td}>{s.teamName || s.name || s.teamId}</td>
                            <td style={tdCenter}>{s.gamesPlayed > 0 ? s.wins : "--"}</td>
                            <td style={tdCenter}>{s.gamesPlayed > 0 ? s.losses : "--"}</td>
                            <td style={tdCenter}>{s.gamesPlayed > 0 ? (s.winPercentage * 100).toFixed(1) + "%" : "--"}</td>
                            <td style={tdCenter}>{s.gamesPlayed > 0 ? s.pointsFor : "--"}</td>
                            <td style={tdCenter}>{s.gamesPlayed > 0 ? s.pointsAgainst : "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ),
            }}
          />
        }
      >
        {/* Admin content */}
        <AdminLeagueSplitTabs 
          leagueId={leagueId} 
          teams={teams} 
          roster={masterRoster} 
          playerTeamsByUser={playerTeamsByUser}
          games={games}
          standings={standings}
        />
      </IfAdmin>
    </main>
  );
}

/* helpers for the standings table */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const thCenter: React.CSSProperties = { textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
const tdCenter: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center" };
