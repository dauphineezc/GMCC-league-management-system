// Unified League Page - Uses permission-based rendering
// OPTIMIZED: Use revalidation for better performance
export const revalidate = 30; // Revalidate every 30 seconds
export const dynamicParams = true;

import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { IfAdmin, IfSuperAdmin } from "@/components/conditionalDisplay";
import AdminLeagueSplitTabs from "@/components/adminLeagueSplitTabs";
import AdminAssignmentEditor from "@/components/adminAssignmentEditor";
import Tabs from "@/components/leagueTabs";
import ScheduleViewerServer from "@/components/scheduleViewer.server";
import GameHistory from "@/components/gameHistory";
import LeagueActionsDropdown from "@/components/leagueActionsDropdown";
import DeleteResourceButton from "@/components/deleteResourceButton";
import EditLeagueDescription from "@/components/editLeagueDescription";
import { DIVISIONS } from "@/lib/divisions";
import { getLeagueScheduleView, getOrCalculateStandings } from "@/lib/leagueData";
import type { RosterEntry } from "@/types/domain";
import { getAdminDisplayName } from "@/lib/adminUserLookup";
import { readLeagueDocJSON } from "@/lib/leagueDoc";
import { batchGetRosters, batchGetPayments } from "@/lib/kvBatch";
import { buildPlayerTeamsByUserFromMemberships } from "@/lib/playerTeams";
import { getTeamsForLeague, smembersSafe, readLeagueDoc } from "@/lib/kvHelpers";

export async function generateStaticParams() {
  const ids = await smembersSafe("leagues:index");
  return ids.map((leagueId) => ({ leagueId }));
}

/* ---------------- Data helpers (direct KV, no HTTP self-fetch) ---------------- */

async function fetchGames(leagueId: string) {
  try {
    return await getLeagueScheduleView(leagueId);
  } catch {
    return [];
  }
}

async function fetchStandings(leagueId: string) {
  try {
    return await getOrCalculateStandings(leagueId);
  } catch {
    return [];
  }
}

/* ---------------- Page Component ---------------- */

export default async function UnifiedLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
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
    (leagueDoc?.name != null ? String(leagueDoc.name) : "") ||
    DIVISIONS.find((d) => d.id === leagueId)?.name ||
    leagueId;

  const description =
    leagueDoc?.description != null ? String(leagueDoc.description) : "";

  // Admin-specific data (only fetch if needed)
  const masterRoster: Array<RosterEntry & { teamId: string; teamName: string; paid?: boolean }> = [];
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
        
        roster.forEach((entry) => {
          masterRoster.push({
            ...entry,
            joinedAt: entry.joinedAt ?? new Date().toISOString(),
            paid: Boolean(payMap[entry.userId]),
            teamId: t.teamId,
            teamName: t.name,
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
      </header>

      {/* League Description - editable by admins and superadmins */}
      {permissions.isAdmin() ? (
        <EditLeagueDescription 
          leagueId={leagueId}
          initialDescription={description}
        />
      ) : description ? (
        <p style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
          {description}
        </p>
      ) : null}

      {/* Superadmin-only: Admin assignment editor */}
      <IfSuperAdmin checker={permissions}>
        <AdminAssignmentEditor 
          leagueId={leagueId}
          leagueAdminName={adminInfo.leagueAdminName}
        />
      </IfSuperAdmin>

      {/* Admin-only Actions Dropdown */}
      <IfAdmin checker={permissions}>
        <LeagueActionsDropdown leagueId={leagueId} />
      </IfAdmin>

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
                <div>
                  {teams.length === 0 ? (
                    <div className="p-4 text-center">
                      <div className="text-gray-500">No teams yet.</div>
                    </div>
                  ) : (
                    <div>
                      {teams.map((t, idx) => (
                        <div key={t.teamId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 8px", borderTop: idx === 0 ? "none" : "1px solid #f3f4f6" }}>
                          <span className="public-league-team-name" style={{ 
                            fontFamily: "var(--font-body), system-ui", 
                            fontWeight: 500, 
                            letterSpacing: ".3px", 
                            fontSize: 20, 
                            color: "var(--navy)" 
                          }}>
                            {t.name}
                          </span>
                        </div>
                      ))}
                    </div>
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
                    <>
                      {/* Desktop table */}
                      <div className="standings-desktop">
                        <div style={{ overflowX: 'auto' }}>
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
                        </div>
                      </div>
                      
                      {/* Mobile cards */}
                      <div className="standings-mobile">
                        <ul className="roster-list">
                          {standings.map((s: any) => (
                            <li key={s.teamId}>
                              <div style={{
                                backgroundColor: 'var(--card)',
                                padding: "10px 10px",
                              }}>
                                <h3 className="public-standings-team-name" style={{ 
                                  margin: 0, 
                                  fontSize: "22px", 
                                  fontWeight: 400, 
                                  color: "var(--navy)",
                                  fontFamily: "var(--font-body), system-ui",
                                  marginBottom: "8px",
                                }}>
                                  {s.teamName || s.name || s.teamId}
                                </h3>
                                
                                <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "4px" }}>
                                    <div>
                                      <strong style={{ color: "var(--navy)", fontWeight: 800 }}>Record:</strong> {s.gamesPlayed > 0 ? `${s.wins}-${s.losses}` : "--"}
                                    </div>
                                    <div>
                                      <strong style={{ color: "var(--navy)", fontWeight: 800 }}>Win Rate:</strong> {s.gamesPlayed > 0 ? (s.winPercentage * 100).toFixed(1) + "%" : "--"}
                                    </div>
                                  </div>
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                                    <div>
                                      <strong style={{ color: "var(--navy)", fontWeight: 800 }}>Points For:</strong> {s.gamesPlayed > 0 ? s.pointsFor : "--"}
                                    </div>
                                    <div>
                                      <strong style={{ color: "var(--navy)", fontWeight: 800 }}>Points Against:</strong> {s.gamesPlayed > 0 ? s.pointsAgainst : "--"}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
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

      {/* Superadmin-only: Delete League button */}
      <IfSuperAdmin checker={permissions}>
        <DeleteResourceButton
          kind="league"
          id={leagueId}
          name={leagueName}
          redirectTo="/leagues"
          variant="link"
        >
          Delete League
        </DeleteResourceButton>
      </IfSuperAdmin>

    </main>
  );
}

/* helpers for the standings table */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const thCenter: React.CSSProperties = { textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
const tdCenter: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center" };
