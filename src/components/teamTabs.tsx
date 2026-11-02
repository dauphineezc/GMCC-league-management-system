// src/components/teamTabs.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import ScheduleViewer from "@/components/scheduleViewer";
import GameHistory from "@/components/gameHistory";
import InviteModal from "@/components/inviteModal";
import type { RosterEntry, Game } from "@/types/domain";

type InviteModalType = 'link' | 'code' | null;

export default function TeamTabs(props: {
  teamId: string;
  teamName: string;
  leagueId: string;
  roster: RosterEntry[];
  games: Game[];
  isMember: boolean;    // team member
  isManager: boolean;   // team manager
  playerAddDeadline?: string | null;
  isPlayerAddLocked?: boolean;
  sport?: string | null;
}) {
  const { teamId, teamName, leagueId, roster, isMember, isManager, playerAddDeadline, isPlayerAddLocked, sport } = props;
  const [tab, setTab] = useState<"roster" | "schedule" | "history" | "standings">("roster");
  const [inviteModal, setInviteModal] = useState<InviteModalType>(null);
  const [leaving, setLeaving] = useState(false);
  const [showAssignManagerModal, setShowAssignManagerModal] = useState(false);
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

  const handleLeaveTeam = async () => {
    if (isManager) {
      const managerCount = sortedRoster.filter(r => r.isManager).length;
      if (managerCount === 1) {
        // Show modal to assign new manager
        setShowAssignManagerModal(true);
        return;
      }
    }

    const confirmed = confirm(
      `Are you sure you want to leave ${teamName}? This action cannot be undone.`
    );
    
    if (!confirmed) return;

    await executeLeave();
  };

  const executeLeave = async (newManagerId?: string) => {
    setLeaving(true);
    try {
      const response = await fetch(`/api/teams/${teamId}/players`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: 'self',
          newManagerId, // Optional: new manager to assign before leaving
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('You have successfully left the team.');
        window.location.href = '/';
      } else {
        alert(data.error || 'Failed to leave team');
      }
    } catch {
      alert('Something went wrong. Please try again.');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <>
      <section className="card">
        {/* Sub-nav tabs */}
        <div className="team-tabs">
          <Tab id="roster"   current={tab} setTab={setTab}>Roster</Tab>
          <Tab id="schedule" current={tab} setTab={setTab}>Schedule</Tab>
          <Tab id="history"  current={tab} setTab={setTab}>Game History</Tab>
          <Tab id="standings" current={tab} setTab={setTab}>Standings</Tab>
        </div>

      {/* Everything below the tabs sits in a padded panel so bullets/tables don't hug the edge */}
      <div className="team-panel" style={{ paddingTop: 20, paddingLeft: 20, paddingRight: 20, paddingBottom: 20 }}>
        {tab === "roster" && (
          <>
            {sortedRoster.length === 0 ? (
              <p>No players yet.</p>
            ) : (
              <>
                {/* Desktop table */}
                <div className="team-roster-desktop">
                  <div className="card--soft rounded-2xl border overflow-hidden">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={th}>Player Name</th>
                            <th style={thCenter}>Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRoster.map((p) => (
                            <tr key={p.userId}>
                              <td style={td}><span className="team-roster-player-name">{p.displayName || p.userId}</span></td>
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="roster-actions" style={{ marginTop: "16px" }}>
                      {isManager && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                          <button 
                            type="button" 
                            className="btn btn--outline btn--sm"
                            onClick={() => setInviteModal('code')}
                            disabled={isPlayerAddLocked}
                            style={{ 
                              opacity: isPlayerAddLocked ? 0.5 : 1,
                              cursor: isPlayerAddLocked ? 'not-allowed' : 'pointer'
                            }}
                            title={isPlayerAddLocked ? 'Player add deadline has passed' : ''}
                          >
                            Invite via Code
                          </button>
                          {playerAddDeadline && !isPlayerAddLocked && (
                            <div style={{ 
                              fontSize: 13, 
                              color: '#666',
                              fontStyle: 'italic'
                            }}>
                              Deadline to invite players: {new Date(playerAddDeadline).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      {isMember && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          onClick={handleLeaveTeam}
                          disabled={leaving}
                          style={{ marginLeft: isManager ? 'auto' : 0 }}
                        >
                          {leaving ? 'Leaving...' : 'Leave Team'}
                        </button>
                      )}
                    </div>
                    {isManager && isPlayerAddLocked && playerAddDeadline && (
                      <div style={{ 
                        marginTop: 2, 
                        padding: '8px 8px', 
                        // backgroundColor: '#FFF3E6', 
                        borderRadius: 8,
                        fontSize: 12,
                        // color: '#ec720e',
                        color: 'var(--navy)',
                        fontWeight: 400
                      }}>
                          Player invites are locked. The add-player deadline ({new Date(playerAddDeadline).toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}) has passed.<br />Contact your league admin if you need to add a player.
                      </div>
                    )}

                </div>
                
                {/* Mobile table */}
                <div className="team-roster-mobile">
                  <div className="card--soft rounded-2xl border overflow-hidden">
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>
                            <th style={th}>Player Name</th>
                            <th style={thCenter}>Role</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedRoster.map((p) => (
                            <tr key={p.userId}>
                              <td style={td}><span className="team-roster-player-name">{p.displayName || p.userId}</span></td>
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  <div className="roster-actions" style={{ marginTop: "16px" }}>
                    {isManager && (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
                        <button 
                          type="button" 
                          className="btn btn--outline btn--sm"
                          onClick={() => setInviteModal('code')}
                          disabled={isPlayerAddLocked}
                          style={{ 
                            opacity: isPlayerAddLocked ? 0.5 : 1,
                            cursor: isPlayerAddLocked ? 'not-allowed' : 'pointer'
                          }}
                          title={isPlayerAddLocked ? 'Player add deadline has passed' : ''}
                        >
                          Invite via Code
                        </button>
                        {playerAddDeadline && !isPlayerAddLocked && (
                          <div style={{ 
                            fontSize: 13, 
                            color: '#666',
                            fontStyle: 'italic'
                          }}>
                            Deadline to invite players: {new Date(playerAddDeadline).toLocaleDateString('en-US', { 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    {isMember && (
                      <button
                        type="button"
                        className="btn btn--outline btn--sm"
                        onClick={handleLeaveTeam}
                        disabled={leaving}
                        style={{ marginLeft: isManager ? 'auto' : 0 }}
                      >
                        {leaving ? 'Leaving...' : 'Leave Team'}
                      </button>
                    )}
                  </div>
                  {isManager && isPlayerAddLocked && playerAddDeadline && (
                    <div style={{ 
                      marginTop: 12, 
                      padding: '12px 16px', 
                      backgroundColor: '#FFF3E6', 
                      borderRadius: 8,
                      fontSize: 14,
                      color: '#ec720e',
                      fontWeight: 500
                    }}>
                      ⚠️ Player invites are locked. The add-player deadline ({new Date(playerAddDeadline).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}) has passed. Contact your league admin if you need to add a player.
                    </div>
                  )}
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
          <GameHistory leagueId={leagueId} teamId={teamId} teamName={teamName} sport={sport} />
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
                                background: isCurrentTeam ? 'rgba(75,139,43,.05)' : 'transparent',
                                fontWeight: isCurrentTeam ? 500 : 400,
                                borderLeft: isCurrentTeam ? '3.5px solid rgba(75,139,43,.3)' : '3px solid transparent',
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
                              backgroundColor: isCurrentTeam ? 'rgba(75,139,43,.05)' : 'transparent',
                              padding: "10px 10px",
                              borderLeft: isCurrentTeam ? '3px solid rgba(75,139,43,.35)' : '3px solid transparent',
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
      </section>

      {/* Invite Modals */}
      {inviteModal && (
        <InviteModal
          type={inviteModal}
          teamId={teamId}
          teamName={teamName}
          onClose={() => setInviteModal(null)}
        />
      )}

      {/* Assign Manager Modal */}
      {showAssignManagerModal && (
        <AssignManagerModal
          roster={sortedRoster}
          teamName={teamName}
          onAssignAndLeave={(newManagerId) => {
            setShowAssignManagerModal(false);
            executeLeave(newManagerId);
          }}
          onClose={() => setShowAssignManagerModal(false)}
        />
      )}
    </>
  );
}

function Tab({
  id,
  current,
  setTab,
  children,
}: {
  id: "roster" | "schedule" | "history" | "standings";
  current: "roster" | "schedule" | "history" | "standings";
  setTab: (t: "roster" | "schedule" | "history" | "standings") => void;
  children: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      className={`team-tab ${active ? "is-active" : ""}`}
      onClick={() => setTab(id)}
      type="button"
    >
      {children}
    </button>
  );
}

/* Standings table styles */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const thCenter: React.CSSProperties = { textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
const tdCenter: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center" };

/* ---------------- Assign Manager Modal Component ---------------- */

function AssignManagerModal({
  roster,
  teamName,
  onAssignAndLeave,
  onClose,
}: {
  roster: RosterEntry[];
  teamName: string;
  onAssignAndLeave: (newManagerId: string) => void;
  onClose: () => void;
}) {
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  // Filter out current managers from the selection
  const eligiblePlayers = roster.filter(r => !r.isManager);

  const handleConfirm = () => {
    if (!selectedUserId) {
      alert('Please select a player to be the new manager');
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to assign ${roster.find(r => r.userId === selectedUserId)?.displayName} as the new team manager and leave ${teamName}? This action cannot be undone.`
    );

    if (confirmed) {
      onAssignAndLeave(selectedUserId);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontWeight: 400, fontSize: "22px" }}>Assign New Team Manager</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="warning-message" style={{
            background: '#fff3cd',
            color: '#856404',
            padding: 16,
            borderRadius: 4,
            marginBottom: 20,
            border: '1px solid #ffeaa7'
          }}>
            ⚠️ You must assign a new team manager before leaving the team.
          </div>

          <p className="modal-description">
            Select a player from your roster to become the new team manager:
          </p>

          <div className="player-selection" style={{ marginTop: 16 }}>
            {eligiblePlayers.length === 0 ? (
              <p style={{ color: '#666' }}>No other players on the roster to assign as manager.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {eligiblePlayers.map((player) => (
                  <label
                    key={player.userId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: 12,
                      border: `2px solid ${selectedUserId === player.userId ? '#4CAF50' : '#ddd'}`,
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: selectedUserId === player.userId ? '#f1f8f4' : 'white',
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="radio"
                      name="newManager"
                      value={player.userId}
                      checked={selectedUserId === player.userId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      style={{ marginRight: 12 }}
                    />
                    <span style={{ fontSize: 16, fontWeight: 500 }}>
                      {player.displayName || player.userId}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button 
              className="btn btn--outline" 
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="btn btn--primary" 
              onClick={handleConfirm}
              disabled={!selectedUserId}
              style={{ opacity: selectedUserId ? 1 : 0.5 }}
            >
              Assign & Leave Team
            </button>
          </div>
        </div>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 20px;
          }

          .modal-content {
            background: white;
            border-radius: 8px;
            max-width: 500px;
            width: 100%;
            max-height: 90vh;
            overflow-y: auto;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }

          .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #e0e0e0;
          }

          .modal-header h2 {
            margin: 0;
            font-size: 20px;
          }

          .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          }

          .modal-close:hover {
            background: #f0f0f0;
          }

          .modal-body {
            padding: 20px;
          }

          .modal-description {
            margin-bottom: 16px;
            color: #666;
          }

          .modal-actions {
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 20px;
          }
        `}</style>
      </div>
    </div>
  );
}