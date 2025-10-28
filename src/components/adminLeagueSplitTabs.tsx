// src/components/adminLeagueSplitTabs.tsx
"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import PlayerInfoPopup from "@/components/playerInfoPopup";
import { DIVISIONS } from "@/lib/divisions";
import type { TeamLite, RosterRow, PlayerTeam, PlayerInfo } from "@/types/domain";
import ScheduleViewer from "@/components/scheduleViewer";
import GameHistory from "@/components/gameHistory";

type Props = {
  leagueId: string;
  teams: TeamLite[];
  roster: RosterRow[];
  playerTeamsByUser?: Record<string, PlayerTeam[]>;
  games?: any[];
  standings?: any[];
};

type TeamsAPIResp = {
  teams: Array<{
    teamId: string;
    teamName: string;
    leagueId: string | null;
    leagueName: string | null;
    isManager: boolean;
    paid: boolean;
  }>;
};

type TabKey = "teams" | "roster" | "schedule" | "history" | "standings";

function slugify(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}
function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}
function fakeContact(displayName: string) {
  const slug = slugify(displayName || "player");
  return {
    email: `${slug}@example.com`,
    phone: "(989) 555-" + String(Math.abs(hashCode(slug)) % 9000 + 1000),
    dob: "05/21/1990",
    emergencyName: "Spouse",
    emergencyPhone: "(989) 888-9988",
  };
}

export default function AdminLeagueSplitTabs({
  leagueId,
  teams,
  roster,
  playerTeamsByUser,
  games = [],
  standings = [],
}: Props) {
  const [tab, setTab] = useState<TabKey>("teams");

  // popup state
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [contextTeamId, setContextTeamId] = useState<string | undefined>(undefined);
  const [contextPaid, setContextPaid] = useState<boolean | undefined>(undefined);

  const handleClose = useCallback(() => {
    setOpen(false);
    setPlayer(null);
    setContextTeamId(undefined);
    setContextPaid(undefined);
  }, []);

  const handleView = useCallback(
    async (row: RosterRow) => {
      const contact = fakeContact(row.displayName);
      const leagueName = (DIVISIONS.find((d) => d.id === (leagueId as any))?.name ?? leagueId) as string;
  
      const withLeague = (t: Partial<PlayerTeam>): PlayerTeam => ({
        teamId: t.teamId!,
        teamName: t.teamName!,
        isManager: !!t.isManager,
        paid: !!t.paid,
        leagueId: t.leagueId ?? String(leagueId),
        leagueName: t.leagueName ?? leagueName,
      });
  
      let teamsForUser: PlayerTeam[] | undefined =
        playerTeamsByUser?.[row.userId]?.map(withLeague);

      if (!teamsForUser) {
        try {
          const res = await fetch(`/api/users/${row.userId}/teams`, { cache: "no-store" });
          const data = (await res.json()) as TeamsAPIResp;

          if (Array.isArray(data?.teams)) {
            teamsForUser = data.teams.map((t) =>
              withLeague({
                teamId: t.teamId,
                teamName: t.teamName,
                isManager: t.isManager,
                paid: t.paid,
                leagueId: t.leagueId ?? undefined,     // keep per-team league
                leagueName: t.leagueName ?? undefined,
              })
            );
          }
        } catch { /* ignore, keep fallback */ }
      }
  
      // still fallback to the current team if nothing else available
      if (!teamsForUser || teamsForUser.length === 0) {
        teamsForUser = [
          withLeague({
            teamId: row.teamId,
            teamName: row.teamName,
            isManager: row.isManager,
            paid: row.paid,
          }),
        ];
      }
  
      setPlayer({ userId: row.userId, displayName: row.displayName, contact, teams: teamsForUser });
      setContextTeamId(row.teamId);
      setContextPaid(row.paid);
      setOpen(true);
    },
    [leagueId, playerTeamsByUser]
  );  

  return (
    <section className="card">
      <div className="team-tabs">
        <button
          type="button"
          className={`team-tab ${tab === "teams" ? "is-active" : ""}`}
          onClick={() => setTab("teams")}
        >
          Teams
        </button>
        <button
          type="button"
          className={`team-tab ${tab === "roster" ? "is-active" : ""}`}
          onClick={() => setTab("roster")}
        >
          League Roster
        </button>
        <button
          type="button"
          className={`team-tab ${tab === "schedule" ? "is-active" : ""}`}
          onClick={() => setTab("schedule")}
        >
          Schedule
        </button>
        <button
          type="button"
          className={`team-tab ${tab === "history" ? "is-active" : ""}`}
          onClick={() => setTab("history")}
        >
          Game History
        </button>
        <button
          type="button"
          className={`team-tab ${tab === "standings" ? "is-active" : ""}`}
          onClick={() => setTab("standings")}
        >
          Standings
        </button>
      </div>

      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        {tab === "teams" && <TeamsPane leagueId={leagueId} teams={teams} />}
        {tab === "roster" && <RosterPane roster={roster} onView={handleView} />}
        {tab === "schedule" && (
          <div className="card--soft rounded-2xl border overflow-hidden" style={{ padding: "16px 20px" }}>
            <ScheduleViewer leagueId={leagueId} />
          </div>
        )}
        {tab === "history" && <GameHistory leagueId={leagueId} />}
        {tab === "standings" && <StandingsPane standings={standings} />}
      </div>

      <PlayerInfoPopup
        open={open}
        player={player}
        onClose={handleClose}
        contextLeagueId={leagueId}
        contextTeamId={contextTeamId}
        contextPaidOverride={contextPaid}
      />
    </section>
  );
}

