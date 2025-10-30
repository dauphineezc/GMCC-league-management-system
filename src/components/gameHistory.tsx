'use client';

import { useState, useEffect } from 'react';

type Props = {
  leagueId: string;
  teamId?: string; // Optional: filter games for specific team
  teamName?: string; // Optional: display name for team
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
};

export default function GameHistory({ leagueId, teamId, teamName }: Props) {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCompletedGames();
  }, [leagueId, teamId]);

  const fetchCompletedGames = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule${teamId ? `?team=${teamName || teamId}` : ''}`);
      
      if (res.ok) {
        const gamesData = await res.json();
        const allGames = Array.isArray(gamesData) ? gamesData : [];
        
        // Filter for completed games only
        const completedGames = allGames.filter(game => {
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
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatResult = (game: Game) => {
    if (game.homeScore != null && game.awayScore != null) {
      return `${game.homeScore}-${game.awayScore}`;
    }
    return '--';
  };

  const getWinnerInfo = (game: Game) => {
    if (game.homeScore != null && game.awayScore != null) {
      if (game.homeScore > game.awayScore) {
        return { winner: 'home', homeColor: 'var(--green)', awayColor: 'var(--navy)' };
      } else if (game.awayScore > game.homeScore) {
        return { winner: 'away', homeColor: 'var(--navy)', awayColor: 'var(--green)' };
      } else {
        return { winner: 'tie', homeColor: 'var(--navy)', awayColor: 'var(--navy)' };
      }
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
      {/* Desktop table */}
      <div className="game-history-desktop">
        <div className="card--soft rounded-2xl border overflow-hidden">
          <div className="p-4 border-b">
          </div>
          
          <div className="overflow-x-auto rounded-2xl border">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Date</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Time</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Home Team</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Away Team</th>
                  <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Result</th>
                </tr>
              </thead>
              <tbody>
                {games.map((game) => {
                  const winnerInfo = getWinnerInfo(game);
                  return (
                    <tr key={game.id}>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{formatDate(game.dateTimeISO)}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{formatTime(game.dateTimeISO)}</td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6", color: winnerInfo.homeColor, fontWeight: winnerInfo.winner === 'home' ? 600 : 400 }}>
                        {game.homeTeamName}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6", color: winnerInfo.awayColor, fontWeight: winnerInfo.winner === 'away' ? 600 : 400 }}>
                        {game.awayTeamName}
                      </td>
                      <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{formatResult(game)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Mobile cards */}
      <div className="game-history-mobile">
        <ul className="roster-list">
          {games.map((game) => {
            const winnerInfo = getWinnerInfo(game);
            return (
              <li key={game.id}>
                <div className="player-card" style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--navy)", marginBottom: "2px" }}>
                        {formatDate(game.dateTimeISO)} at {formatTime(game.dateTimeISO)}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                        {game.location}
                      </div>
                    </div>
                    {/* {game.homeScore != null && game.awayScore != null && (
                      <span style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--navy)",
                        background: "var(--light-blue)",
                        padding: "4px 8px",
                        borderRadius: "4px"
                      }}>
                        {formatResult(game)}
                      </span> */}
                    {/* )} */}
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontWeight: 800, color: winnerInfo.homeColor }}>
                        {game.homeTeamName}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>Home</div>
                    </div>
                    <div style={{ fontWeight: 800, color: winnerInfo.homeColor }}>
                      <span style={{ fontWeight: 800, color: winnerInfo.homeColor }}>
                        {game.homeScore != null ? `${game.homeScore}` : ''}
                      </span>
                      <span style={{ fontWeight: 800, color: "var(--navy)" }}> - </span>
                      <span style={{ fontWeight: 800, color: winnerInfo.awayColor }}>
                        {game.awayScore != null ? `${game.awayScore}` : ''}
                      </span>
                    </div>
                    <div style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontWeight: 800, color: winnerInfo.awayColor }}>
                        {game.awayTeamName}
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>Away</div>
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
