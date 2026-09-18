'use client';

import { useState, useCallback, useEffect } from 'react';
import { formatGameDate, formatGameTime } from '@/lib/gameDateTime';

type Props = {
  leagueId: string;
  teamId?: string;
  teamName?: string;
  sport?: string | null;
};

type Game = {
  id: string;
  dateTimeISO: string;
  homeTeamName: string;
  awayTeamName: string;
  location: string;
  status: string;
  homeScore?: number;
  awayScore?: number;
  setScores?: Array<{ homeScore: number; awayScore: number }> | null;
};

export default function GameHistory({ leagueId, teamId, teamName, sport }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompletedGames = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/leagues/${leagueId}/schedule${teamId ? `?team=${teamName || teamId}` : ''}`
      );

      if (res.ok) {
        const gamesData = await res.json();
        const allGames = Array.isArray(gamesData) ? gamesData : [];

        const completedGames = allGames.filter((game) => {
          const status = (game.status || '').toLowerCase();
          return status === 'completed' || status === 'final';
        });

        setGames(completedGames);
      } else {
        setGames([]);
      }
    } catch (err) {
      console.error('Error fetching completed games:', err);
      setError('Failed to load game history');
    } finally {
      setLoading(false);
    }
  }, [leagueId, teamId, teamName]);

  useEffect(() => {
    fetchCompletedGames();
  }, [fetchCompletedGames]);

  const formatDate = (dateString: string) => formatGameDate(dateString);
  const formatTime = (dateString: string) => formatGameTime(dateString);

  const isVolleyballResult = (game: Game) =>
    (sport || '').toLowerCase() === 'volleyball' ||
    (Array.isArray(game.setScores) && game.setScores.length === 3);

  /** True when this history view is filtered to a specific team. */
  const focusTeamName = (teamName || '').trim().toLowerCase();

  const setOutcomeLabel = (
    game: Game,
    set: { homeScore: number; awayScore: number }
  ): { label: string; homeWon: boolean | null } => {
    if (set.homeScore === set.awayScore) {
      return { label: 'T', homeWon: null };
    }
    const homeWon = set.homeScore > set.awayScore;

    if (focusTeamName) {
      const isHome =
        (game.homeTeamName || '').trim().toLowerCase() === focusTeamName;
      const isAway =
        (game.awayTeamName || '').trim().toLowerCase() === focusTeamName;
      if (isHome) return { label: homeWon ? 'W' : 'L', homeWon };
      if (isAway) return { label: homeWon ? 'L' : 'W', homeWon };
    }

    return {
      label: homeWon ? 'Home W' : 'Away W',
      homeWon,
    };
  };

  const formatResult = (game: Game) => {
    if (isVolleyballResult(game) && game.setScores && game.setScores.length === 3) {
      return (
        <div style={{ display: 'grid', gap: 2, fontSize: 12 }}>
          {game.setScores.map((s, i) => {
            const { label } = setOutcomeLabel(game, s);
            return (
              <div key={i}>
                Game {i + 1}: {label} · {s.homeScore}-{s.awayScore}
              </div>
            );
          })}
        </div>
      );
    }
    if (game.homeScore != null && game.awayScore != null) {
      return `${game.homeScore}-${game.awayScore}`;
    }
    return '--';
  };

  const getWinnerInfo = (game: Game) => {
    // Volleyball: highlight by games won (stored on match-level scores)
    if (game.homeScore != null && game.awayScore != null) {
      if (game.homeScore > game.awayScore) {
        return { winner: 'home', homeColor: 'var(--green)', awayColor: 'var(--navy)' };
      }
      if (game.awayScore > game.homeScore) {
        return { winner: 'away', homeColor: 'var(--navy)', awayColor: 'var(--green)' };
      }
      return { winner: 'tie', homeColor: 'var(--navy)', awayColor: 'var(--navy)' };
    }
    return { winner: 'unknown', homeColor: 'var(--navy)', awayColor: 'var(--navy)' };
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500">Loading game history...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (games.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500">No completed games yet.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="game-history-desktop">
        <div className="card--soft rounded-2xl border overflow-hidden">
          <div className="p-4 border-b" />

          <div className="overflow-x-auto rounded-2xl border">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Home Team</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Away Team</th>
                  <th style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #eee' }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const winnerInfo = getWinnerInfo(game);
                  return (
                    <tr key={game.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {formatDate(game.dateTimeISO)}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {formatTime(game.dateTimeISO)}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          borderBottom: '1px solid #f3f4f6',
                          color: winnerInfo.homeColor,
                          fontWeight: winnerInfo.winner === 'home' ? 600 : 400,
                        }}
                      >
                        {game.homeTeamName}
                      </td>
                      <td
                        style={{
                          padding: '6px 8px',
                          borderBottom: '1px solid #f3f4f6',
                          color: winnerInfo.awayColor,
                          fontWeight: winnerInfo.winner === 'away' ? 600 : 400,
                        }}
                      >
                        {game.awayTeamName}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>
                        {formatResult(game)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="game-history-mobile">
        <ul className="roster-list">
          {games.map((game, idx) => {
            const winnerInfo = getWinnerInfo(game);
            const volleyball = isVolleyballResult(game);
            return (
              <li key={game.id}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderTop: idx === 0 ? 'none' : '1px solid #f3f4f6',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 2 }}>
                        {formatDate(game.dateTimeISO)} at {formatTime(game.dateTimeISO)}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>{game.location}</div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: volleyball ? 'flex-start' : 'center',
                      fontSize: 14,
                      marginTop: 8,
                    }}
                  >
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: winnerInfo.homeColor }}>
                        {game.homeTeamName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Home</div>
                    </div>
                    <div style={{ fontWeight: 800, minWidth: volleyball ? 120 : undefined }}>
                      {volleyball && game.setScores ? (
                        formatResult(game)
                      ) : (
                        <>
                          <span style={{ fontWeight: 800, color: winnerInfo.homeColor }}>
                            {game.homeScore != null ? `${game.homeScore}` : ''}
                          </span>
                          <span style={{ fontWeight: 800, color: 'var(--navy)' }}> - </span>
                          <span style={{ fontWeight: 800, color: winnerInfo.awayColor }}>
                            {game.awayScore != null ? `${game.awayScore}` : ''}
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontWeight: 800, color: winnerInfo.awayColor }}>
                        {game.awayTeamName}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--gray-600)' }}>Away</div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
