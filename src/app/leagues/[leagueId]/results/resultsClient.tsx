// src/app/leagues/[leagueId]/results/resultsClient.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from "next/link";

type Game = {
  id: string;
  leagueId: string;
  dateTimeISO?: string;
  location?: string;
  homeTeamName?: string;
  awayTeamName?: string;
  status?: string;
  homeScore?: number;
  awayScore?: number;
};

const COMPLETION_GRACE_MINUTES = 120;

export default function ResultsClient({ 
  leagueId,
  leagueName,
}: {
  leagueId: string;
  leagueName: string;
}) {

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchCompletedGames();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  async function fetchCompletedGames() {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule?ts=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) {
        setGames([]);
        return;
      }
      const allGames: Game[] = (await res.json()).filter(Boolean);

      const completed = allGames.filter((g) => {
        const status = String(g.status || '').toLowerCase();
        // Show games with "final" or "completed" status, but NOT "canceled"
        if (status === 'final' || status === 'completed') return true;

        // Don't show scheduled or canceled games in game history
        return false;
      });

      completed.sort((a, b) => {
        const ta = a.dateTimeISO ? new Date(a.dateTimeISO).getTime() : 0;
        const tb = b.dateTimeISO ? new Date(b.dateTimeISO).getTime() : 0;
        return tb - ta; // most recent first
      });

      setGames(completed);
    } catch (err) {
      console.error('Error fetching completed games:', err);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const formatResult = (game: Game) => {
    if (game.homeScore != null && game.awayScore != null) {
      return `${game.homeScore}-${game.awayScore}`;
    }
    return '--';
  };

  const startEditing = (game: Game) => {
    setEditingGame({
      id: game.id,
      homeScore: game.homeScore?.toString() || '',
      awayScore: game.awayScore?.toString() || ''
    });
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingGame(null);
    setMessage(null);
  };

  const saveResult = async () => {
    if (!editingGame) return;

    const homeScore = parseInt(editingGame.homeScore);
    const awayScore = parseInt(editingGame.awayScore);

    // Validate scores
    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
      setMessage('Please enter valid scores (0 or positive numbers)');
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/games/${editingGame.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          homeScore,
          awayScore
        })
      });

      if (res.ok) {
        setMessage('Result saved successfully!');
        setEditingGame(null);
        // Refresh the games list to show updated result
        setTimeout(() => {
          fetchCompletedGames();
          setMessage(null);
        }, 1000);
      } else {
        const error = await res.text();
        setMessage(`Failed to save result: ${error}`);
      }
    } catch (err) {
      console.error('Error saving result:', err);
      setMessage('Failed to save result. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleScoreChange = (field: 'homeScore' | 'awayScore', value: string) => {
    if (!editingGame) return;
    
    // Only allow numbers - allow up to 3 digits
    if (value === '' || /^\d{1,3}$/.test(value)) {
      setEditingGame({
        ...editingGame,
        [field]: value
      });
    }
  };

  if (loading) {
    return (
      <main style={{ display: "grid", gap: 16, maxWidth: 980, margin: "0 auto", padding: 16 }}>
        <div className="p-4 text-center">
          <div className="text-gray-500">Loading game results...</div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ display: "grid", gap: 16, maxWidth: 980, margin: "0 auto", padding: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">Game Results: {leagueName}</h1>
        </div>
      </header>

      {message && (
        <div className={`p-3 rounded-lg ${message.includes('Failed') || message.includes('error') 
          ? 'bg-red-100 text-red-700' 
          : 'bg-green-100 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-header">Completed Games</h3>
        </div>

        {games.length === 0 ? (
          <div className="p-4 text-center">
            <div className="text-gray-500">No completed games yet.</div>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="results-desktop">
              <div className="overflow-x-auto rounded-2xl border">
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Date</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Time</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Home Team</th>
                      <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Away Team</th>
                      <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Results</th>
                      <th style={{ textAlign: "center", padding: "6px 8px", borderBottom: "1px solid #eee", width: "100px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => (
                      <tr key={game.id}>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                          {formatDate(game.dateTimeISO ?? "")}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                          {formatTime(game.dateTimeISO ?? "")}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                          {game.homeTeamName}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                          {game.awayTeamName}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center", marginLeft: "-30px" }}>
                          {editingGame?.id === game.id ? (
                            <div className="flex items-center justify-center gap-2">
                              <input
                                type="text"
                                value={editingGame.homeScore}
                                onChange={(e) => handleScoreChange('homeScore', e.target.value)}
                                className="input"
                                style={{ width: '50px', textAlign: 'center', padding: '6px' }}
                                placeholder="0"
                                maxLength={3}
                              />
                              <span> - </span>
                              <input
                                type="text"
                                value={editingGame.awayScore}
                                onChange={(e) => handleScoreChange('awayScore', e.target.value)}
                                className="input"
                                style={{ width: '50px', textAlign: 'center', padding: '6px' }}
                                placeholder="0"
                                maxLength={3}
                              />
                            </div>
                          ) : (
                            formatResult(game)
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6", textAlign: "center" }}>
                          {editingGame?.id === game.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={saveResult}
                                disabled={saving}
                                className="px-2 py-1 text-xs rounded disabled:opacity-50"
                                style={{ 
                                  color: 'var(--navy)',
                                  border: 'none'
                                }}
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={saving}
                                className="px-2 py-1 text-xs rounded disabled:opacity-50"
                                style={{ 
                                  color: 'var(--navy)',
                                  border: 'none'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => startEditing(game)}
                              className="p-1 rounded transition-colors"
                              style={{ color: 'var(--navy)', backgroundColor: 'transparent' }}
                              title="Edit result"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
                              </svg>
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Mobile cards */}
            <div className="results-mobile">
              <ul className="roster-list">
                {games.map((game, index) => (
                  <li key={game.id} style={{ borderBottom: index < games.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div className="player-card" style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--navy)", marginBottom: "2px" }}>
                            {formatDate(game.dateTimeISO ?? "")} at {formatTime(game.dateTimeISO ?? "")}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                            {game.location || "Location TBD"}
                          </div>
                        </div>
                        {editingGame?.id === game.id ? (
                          <div style={{ display: "flex", maxWidth: "100px", gap: "2px", alignItems: "center", flexWrap: "wrap" }}>
                            <button
                              onClick={saveResult}
                              disabled={saving}
                              className="px-1 py-1 text-xs rounded disabled:opacity-50"
                              style={{ 
                                color: 'var(--navy)',
                                border: '1px solid var(--navy)',
                                backgroundColor: 'transparent',
                                fontSize: '10px',
                                padding: '2px 4px',
                                minWidth: 'auto'
                              }}
                            >
                              {saving ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={cancelEditing}
                              disabled={saving}
                              className="px-1 py-1 text-xs rounded disabled:opacity-50"
                              style={{ 
                                color: 'var(--navy)',
                                border: '1px solid var(--navy)',
                                backgroundColor: 'transparent',
                                fontSize: '10px',
                                padding: '2px 4px',
                                minWidth: 'auto'
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(game)}
                            className="p-1 rounded transition-colors"
                            style={{ color: 'var(--navy)', backgroundColor: 'transparent' }}
                            title="Edit result"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", marginTop: "8px" }}>
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontWeight: 800, color: "var(--navy)" }}>
                            {game.homeTeamName}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>Home</div>
                        </div>
                        <div style={{ fontWeight: 800, color: "var(--navy)", display: "flex", alignItems: "center", gap: "8px" }}>
                          {editingGame?.id === game.id ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", padding: "2px 4px" }}>
                              <input
                                type="text"
                                value={editingGame.homeScore}
                                onChange={(e) => handleScoreChange('homeScore', e.target.value)}
                                placeholder="0"
                                maxLength={3}
                                className="input score-input-mobile"
                                style={{ textAlign: 'center' }}
                              />
                              <span style={{ fontSize: "10px" }}>-</span>
                              <input
                                type="text"
                                value={editingGame.awayScore}
                                onChange={(e) => handleScoreChange('awayScore', e.target.value)}
                                placeholder="0"
                                maxLength={3}
                                className="input score-input-mobile"
                                style={{ textAlign: 'center' }}
                              />
                            </div>
                          ) : (
                            <span style={{ fontSize: "16px", fontWeight: "800" }}>
                              {formatResult(game)}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <div style={{ fontWeight: 800, color: "var(--navy)" }}>
                            {game.awayTeamName}
                          </div>
                          <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>Away</div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </main>
  );
}