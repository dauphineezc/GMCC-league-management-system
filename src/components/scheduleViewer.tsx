'use client';

import { useState, useEffect } from 'react';

type Props = {
  leagueId: string;
  teamId?: string; // Optional: filter games for specific team
  teamName?: string; // Optional: display name for team
};

type PDFInfo = {
  filename: string;
  size: number;
  uploadedAt: string;
};

type Game = {
  id: string;
  dateTimeISO: string;
  homeTeamName: string;
  awayTeamName: string;
  location: string;
  status: string;
};

export default function ScheduleViewer({ leagueId, teamId, teamName }: Props) {
  const [pdfInfo, setPdfInfo] = useState<PDFInfo | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchScheduleData();
  }, [leagueId, teamId]);

  const fetchScheduleData = async () => {
    try {
      // Fetch both PDF info and manual games
      const [pdfRes, gamesRes] = await Promise.all([
        fetch(`/api/leagues/${leagueId}/schedule/pdf-info`),
        fetch(`/api/leagues/${leagueId}/schedule${teamId ? `?team=${teamName || teamId}` : ''}`)
      ]);
      
      // Check for PDF
      if (pdfRes.ok) {
        const info = await pdfRes.json();
        setPdfInfo(info);
      } else {
        setPdfInfo(null);
      }
      
      // Check for manual games
      if (gamesRes.ok) {
        const gamesData = await gamesRes.json();
        setGames(Array.isArray(gamesData) ? gamesData : []);
      } else {
        setGames([]);
      }
    } catch (err) {
      console.error('Error fetching schedule data:', err);
      setError('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    if (pdfInfo) {
      window.open(`/api/leagues/${leagueId}/schedule/pdf`, '_blank');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  // Separate games into upcoming/scheduled vs completed
  const now = new Date();
  const scheduledGames = games.filter(game => {
    const gameDate = new Date(game.dateTimeISO);
    const status = (game.status || '').toLowerCase();
    // Show as scheduled if: future date OR status is explicitly 'scheduled'
    return gameDate >= now || status === 'scheduled';
  });
  
  const completedGames = games.filter(game => {
    const gameDate = new Date(game.dateTimeISO);
    const status = (game.status || '').toLowerCase();
    // Show as completed if: status is 'completed' or 'final'
    return status === 'completed' || status === 'final';
  });

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500">Loading schedule...</div>
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

  // No schedule data at all
  if (!pdfInfo && scheduledGames.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500">No upcoming game.</div>
      </div>
    );
  }

  // Case 1: PDF only, no manual scheduled games - show embedded PDF
  if (pdfInfo && scheduledGames.length === 0) {
    return (
      <div className="space-y-4">
        {/* PDF Info Header */}
        <div className="card--soft p-4 rounded-2xl border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">📄 Schedule</h3>
              <p className="text-xs text-gray-500">
                Updated {new Date(pdfInfo.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={downloadPDF}
              className="btn btn--secondary text-sm"
            >
              Download PDF
            </button>
          </div>
        </div>

        {/* Embedded PDF Viewer */}
        <div className="card--soft rounded-2xl border overflow-hidden">
          <iframe
            src={`/api/leagues/${leagueId}/schedule/pdf?t=${Date.now()}`}
            width="100%"
            height="600"
            style={{ border: 'none' }}
            title={`Schedule: ${pdfInfo.filename}`}
          >
            <p>Your browser doesn't support PDF viewing. 
              <button onClick={downloadPDF} className="text-blue-600 underline ml-1">
                Download the PDF
              </button>
            </p>
          </iframe>
        </div>
      </div>
    );
  }

  // Case 2 & 3: Manual games (with or without PDF) - show games table
  return (
    <div className="space-y-4">
      {/* Games Table */}
      <div className="card--soft rounded-2xl border overflow-hidden">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {/* Case 3: Show PDF download button if both exist */}
            {pdfInfo && (
              <button
                onClick={downloadPDF}
                className="btn btn--secondary text-sm"
              >
                Download PDF Schedule
              </button>
            )}
          </div>
        </div>
        
        <div className="overflow-x-auto rounded-2xl border">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Date</th>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Time</th>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Home Team</th>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Away Team</th>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Court</th>
                <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #eee" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {scheduledGames.map((game) => (
                <tr key={game.id}>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{formatDate(game.dateTimeISO)}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{formatTime(game.dateTimeISO)}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{game.homeTeamName}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{game.awayTeamName}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{game.location}</td>
                  <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>{game.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
