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
    email: `${slug}@example.com`,
    phone: "(989) 555-" + String(Math.abs(hashCode(slug)) % 9000 + 1000),
    dob: "1990-05-21",
    emergencyName: "Spouse",
    emergencyPhone: "(989) 888-9988",
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
          <div className="roster-gradient">
            {sortedRoster.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No players yet.</p>
            ) : (
              <ul className="roster-list">
                {sortedRoster.map((p) => (
                  <li key={p.userId}>
                    <div
                        className="player-card player-card--team-roster"
                        style={{
                          display: "grid",
                          alignItems: "center",
                          columnGap: COL_GAP,
                          gridTemplateColumns: "minmax(240px,1fr) max-content max-content max-content max-content",
                          justifyItems: "start",
                          paddingRight: 10,
                        }}
                      >
                      {/* Mobile: New 3-4 line layout */}
                      {isMobile ? (
                        <div style={{ 
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "8px",
                          width: "100%",
                          paddingLeft: 15,
                          paddingRight: 15
                        }}>
                          {/* Line 1: Player name only */}
                          <div style={{ width: "100%" }}>
                            <div style={{
                              fontFamily: "var(--font-sport), var(--font-body), system-ui", 
                              fontSize: 24, 
                              fontWeight: 500,
                              letterSpacing: ".3px",
                              lineHeight: 1.1,
                              wordBreak: "break-word"
                            }}>
                              {p.displayName}
                            </div>
                          </div>

                          {/* Line 2: Manager badge (if manager) OR Payment info (if not manager) */}
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "12px",
                            width: "100%",
                            flexWrap: "wrap"
                          }}>
                            {p.isManager ? (
                              <span className="player-meta" title="Team Manager" style={{ 
                                fontSize: "12px", 
                                display: "flex", 
                                alignItems: "center", 
                                gap: "4px",
                                fontFamily: "var(--font-body), system-ui"
                              }}>
                                <svg viewBox="0 0 24 24" width="12" height="12" fill="navy" aria-hidden="true">
                                  <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                                </svg>
                                Manager
                              </span>
                            ) : (
                              <>
                                <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`}>
                                  {p.paid ? "PAID" : "UNPAID"}
                                </span>
                                <form action={onTogglePaid}>
                                  <input type="hidden" name="userId" value={p.userId} />
                                  <button className="btn btn--light btn--sm" type="submit">
                                    {p.paid ? "MARK AS UNPAID" : "MARK AS PAID"}
                                  </button>
                                </form>
                              </>
                            )}
                          </div>

                          {/* Line 3: Payment info (if manager) OR Actions (if not manager) */}
                          <div style={{ 
                            display: "flex", 
                            alignItems: "center", 
                            justifyContent: "space-between",
                            width: "100%"
                          }}>
                            {p.isManager ? (
                              <>
                                <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`}>
                                  {p.paid ? "PAID" : "UNPAID"}
                                </span>
                                <form action={onTogglePaid}>
                                  <input type="hidden" name="userId" value={p.userId} />
                                  <button className="btn btn--light btn--sm" type="submit">
                                    {p.paid ? "MARK AS UNPAID" : "MARK AS PAID"}
                                  </button>
                                </form>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="icon-btn icon-btn--danger"
                                  onClick={() => handleRemovePlayer(p.userId, p.displayName)}
                                  disabled={removingPlayer === p.userId}
                                  aria-label={`Remove ${p.displayName}`}
                                  title={removingPlayer === p.userId ? 'Removing...' : `Remove ${p.displayName}`}
                                  style={{ padding: "4px" }}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
                                    <path d="M3 6h18" strokeWidth="2" strokeLinecap="round" />
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" />
                                    <rect x="6" y="6" width="12" height="14" rx="2" strokeWidth="2" />
                                    <path d="M10 11v6M14 11v6" strokeWidth="2" strokeLinecap="round" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  className="card-cta"
                                  aria-label={`View ${p.displayName}`}
                                  onClick={() => openPopupFor(p)}
                                  title={`View ${p.displayName}`}
                                  style={{
                                    whiteSpace: "nowrap",
                                    overflowWrap: "normal",
                                    wordBreak: "normal",
                                    display: "inline-block"
                                  }}
                                >
                                  VIEW PLAYER →
                                </button>
                              </>
                            )}
                          </div>

                          {/* Line 4: Actions (only if manager) */}
                          {p.isManager && (
                            <div style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              justifyContent: "space-between",
                              width: "100%"
                            }}>
                              <button
                                type="button"
                                className="icon-btn icon-btn--danger"
                                onClick={() => handleRemovePlayer(p.userId, p.displayName)}
                                disabled={removingPlayer === p.userId}
                                aria-label={`Remove ${p.displayName}`}
                                title={removingPlayer === p.userId ? 'Removing...' : `Remove ${p.displayName}`}
                                style={{ padding: "4px" }}
                              >
                                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="16" height="16">
                                  <path d="M3 6h18" strokeWidth="2" strokeLinecap="round" />
                                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" />
                                  <rect x="6" y="6" width="12" height="14" rx="2" strokeWidth="2" />
                                  <path d="M10 11v6M14 11v6" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                className="card-cta"
                                aria-label={`View ${p.displayName}`}
                                onClick={() => openPopupFor(p)}
                                title={`View ${p.displayName}`}
                                style={{
                                  whiteSpace: "nowrap",
                                  overflowWrap: "normal",
                                  wordBreak: "normal",
                                  display: "inline-block"
                                }}
                              >
                                VIEW PLAYER →
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Desktop: Player name only */
                        <div style={{ 
                          fontFamily: "var(--font-sport), var(--font-body), system-ui", 
                          fontSize: 24, 
                          fontWeight: 500,
                          paddingLeft: 15,
                          letterSpacing: ".3px",
                          lineHeight: 1.1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {p.displayName}
                        </div>
                      )}

                      {/* Desktop: Manager badge column */}
                      {!isMobile && (
                        <div className="player-card__manager-desktop">
                          {p.isManager ? (
                            <span className="player-meta" title="Team Manager">
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="navy" aria-hidden="true" style={{ marginRight: 4, alignSelf: "center" }}>
                                <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                              </svg>
                              Team Manager
                            </span>
                          ) : (
                            <span className="player-meta" style={{ opacity: 0 }}>
                              <svg viewBox="0 0 24 24" width="16" height="16" fill="navy" aria-hidden="true" style={{ marginRight: 4, alignSelf: "center" }}>
                                <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                              </svg>
                              Team Manager
                            </span>
                          )}
                        </div>
                      )}

                      {/* Desktop: Payment group only */}
                      {!isMobile && (
                        /* Desktop: Payment group only */
                        <div className="paygroup" style={{ display: "inline-flex", alignItems: "center", gap: PAYGROUP_GAP, alignSelf: "center" }}>
                          <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`}>{p.paid ? "PAID" : "UNPAID"}</span>
                          <form action={onTogglePaid}>
                            <input type="hidden" name="userId" value={p.userId} />
                            <button className="btn btn--light btn--sm" type="submit">
                              {p.paid ? "MARK AS UNPAID" : "MARK AS PAID"}
                            </button>
                          </form>
                        </div>
                      )}

                      {/* Desktop: Separate view player button */}
                      {!isMobile && (
                        <button
                          type="button"
                          className="card-cta player-card__view-desktop"
                          aria-label={`View ${p.displayName}`}
                          onClick={() => openPopupFor(p)}
                          title={`View ${p.displayName}`}
                          style={{
                            whiteSpace: "nowrap",
                            overflowWrap: "normal",
                            wordBreak: "normal",
                            display: "inline-block"
                          }}
                        >
                          VIEW PLAYER →
                        </button>
                      )}

                      {/* Desktop: Trash icon column */}
                      {!isMobile && (
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger player-card__trash-desktop"
                          onClick={() => handleRemovePlayer(p.userId, p.displayName)}
                          disabled={removingPlayer === p.userId}
                          aria-label={`Remove ${p.displayName}`}
                          title={removingPlayer === p.userId ? 'Removing...' : `Remove ${p.displayName}`}
                          style={{
                            justifySelf: "end",
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" width="18" height="18">
                            <path d="M3 6h18" strokeWidth="2" strokeLinecap="round" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" strokeWidth="2" strokeLinecap="round" />
                            <rect x="6" y="6" width="12" height="14" rx="2" strokeWidth="2" />
                            <path d="M10 11v6M14 11v6" strokeWidth="2" strokeLinecap="round" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "schedule" && (
          <ScheduleViewer leagueId={leagueId} teamId={teamId} teamName={teamName} />
        )}

        {tab === "history" && (
          <GameHistory leagueId={leagueId} teamId={teamId} teamName={teamName} />
        )}

        {tab === "standings" && (
          <div>
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
                                background: isCurrentTeam ? '#F1F8FF' : 'transparent',
                                fontWeight: isCurrentTeam ? 600 : 400,
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
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                              <h3 style={{ 
                                margin: 0, 
                                fontSize: "22px", 
                                fontWeight: 400, 
                                color: "var(--navy)",
                                fontFamily: "var(--font-sport), var(--font-body), system-ui"
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