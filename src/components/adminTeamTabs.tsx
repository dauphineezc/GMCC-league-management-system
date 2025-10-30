// src/components/adminTeamTabs.tsx
"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import PlayerInfoPopup from "@/components/playerInfoPopup";
import ScheduleViewer from "@/components/scheduleViewer";
import GameHistory from "@/components/gameHistory";
import type { PlayerInfo, PlayerTeam, RosterRow, Game } from "@/types/domain";

type Props = {
  teamId: string;
  teamName: string;
  leagueId: string;
  roster: RosterRow[];
  games: Game[];
  onTogglePaid: (formData: FormData) => void;
  playerTeamsByUser: Record<string, PlayerTeam[]>;
};

type TabKey = "roster" | "schedule" | "history" | "standings";

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
    email: "",           // ← blank (falsy) so popup won’t render @example.com first
    phone: "",
    dob: "",
    emergencyName: "",
    emergencyPhone: "",
  };
}

export default function AdminTeamTabs({
  teamId,
  teamName,
  leagueId,
  roster,
  games,
  onTogglePaid,
  playerTeamsByUser,
}: Props) {
  const [tab, setTab] = useState<TabKey>("roster");
  const [isMobile, setIsMobile] = useState(false);

  // popup state
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [contextPaid, setContextPaid] = useState<boolean | undefined>(undefined);
  
  // remove player state
  const [removingPlayer, setRemovingPlayer] = useState<string | null>(null);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  
  // standings state
  const [standings, setStandings] = useState<any[]>([]);
  const [loadingStandings, setLoadingStandings] = useState(false);

  // Sort roster alphabetically by display name
  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => 
      (a.displayName || a.userId || '').localeCompare(b.displayName || b.userId || '', undefined, { sensitivity: 'base' })
    );
  }, [roster]);

  // Fetch standings when tab is selected
  useEffect(() => {
    if (tab === 'standings' && standings.length === 0 && !loadingStandings) {
      setLoadingStandings(true);
      fetch(`/api/leagues/${leagueId}/standings`)
        .then(res => res.json())
        .then(data => setStandings(Array.isArray(data) ? data : []))
        .catch(() => setStandings([]))
        .finally(() => setLoadingStandings(false));
    }
    // Only re-run when tab or leagueId changes, not when standings or loadingStandings changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, leagueId]);

  const closePopup = useCallback(() => {
    setOpen(false);
    setPlayer(null);
    setContextPaid(undefined);
  }, []);

  const openPopupFor = useCallback(
    (row: RosterRow) => {
      const contact = fakeContact(row.displayName);
      const teams =
        playerTeamsByUser?.[row.userId] ??
        [
          {
            teamId,
            leagueId,
            teamName: teamName,
            isManager: row.isManager,
            paid: row.paid,
          },
        ];
      setPlayer({ userId: row.userId, displayName: row.displayName, contact, teams });
      setContextPaid(row.paid);
      setOpen(true);
    },
    [playerTeamsByUser, teamId, leagueId]
  );

  const handleRemovePlayer = useCallback(
    async (userId: string, displayName: string) => {
      const confirmed = confirm(
        `Are you sure you want to remove ${displayName} from the team? This action cannot be undone.`
      );
      
      if (!confirmed) return;

      setRemovingPlayer(userId);
      try {
        const response = await fetch(`/api/teams/${teamId}/players`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });

        const data = await response.json();

        if (response.ok) {
          alert(`${displayName} has been removed from the team.`);
          window.location.reload();
        } else {
          alert(data.error || 'Failed to remove player');
        }
      } catch (error) {
        alert('Something went wrong. Please try again.');
      } finally {
        setRemovingPlayer(null);
      }
    },
    [teamId]
  );

  const now = Date.now();
  const { upcoming, history } = useMemo(() => {
    const u: Game[] = [], h: Game[] = [];
    for (const g of games) {
      const when = Date.parse(g.dateTimeISO);
      (isFinite(when) && when >= now ? u : h).push(g);
    }
    u.sort((a, b) => Date.parse(a.dateTimeISO) - Date.parse(b.dateTimeISO));
    h.sort((a, b) => Date.parse(b.dateTimeISO) - Date.parse(a.dateTimeISO));
    return { upcoming: u, history: h };
  }, [games, now]);

  const COL_GAP = 80;
  const PAYGROUP_GAP = 14;

  return (
    <section className="card">
      <div className="team-tabs">
        <button type="button" className={`team-tab ${tab === "roster" ? "is-active" : ""}`} onClick={() => setTab("roster")}>Roster</button>
        <button type="button" className={`team-tab ${tab === "schedule" ? "is-active" : ""}`} onClick={() => setTab("schedule")}>Schedule</button>
        <button type="button" className={`team-tab ${tab === "history" ? "is-active" : ""}`} onClick={() => setTab("history")}>Game History</button>
        <button type="button" className={`team-tab ${tab === "standings" ? "is-active" : ""}`} onClick={() => setTab("standings")}>Standings</button>
      </div>

      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        {tab === "roster" && (
          <>
            {sortedRoster.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No players yet.</p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="admin-team-roster-desktop">
                  <div className="card--soft rounded-2xl border overflow-hidden">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={th}>Player Name</th>
                            <th style={thCenter}>Role</th>
                            <th style={thCenter}>Payment Status</th>
                            <th style={thCenter}>View</th>
                            <th style={thCenter}>Remove</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRoster.map((p) => (
                            <tr key={p.userId}>
                              <td style={td}>{p.displayName}</td>
                              <td style={tdCenter}>
                                {p.isManager && (
                                  <span className="player-meta" title="Team Manager" style={{ 
                                    whiteSpace: "nowrap",
                                    fontSize: "12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                  }}>
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="navy" aria-hidden="true">
                                      <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                                    </svg>
                                    Manager
                                  </span>
                                )}
                              </td>
                              <td style={tdCenter}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                  <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`}>
                                    {p.paid ? "PAID" : "UNPAID"}
                                  </span>
                                  <form action={onTogglePaid} style={{ display: "inline" }}>
                                    <input type="hidden" name="userId" value={p.userId} />
                                    <button 
                                      className="icon-btn icon-btn--light" 
                                      type="submit"
                                      aria-label={p.paid ? "Mark as unpaid" : "Mark as paid"}
                                      title={p.paid ? "Mark as unpaid" : "Mark as paid"}
                                    >
                                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                      </svg>
                                    </button>
                                  </form>
                                </div>
                              </td>
                              <td style={tdCenter}>
                                <button
                                  type="button"
                                  className="card-cta"
                                  aria-label={`View ${p.displayName}`}
                                  onClick={() => openPopupFor(p)}
                                  title={`View ${p.displayName}`}
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  VIEW PLAYER →
                                </button>
                              </td>
                              <td style={tdCenter}>
                                <button
                                  type="button"
                                  className="icon-btn icon-btn--danger"
                                  onClick={() => handleRemovePlayer(p.userId, p.displayName)}
                                  disabled={removingPlayer === p.userId}
                                  aria-label={`Remove ${p.displayName}`}
                                  title={removingPlayer === p.userId ? 'Removing...' : `Remove ${p.displayName}`}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">
                                    <path d="M3 6h18" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" />
                                    <rect x="6" y="6" width="12" height="14" rx="2" strokeWidth="2" />
                                    <path d="M10 11v6M14 11v6" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                {/* Mobile cards */}
                <div className="admin-team-roster-mobile">
                  <ul className="roster-list">
                    {sortedRoster.map((p) => (
                      <li key={p.userId}>
                        <div className="player-card" style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                            <h3 style={{ 
                              margin: 0, 
                              fontSize: "20px", 
                              fontWeight: 500, 
                              color: "var(--navy)",
                              fontFamily: "var(--font-body), system-ui"
                            }}>
                              {p.displayName}
                            </h3>
                            {p.isManager && (
                              <span className="player-meta" title="Team Manager" style={{ 
                                whiteSpace: "nowrap",
                                fontSize: "12px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                              }}>
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="navy" aria-hidden="true">
                                  <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                                </svg>
                                Manager
                              </span>
                            )}
                          </div>
                          
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                            <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`}>
                              {p.paid ? "PAID" : "UNPAID"}
                            </span>
                            <form action={onTogglePaid} style={{ display: "inline" }}>
                              <input type="hidden" name="userId" value={p.userId} />
                              <button 
                                className="icon-btn icon-btn--light" 
                                type="submit"
                                aria-label={p.paid ? "Mark as unpaid" : "Mark as paid"}
                                title={p.paid ? "Mark as unpaid" : "Mark as paid"}
                              >
                                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              </button>
                            </form>
                          </div>
                          
                          <div style={{ display: "flex", gap: "8px", justifyContent: "space-between" }}>
                            <button
                              type="button"
                              className="card-cta"
                              aria-label={`View ${p.displayName}`}
                              onClick={() => openPopupFor(p)}
                              title={`View ${p.displayName}`}
                              style={{ flex: 1 }}
                            >
                              VIEW PLAYER →
                            </button>
                            <button
                              type="button"
                              className="icon-btn icon-btn--danger"
                              onClick={() => handleRemovePlayer(p.userId, p.displayName)}
                              disabled={removingPlayer === p.userId}
                              aria-label={`Remove ${p.displayName}`}
                              title={removingPlayer === p.userId ? 'Removing...' : `Remove ${p.displayName}`}
                              style={{ padding: "8px" }}
                            >
                              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">
                                <path d="M3 6h18" strokeWidth="2" strokeLinecap="round" />
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" />
                                <rect x="6" y="6" width="12" height="14" rx="2" strokeWidth="2" />
                                <path d="M10 11v6M14 11v6" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </>
        )}

        {tab === "schedule" && (
          <div className="card--soft rounded-2xl border overflow-hidden" style={{ padding: "16px 20px" }}>
            <ScheduleViewer leagueId={leagueId} teamId={teamId} teamName={teamName} />
          </div>
        )}

        {tab === "history" && (
          <GameHistory leagueId={leagueId} teamId={teamId} teamName={teamName} />
        )}

        {tab === "standings" && (
          <div className="card--soft rounded-2xl border overflow-hidden" style={{ padding: "16px 20px" }}>
            {loadingStandings ? (
              <p style={{ textAlign: 'center', color: '#666' }}>Loading standings...</p>
            ) : standings.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#666' }}>No standings yet.</p>
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
                        {standings.map((s: any) => {
                          const isCurrentTeam = s.teamName === teamName || s.teamId === teamId;
                          return (
                            <tr 
                              key={s.teamId}
                              style={{ 
                                // background: isCurrentTeam ? '#F1F4F9' : 'transparent',
                                background: isCurrentTeam ? 'rgba(75,139,43,.05)' : 'transparent',
                                fontWeight: isCurrentTeam ? 500 : 400,
                                borderLeft: isCurrentTeam ? '3.5px solid rgba(75,139,43,.3)' : '3px solid transparent',
                                // borderRight: isCurrentTeam ? '2px solid rgba(0,58,112,.08)' : '1px solid transparent',
                              }}
                            >
                              <td style={td}>{s.teamName || s.name || s.teamId}</td>
                              <td style={tdCenter}>{s.gamesPlayed > 0 ? s.wins : "--"}</td>
                              <td style={tdCenter}>{s.gamesPlayed > 0 ? s.losses : "--"}</td>
                              <td style={tdCenter}>{s.gamesPlayed > 0 ? (s.winPercentage * 100).toFixed(1) + "%" : "--"}</td>
                              <td style={tdCenter}>{s.gamesPlayed > 0 ? s.pointsFor : "--"}</td>
                              <td style={tdCenter}>{s.gamesPlayed > 0 ? s.pointsAgainst : "--"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* Mobile cards */}
                <div className="standings-mobile">
                  <ul className="roster-list">
                    {standings.map((s: any) => {
                      const isCurrentTeam = s.teamName === teamName || s.teamId === teamId;
                      return (
                        <li key={s.teamId}>
                          <div 
                            className={isCurrentTeam ? 'current-team-highlight' : ''}
                            style={{
                              backgroundColor: isCurrentTeam ? '#F1F8FF' : 'var(--card)',
                              padding: "10px 10px",
                              border: isCurrentTeam ? '1px solid rgba(0,58,112,.12)' : '1px solid transparent',
                              borderLeft: isCurrentTeam ? '3px solid rgba(75,139,43,.35)' : '3px solid transparent',
                              borderRadius: isCurrentTeam ? '8px' : '0',
                              boxShadow: isCurrentTeam ? '0 2px 8px rgba(0,58,112,.06)' : 'none',
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                              <h3 style={{ 
                                margin: 0, 
                                fontSize: "22px", 
                                fontWeight: 400, 
                                color: "var(--navy)",
                                fontFamily: "var(--font-body), system-ui"
                              }}>
                                {s.teamName || s.name || s.teamId}
                              </h3>
                              {
                              /* {s.gamesPlayed > 0 && (
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
                                  <strong style={{ color: "var(--navy)" }}>Win Rate:</strong> {(s.winPercentage * 100).toFixed(1)}%
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
                      );
                    })}
                  </ul>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <PlayerInfoPopup
        open={open}
        player={player}
        onClose={closePopup}
        contextLeagueId={leagueId}
        contextTeamId={teamId}
        contextPaidOverride={contextPaid}
      />
    </section>
  );
}

/* Standings table styles */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const thCenter: React.CSSProperties = { textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
const tdCenter: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center" };