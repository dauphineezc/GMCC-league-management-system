'use client';

import { useState, useCallback, useEffect } from 'react';
import { ScheduleViewerShared } from './scheduleViewer.shared';

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

  const fetchScheduleData = useCallback(async () => {
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
  }, [leagueId, teamId, teamName]);

  useEffect(() => {
    fetchScheduleData();
  }, [fetchScheduleData]);

  const downloadPDF = () => {
    if (pdfInfo) {
      window.open(`/api/leagues/${leagueId}/schedule/pdf`, '_blank');
    }
  };

  // Separate games into upcoming/scheduled vs completed
  const now = new Date();
  const scheduledGames = games.filter(game => {
    const gameDate = new Date(game.dateTimeISO);
    const status = (game.status || '').toLowerCase();
    // Show as scheduled if: future date OR status is explicitly 'scheduled'
    return gameDate >= now || status === 'scheduled';
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
        <div className="card--soft rounded-2xl border overflow-hidden">
        <div className="p-3 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button onClick={downloadPDF} className="btn btn--light btn--sm">
                    Download Schedule PDF
                  </button>
                  <span 
                    className="whitespace-nowrap"
                    style={{ 
                      fontSize: '12px', 
                      color: '#9CA3AF',
                      fontWeight: '400',
                      marginLeft: 10,
                    }}
                  >
                    Updated {new Date(pdfInfo.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
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
            <p>Your browser doesn&apos;t support PDF viewing. 
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
    <ScheduleViewerShared
      pdfInfo={pdfInfo}
      scheduledGames={scheduledGames}
      leagueId={leagueId}
      onDownloadPDF={downloadPDF}
    />
  );
}
