// src/components/teamTabs.tsx
"use client";

import { useMemo, useState, useEffect } from "react";
import ScheduleViewer from "@/components/scheduleViewer";
import GameHistory from "@/components/gameHistory";
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
}) {
  const { teamId, teamName, leagueId, roster, games, isMember, isManager } = props;
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

  const now = Date.now();
  const { upcoming, history } = useMemo(() => {
    const u: Game[] = [];
    const h: Game[] = [];
    for (const g of games) {
      const when = Date.parse(g.dateTimeISO);
      if (isFinite(when) && when >= now) u.push(g);
      else h.push(g);
    }
    u.sort((a, b) => Date.parse(a.dateTimeISO) - Date.parse(b.dateTimeISO));
    h.sort((a, b) => Date.parse(b.dateTimeISO) - Date.parse(a.dateTimeISO));
    return { upcoming: u, history: h };
  }, [games, now]);

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
    } catch (error) {
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

      {/* Everything below the tabs sits in a padded panel so bullets/tables don’t hug the edge */}
      <div className="team-panel" style={{ paddingTop: 20, paddingLeft: 20, paddingRight: 20, paddingBottom: 20 }}>
        {tab === "roster" && (
          <>
            {sortedRoster.length === 0 ? (
              <p>No players yet.</p>
            ) : (
              <div className="roster-gradient">
                <ul className="roster-list">
                  {sortedRoster.map((p) => (
                    <li key={p.userId} className="player-card">
                      <span style={{
                          fontFamily:
                            "var(--font-sport), var(--font-body), system-ui",
                          fontSize: 24,
                          fontWeight: 400,
                        }}
                      >{p.displayName || p.userId}</span>
                      {p.isManager && (
                        <span className="player-meta" title="Team Manager">
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="navy"
                            aria-hidden="true"
                          >
                            <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                          </svg>
                          Team Manager
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="roster-actions">
                  {isManager && (
                    <>
                      <button 
                        type="button" 
                        className="btn btn--outline btn--sm"
                        onClick={() => setInviteModal('code')}
                      >
                        Invite via Code
                      </button>
                    </>
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
              </div>
            )}
          </>
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

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/* Standings table styles */
const th: React.CSSProperties = { textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" };
const thCenter: React.CSSProperties = { textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" };
const td: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6" };
const tdCenter: React.CSSProperties = { padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center" };

/* ---------------- Invite Modal Component ---------------- */

function InviteModal({ 
  type, 
  teamId, 
  teamName, 
  onClose 
}: { 
  type: 'link' | 'code'; 
  teamId: string; 
  teamName: string; 
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ token?: string; code?: string; expiresIn?: number } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId,
          type,
          ttlHours,
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to create invite');
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inviteLink = result?.token 
    ? `${window.location.origin}/join?t=${result.token}` 
    : '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert('Copied to clipboard!');
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{type === 'link' ? 'Generate Invite Link' : 'Generate Invite Code'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {!result ? (
            <>
              <p className="modal-description">
                {type === 'link' 
                  ? 'Generate a one-time invite link. The invitee will be automatically added to the team when they click the link.'
                  : 'Generate a shareable code. The invitee must have an account and enter this code on their home page.'}
              </p>

              <div className="form-field">
                <label htmlFor="email">Email (optional)</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="invitee@example.com"
                />
              </div>

              <div className="form-field">
                <label htmlFor="phone">Phone (optional)</label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1234567890"
                />
              </div>

              <div className="form-field">
                <label htmlFor="ttl">Expires in</label>
                <select 
                  id="ttl" 
                  value={ttlHours} 
                  onChange={(e) => setTtlHours(Number(e.target.value))}
                >
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours (recommended)</option>
                  <option value={48}>48 hours</option>
                </select>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button 
                  className="btn btn--outline" 
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn--primary" 
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="success-message">
                ✅ {type === 'link' ? 'Invite link' : 'Invite code'} generated successfully!
                <br />
                Expires in {result.expiresIn} hours.
              </div>

              {type === 'link' && inviteLink && (
                <div className="form-field">
                  <label>Invite Link</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input 
                      type="text" 
                      value={inviteLink} 
                      readOnly 
                      style={{ flex: 1 }}
                    />
                    <button 
                      className="btn btn--outline btn--sm"
                      onClick={() => copyToClipboard(inviteLink)}
                    >
                      Copy
                    </button>
                  </div>
                  <small style={{ color: 'var(--muted)', marginTop: 4 }}>
                    Share this link with the person you want to invite. It's a one-time use link.
                  </small>
                </div>
              )}

              {type === 'code' && result.code && (
                <div className="form-field">
                  <label>Invite Code</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <code style={{ 
                      fontSize: 24, 
                      fontWeight: 'bold', 
                      padding: 12, 
                      background: 'var(--bg-secondary, #f5f5f5)',
                      borderRadius: 4,
                      flex: 1,
                      textAlign: 'center',
                      letterSpacing: 2,
                    }}>
                      {result.code}
                    </code>
                    <button 
                      className="btn btn--outline btn--sm"
                      onClick={() => copyToClipboard(result.code!)}
                    >
                      Copy
                    </button>
                  </div>
                  <small style={{ color: 'var(--muted)', marginTop: 4 }}>
                    Share this code with the person you want to invite. They must enter it on their home page.
                  </small>
                </div>
              )}

              {(email || phone) && (
                <div className="info-message" style={{ marginTop: 12 }}>
                  📧 Invite for: {email || phone}
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn--primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
          )}
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
          margin-bottom: 20px;
          color: #666;
        }

        .form-field {
          margin-bottom: 16px;
        }

        .form-field label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-field input:focus,
        .form-field select:focus {
          outline: none;
          border-color: #4CAF50;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .success-message {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .info-message {
          background: #e3f2fd;
          color: #1565c0;
          padding: 12px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}

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
          <h2>Assign New Team Manager</h2>
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