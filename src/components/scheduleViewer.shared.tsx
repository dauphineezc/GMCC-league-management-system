// Shared schedule viewer component - eliminates duplication between client and server versions
import React from 'react';

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

type Props = {
  pdfInfo: PDFInfo | null;
  scheduledGames: Game[];
  leagueId: string;
  onDownloadPDF?: () => void; // For client-side
  downloadHref?: string; // For server-side
};

export function ScheduleViewerShared({ pdfInfo, scheduledGames, onDownloadPDF, downloadHref }: Props) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const renderDownloadButton = () => {
    if (onDownloadPDF) {
      return (
        <button
          onClick={onDownloadPDF}
          className="btn btn--secondary text-sm btn--sm"
        >
          Download Schedule PDF
        </button>
      );
    }
    
    if (downloadHref) {
      return (
        <a
          href={downloadHref}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn--secondary text-sm btn--sm"
        >
          Download Schedule PDF
        </a>
      );
    }
    
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Desktop Table */}
      <div className="schedule-desktop">
        <div className="card--soft rounded-2xl border overflow-hidden">
          {pdfInfo && (
            <div className="p-3 border-b" style={{ paddingBottom: 20 }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {renderDownloadButton()}
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
          )}
          
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

      {/* Mobile Cards */}
      <div className="schedule-mobile">
        {pdfInfo && (
          <div className="card--soft p-3 rounded-2xl border mb-4">
            <div className="flex items-center justify-between gap-4">
              {renderDownloadButton()}
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
        )}
        
        <ul className="roster-list">
          {scheduledGames.map((game, idx) => (
            <li key={game.id}>
              <div style={{ 
                padding: "12px 16px",
                borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--navy)", marginBottom: "2px" }}>
                      {formatDate(game.dateTimeISO)} at {formatTime(game.dateTimeISO)}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>
                      {game.location}
                    </div>
                  </div>
                  <span style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--navy)",
                    background: game.status === 'completed' ? "var(--light-blue)" : "var(--gray-100)",
                    padding: "4px 8px",
                    borderRadius: "4px"
                  }}>
                    status: {game.status}
                  </span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px" }}>
                  <div style={{ flex: 1, textAlign: "center" }}>
                    <div style={{ fontWeight: 800, color: "var(--navy)" }}>
                      {game.homeTeamName}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--gray-600)" }}>Home</div>
                  </div>
                  <div style={{ margin: "0 12px", fontSize: "18px", fontWeight: 700, color: "var(--navy)" }}>vs</div>
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
    </div>
  );
}
