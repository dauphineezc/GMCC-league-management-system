// Server-side schedule viewer - eliminates client-side fetch latency
import { kv } from "@vercel/kv";
import { parseArrayFromKV } from "@/lib/kvBatch";

type Props = {
  leagueId: string;
  teamId?: string;
  teamName?: string;
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

async function getPDFInfo(leagueId: string): Promise<PDFInfo | null> {
  try {
    const key = `league:${leagueId}:schedule:pdf`;
    const raw = await kv.hgetall(key);
    
    if (!raw || typeof raw !== 'object') return null;
    
    const info = raw as any;
    if (info.filename && info.size && info.uploadedAt) {
      return {
        filename: String(info.filename),
        size: Number(info.size),
        uploadedAt: String(info.uploadedAt),
      };
    }
  } catch (err) {
    console.error('Error fetching PDF info:', err);
  }
  return null;
}

async function getGames(leagueId: string, teamFilter?: string): Promise<Game[]> {
  try {
    const key = `league:${leagueId}:games`;
    const raw = await kv.get(key);
    const games = parseArrayFromKV<Game>(raw);
    
    if (teamFilter) {
      return games.filter(
        (g) =>
          g.homeTeamName === teamFilter ||
          g.awayTeamName === teamFilter ||
          (g as any).homeTeamId === teamFilter ||
          (g as any).awayTeamId === teamFilter
      );
    }
    
    return games;
  } catch (err) {
    console.error('Error fetching games:', err);
    return [];
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatTime(dateString: string) {
  return new Date(dateString).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default async function ScheduleViewerServer({ leagueId, teamId, teamName }: Props) {
  // Fetch data in parallel on the server
  const [pdfInfo, games] = await Promise.all([
    getPDFInfo(leagueId),
    getGames(leagueId, teamName || teamId),
  ]);

  // Separate games into scheduled vs completed
  const now = new Date();
  const scheduledGames = games.filter(game => {
    const gameDate = new Date(game.dateTimeISO);
    const status = (game.status || '').toLowerCase();
    return gameDate >= now || status === 'scheduled';
  });
  
  const completedGames = games.filter(game => {
    const status = (game.status || '').toLowerCase();
    return status === 'completed' || status === 'final';
  });

  // No schedule data at all
  if (!pdfInfo && scheduledGames.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500">No upcoming game.</div>
      </div>
    );
  }

  // Case 1: PDF only, no manual scheduled games
  if (pdfInfo && scheduledGames.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card--soft p-4 rounded-2xl border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">📄 Schedule</h3>
              <p className="text-xs text-gray-500">
                Updated {new Date(pdfInfo.uploadedAt).toLocaleDateString()}
              </p>
            </div>
            <a
              href={`/api/leagues/${leagueId}/schedule/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--secondary text-sm"
            >
              Download PDF
            </a>
          </div>
        </div>

        <div className="card--soft rounded-2xl border overflow-hidden">
          <iframe
            src={`/api/leagues/${leagueId}/schedule/pdf?t=${Date.now()}`}
            width="100%"
            height="600"
            style={{ border: 'none' }}
            title={`Schedule: ${pdfInfo.filename}`}
          >
            <p>Your browser doesn't support PDF viewing. 
              <a href={`/api/leagues/${leagueId}/schedule/pdf`} className="text-blue-600 underline ml-1">
                Download the PDF
              </a>
            </p>
          </iframe>
        </div>
      </div>
    );
  }

  // Case 2 & 3: Manual games (with or without PDF)
  return (
    <div className="space-y-4">
      <div className="card--soft rounded-2xl border overflow-hidden">
        {pdfInfo && (
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <a
                href={`/api/leagues/${leagueId}/schedule/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn--secondary text-sm"
              >
                Download PDF Schedule
              </a>
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
  );
}

