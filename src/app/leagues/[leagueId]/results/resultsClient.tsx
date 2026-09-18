// src/app/leagues/[leagueId]/results/resultsClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { formatGameDate, formatGameTime } from '@/lib/gameDateTime';
import type { Sport } from '@/types/domain';

type SetScore = { homeScore: string; awayScore: string };

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
  setScores?: Array<{ homeScore: number; awayScore: number }> | null;
};

const emptySets = (): SetScore[] => [
  { homeScore: '', awayScore: '' },
  { homeScore: '', awayScore: '' },
  { homeScore: '', awayScore: '' },
];

export default function ResultsClient({
  leagueId,
  leagueName,
  sport,
}: {
  leagueId: string;
  leagueName: string;
  sport: Sport | string | null;
}) {
  const isVolleyball = (sport || '').toLowerCase() === 'volleyball';

  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGame, setEditingGame] = useState<{
    id: string;
    homeScore: string;
    awayScore: string;
    sets: SetScore[];
  } | null>(null);
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
        return status === 'final' || status === 'completed';
      });

      completed.sort((a, b) => {
        const ta = a.dateTimeISO ? new Date(a.dateTimeISO).getTime() : 0;
        const tb = b.dateTimeISO ? new Date(b.dateTimeISO).getTime() : 0;
        return tb - ta;
      });

      setGames(completed);
    } catch (err) {
      console.error('Error fetching completed games:', err);
      setGames([]);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string) => formatGameDate(dateString);
  const formatTime = (dateString: string) => formatGameTime(dateString);

  const formatResult = (game: Game) => {
    if (isVolleyball && game.setScores && game.setScores.length === 3) {
      return (
        <div style={{ display: 'grid', gap: 2, fontSize: 12, textAlign: 'left' }}>
          {game.setScores.map((s, i) => (
            <div key={i}>
              Game {i + 1}: {s.homeScore} - {s.awayScore}
            </div>
          ))}
        </div>
      );
    }
    if (game.homeScore != null && game.awayScore != null) {
      return `${game.homeScore}-${game.awayScore}`;
    }
    return '--';
  };

  const startEditing = (game: Game) => {
    const sets =
      game.setScores && game.setScores.length === 3
        ? game.setScores.map((s) => ({
            homeScore: String(s.homeScore),
            awayScore: String(s.awayScore),
          }))
        : emptySets();

    setEditingGame({
      id: game.id,
      homeScore: game.homeScore?.toString() || '',
      awayScore: game.awayScore?.toString() || '',
      sets,
    });
    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingGame(null);
    setMessage(null);
  };

  const saveResult = async () => {
    if (!editingGame) return;

    let body: Record<string, unknown>;

    if (isVolleyball) {
      const setScores = editingGame.sets.map((s) => ({
        homeScore: parseInt(s.homeScore, 10),
        awayScore: parseInt(s.awayScore, 10),
      }));
      if (
        setScores.some(
          (s) =>
            isNaN(s.homeScore) ||
            isNaN(s.awayScore) ||
            s.homeScore < 0 ||
            s.awayScore < 0
        )
      ) {
        setMessage('Please enter valid scores for all 3 games (0 or positive numbers)');
        return;
      }
      body = { setScores };
    } else {
      const homeScore = parseInt(editingGame.homeScore, 10);
      const awayScore = parseInt(editingGame.awayScore, 10);
      if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
        setMessage('Please enter valid scores (0 or positive numbers)');
        return;
      }
      body = { homeScore, awayScore };
    }

    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/games/${editingGame.id}/result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setMessage('Result saved successfully!');
        setEditingGame(null);
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
    if (value === '' || /^\d{1,3}$/.test(value)) {
      setEditingGame({ ...editingGame, [field]: value });
    }
  };

  const handleSetScoreChange = (
    setIndex: number,
    field: 'homeScore' | 'awayScore',
    value: string
  ) => {
    if (!editingGame) return;
    if (value !== '' && !/^\d{1,3}$/.test(value)) return;
    const sets = editingGame.sets.map((s, i) =>
      i === setIndex ? { ...s, [field]: value } : s
    );
    setEditingGame({ ...editingGame, sets });
  };

  const renderScoreEditor = () => {
    if (!editingGame) return null;
    if (isVolleyball) {
      return (
        <div style={{ display: 'grid', gap: 6 }}>
          {editingGame.sets.map((s, i) => (
            <div key={i} className="flex items-center justify-center gap-2">
              <span style={{ fontSize: 12, width: 56, textAlign: 'right' }}>Game {i + 1}:</span>
              <input
                type="text"
                value={s.homeScore}
                onChange={(e) => handleSetScoreChange(i, 'homeScore', e.target.value)}
                className="input"
                style={{ width: 50, textAlign: 'center', padding: 6 }}
                placeholder="0"
                maxLength={3}
              />
              <span> - </span>
              <input
                type="text"
                value={s.awayScore}
                onChange={(e) => handleSetScoreChange(i, 'awayScore', e.target.value)}
                className="input"
                style={{ width: 50, textAlign: 'center', padding: 6 }}
                placeholder="0"
                maxLength={3}
              />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center gap-2">
        <input
          type="text"
          value={editingGame.homeScore}
          onChange={(e) => handleScoreChange('homeScore', e.target.value)}
          className="input"
          style={{ width: 50, textAlign: 'center', padding: 6 }}
          placeholder="0"
          maxLength={3}
        />
        <span> - </span>
        <input
          type="text"
          value={editingGame.awayScore}
          onChange={(e) => handleScoreChange('awayScore', e.target.value)}
          className="input"
          style={{ width: 50, textAlign: 'center', padding: 6 }}
          placeholder="0"
          maxLength={3}
        />
      </div>
    );
  };

  const renderMobileScoreEditor = () => {
    if (!editingGame) return null;
    if (isVolleyball) {
      return (
        <div style={{ display: 'grid', gap: 4, padding: '2px 4px' }}>
          {editingGame.sets.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
              <span style={{ fontSize: 10, width: 44 }}>G{i + 1}:</span>
              <input
                type="text"
                value={s.homeScore}
                onChange={(e) => handleSetScoreChange(i, 'homeScore', e.target.value)}
                placeholder="0"
                maxLength={3}
                className="input score-input-mobile"
                style={{ textAlign: 'center' }}
              />
              <span style={{ fontSize: 10 }}>-</span>
              <input
                type="text"
                value={s.awayScore}
                onChange={(e) => handleSetScoreChange(i, 'awayScore', e.target.value)}
                placeholder="0"
                maxLength={3}
                className="input score-input-mobile"
                style={{ textAlign: 'center' }}
              />
            </div>
          ))}
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 4px' }}>
        <input
          type="text"
          value={editingGame.homeScore}
          onChange={(e) => handleScoreChange('homeScore', e.target.value)}
          placeholder="0"
          maxLength={3}
          className="input score-input-mobile"
          style={{ textAlign: 'center' }}
        />
        <span style={{ fontSize: 10 }}>-</span>
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
    );
  };

  if (loading) {
    return (
      <main style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto', padding: 16 }}>
        <div className="p-4 text-center">
          <div className="text-gray-500">Loading game results...</div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ display: 'grid', gap: 16, maxWidth: 980, margin: '0 auto', padding: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">Game Results: {leagueName}</h1>
          {isVolleyball && (
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--gray-600)' }}>
              Enter all three games for each match (played regardless of score).
            </p>
          )}
        </div>
      </header>

      {message && (
        <div
          className={`p-3 rounded-lg ${
            message.includes('Failed') || message.includes('error')
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
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
            <div className="results-desktop">
              <div className="overflow-x-auto rounded-2xl border">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Time</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Home Team</th>
                      <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Away Team</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Results</th>
                      <th style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #eee', width: 100 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map((game) => (
                      <tr key={game.id}>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                          {formatDate(game.dateTimeISO ?? '')}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                          {formatTime(game.dateTimeISO ?? '')}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                          {game.homeTeamName}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                          {game.awayTeamName}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                          {editingGame?.id === game.id ? renderScoreEditor() : formatResult(game)}
                        </td>
                        <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                          {editingGame?.id === game.id ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={saveResult}
                                disabled={saving}
                                className="px-2 py-1 text-xs rounded disabled:opacity-50"
                                style={{ color: 'var(--navy)', border: 'none' }}
                              >
                                {saving ? 'Saving...' : 'Save'}
                              </button>
                              <button
                                onClick={cancelEditing}
                                disabled={saving}
                                className="px-2 py-1 text-xs rounded disabled:opacity-50"
                                style={{ color: 'var(--navy)', border: 'none' }}
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

            <div className="results-mobile">
              <ul className="roster-list">
                {games.map((game, index) => (
                  <li
                    key={game.id}
                    style={{ borderBottom: index < games.length - 1 ? '1px solid #f3f4f6' : 'none' }}
                  >
                    <div className="player-card" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 2 }}>
                            {formatDate(game.dateTimeISO ?? '')} at {formatTime(game.dateTimeISO ?? '')}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>
                            {game.location || 'Location TBD'}
                          </div>
                        </div>
                        {editingGame?.id === game.id ? (
                          <div style={{ display: 'flex', maxWidth: 100, gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                              onClick={saveResult}
                              disabled={saving}
                              className="px-1 py-1 text-xs rounded disabled:opacity-50"
                              style={{
                                color: 'var(--navy)',
                                border: '1px solid var(--navy)',
                                backgroundColor: 'transparent',
                                fontSize: 10,
                                padding: '2px 4px',
                                minWidth: 'auto',
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
                                fontSize: 10,
                                padding: '2px 4px',
                                minWidth: 'auto',
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

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14, marginTop: 8 }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{game.homeTeamName}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Home</div>
                        </div>
                        <div style={{ fontWeight: 800, color: 'var(--navy)', display: 'flex', alignItems: 'center', gap: 8 }}>
                          {editingGame?.id === game.id ? (
                            renderMobileScoreEditor()
                          ) : (
                            <span style={{ fontSize: isVolleyball ? 12 : 16, fontWeight: 800 }}>
                              {formatResult(game)}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{game.awayTeamName}</div>
                          <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Away</div>
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