/* ========= Teams tab ========= */
function TeamsPane({
  leagueId,
  teams,
}: {
  leagueId: string;
  teams: TeamLite[];
}) {
  const ACTIONS_WIDTH = 420;
  const ACTIONS_MIN_H = 260;
  const COL_GAP = 100;

  return (
    <div className="admin-league-layout">
      <div className="card--soft rounded-2xl border overflow-hidden" style={{ padding: "16px 20px" }}>
        {teams.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No teams yet.
          </p>
        ) : (
          <div>
          {teams.map((t, idx) => (
            <div
              key={t.teamId}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px 8px",
                borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
              }}
            >
              {/* Top row: Team name and badge inline */}
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between",
                gap: "12px"
              }}>
                <span
                  style={{
                    fontFamily: "var(--font-body), system-ui",
                    fontWeight: 500,
                    letterSpacing: ".3px",
                    fontSize: 20,
                    lineHeight: 1.2,
                    color: "var(--navy)",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.name}
                </span>
                
                {/* Badge inline with team name */}
                <span className={`badge ${t.approved ? "badge--ok" : "badge--pending"}`} style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  flexShrink: 0,
                }}>
                  {t.approved ? "APPROVED" : "PENDING"}
                </span>
              </div>
              
              {/* Bottom row: View link aligned right */}
              <div style={{ 
                display: "flex", 
                justifyContent: "flex-end" 
              }}>
                <Link href={`/admin/team/${t.teamId}`} className="card-cta" style={{
                  fontSize: "12px",
                }}>
                  VIEW TEAM →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

/* ========= Standings tab ========= */
function StandingsPane({ standings }: { standings: any[] }) {
  return (
    <div className="card--soft rounded-2xl border overflow-hidden" style={{ padding: "16px 20px" }}>
      {standings.length === 0 ? (
        <div className="p-4 text-center">
          <div className="text-gray-500">No standings yet.</div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="standings-desktop">
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
          
          {/* Mobile cards */}
          <div className="standings-mobile">
            <ul className="roster-list">
              {standings.map((s: any) => (
                <li key={s.teamId}>
                  <div className="player-card" style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3 style={{ 
                        margin: 0, 
                        fontSize: "22px", 
                        fontWeight: 500, 
                        color: "var(--navy)",
                        fontFamily: "var(--font-body), system-ui"
                      }}>
                        {s.teamName || s.name || s.teamId}
                      </h3>
                      {/* {s.gamesPlayed > 0 && (
                        <span style={{
                          fontSize: "14px",
                          fontWeight: 700,
                          color: "var(--navy)",
                          background: "var(--light-blue)",
                          padding: "4px 8px",
                          borderRadius: "4px"
                        }}>
                          {(s.winPercentage * 100).toFixed(1)}%
                        </span>
                      )} */}
                    </div>
                    
                    <div style={{ fontSize: "14px", color: "var(--gray-600)" }}>


                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", marginBottom: "4px" }}>
                        <div>
                          <strong style={{ color: "var(--navy)" }}>Record:</strong> {s.gamesPlayed > 0 ? `${s.wins}-${s.losses}` : "--"}
                        </div>
                        <div>
                          <strong style={{ color: "var(--navy)" }}>Win Rate:</strong> {s.gamesPlayed > 0 ? (s.winPercentage * 100).toFixed(1) + "%" : "--"}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                        <div>
                          <strong style={{ color: "var(--navy)" }}>Points For:</strong> {s.gamesPlayed > 0 ? s.pointsFor : "--"}
                        </div>
                        <div>
                          <strong style={{ color: "var(--navy)" }}>Points Against:</strong> {s.gamesPlayed > 0 ? s.pointsAgainst : "--"}
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
  );
}

/* helpers for the standings table */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const thCenter: React.CSSProperties = { textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
const tdCenter: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center" };

/* ========= Roster tab ========= */
function RosterPane({
  roster,
  onView,
}: {
  roster: RosterRow[];
  onView: (row: RosterRow) => void;
}) {
  const COL_GAP = 70;

  // Sort roster alphabetically by display name
  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => 
      (a.displayName || a.userId || '').localeCompare(b.displayName || b.userId || '', undefined, { sensitivity: 'base' })
    );
  }, [roster]);

  const col = useMemo(() => {
    if (typeof document === "undefined") {
      return { namePx: 200, teamPx: 160, managerPx: 140, paidPx: 110 };
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const measure = (txt: string, font: string) => {
      ctx.font = font;
      return Math.ceil(ctx.measureText(txt).width);
    };

    const nameFont = "700 24px var(--font-body), system-ui";
    const teamFont = "800 16px var(--font-body), system-ui";
    const metaFont = "700 14px var(--font-body), system-ui";
    const badgeFont = "700 14px var(--font-body), system-ui";

    let namePx = 160;
    let teamPx = 140;

    for (const r of sortedRoster) {
      namePx = Math.max(namePx, measure(r.displayName || "", nameFont));
      teamPx = Math.max(teamPx, measure((r.teamName || "").toUpperCase(), teamFont));
    }

    const managerPx = measure("Team Manager", metaFont) + 24;
    const paidPx = Math.max(measure("PAID", badgeFont), measure("UNPAID", badgeFont)) + 28;

    return { namePx, teamPx, managerPx, paidPx };
  }, [sortedRoster]);

  return (
    <div style={{ marginTop: 8 }}>
      <div className="card--soft rounded-2xl border overflow-hidden" style={{ padding: "16px 20px" }}>
        {sortedRoster.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No players yet.
          </p>
        ) : (
          <div>
          {sortedRoster.map((p, idx) => (
            <div
              key={`${p.teamId}:${p.userId}`}
              className="player-card--aligned player-card--mobile-layout"
              style={{
                padding: "10px 8px",
                borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
              }}
            >
                {/* Line 1: Player name only */}
                <div
                  style={{
                    fontFamily: "var(--font-body), system-ui",
                    fontSize: 20,
                    fontWeight: 500,
                    lineHeight: 1.1,
                    color: "var(--navy)",
                  }}
                >
                  {p.displayName}
                </div>

                {/* Desktop layout: Team name, Manager badge, Paid badge, and View Player link */}
                <div
                  className={p.isManager ? "has-manager-badge" : "no-manager-badge"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                    gap: "12px",
                  }}
                >
                  {/* Team name - takes available space */}
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      color: "var(--navy)",
                      flex: 1,
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.teamName}
                  </div>
                  
                  {/* Manager badge - fixed width */}
                  {p.isManager && (
                    <span className="player-meta" title="Team Manager" style={{ 
                      whiteSpace: "nowrap",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                      width: "80px",
                    }}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="navy" aria-hidden="true">
                        <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                      </svg>
                      Manager
                    </span>
                  )}
                  
                  {/* Paid badge - auto width */}
                  <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`} style={{ 
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    textAlign: "center",
                  }}>
                    {p.paid ? "PAID" : "UNPAID"}
                  </span>

                  {/* Spacer to push View Player to the right */}
                  <div style={{ flex: 1, minWidth: "20px" }} />

                  {/* View Player link - anchored to right */}
                  <button
                    type="button"
                    className="card-cta"
                    aria-label={`View ${p.displayName}`}
                    onClick={() => onView(p)}
                    title={`View ${p.displayName}`}
                    style={{ 
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    VIEW PLAYER →
                  </button>
                </div>

                {/* Mobile layout: Team name and manager badge on same line */}
                <div className="mobile-team-name" style={{ display: "none" }}>
                  <span style={{
                    fontSize: 14,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "var(--navy)",
                    fontFamily: "var(--font-body), system-ui",
                  }}>
                    {p.teamName}
                  </span>
                  
                  {p.isManager && (
                    <span className="player-meta" title="Team Manager" style={{ 
                      whiteSpace: "nowrap",
                      fontSize: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      flexShrink: 0,
                      marginLeft: "8px",
                    }}>
                      <svg viewBox="0 0 24 24" width="12" height="12" fill="navy" aria-hidden="true">
                        <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                      </svg>
                      Manager
                    </span>
                  )}
                </div>
                
                <div className="mobile-badges-row" style={{ display: "none" }}>
                  <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`} style={{ 
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    textAlign: "center",
                    marginRight: "12px",
                  }}>
                    {p.paid ? "PAID" : "UNPAID"}
                  </span>
                  
                  <button
                    type="button"
                    className="card-cta"
                    aria-label={`View ${p.displayName}`}
                    onClick={() => onView(p)}
                    title={`View ${p.displayName}`}
                    style={{ 
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    VIEW PLAYER →
                  </button>
                </div>
              </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}