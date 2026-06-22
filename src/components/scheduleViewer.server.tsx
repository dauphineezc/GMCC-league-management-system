// Server-side schedule viewer - eliminates client-side fetch latency
import { getLeagueScheduleView } from "@/lib/leagueData";
import { getSchedulePdfInfo } from "@/lib/repositories/schedulePdfsRepo";
import { ScheduleViewerShared } from "./scheduleViewer.shared";

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

export default async function ScheduleViewerServer({
  leagueId,
  teamId,
  teamName,
}: Props) {
  const teamFilter = teamName || teamId || "";

  const [pdfMeta, games] = await Promise.all([
    getSchedulePdfInfo(leagueId),
    getLeagueScheduleView(leagueId, teamFilter),
  ]);

  const pdfInfo: PDFInfo | null = pdfMeta
    ? {
        filename: pdfMeta.filename,
        size: pdfMeta.size ?? 0,
        uploadedAt: pdfMeta.uploadedAt,
      }
    : null;

  const now = new Date();
  const scheduledGames = games.filter((game) => {
    if (!game.dateTimeISO) return false;
    const gameDate = new Date(game.dateTimeISO);
    const status = (game.status || "").toLowerCase();
    return gameDate >= now || status === "scheduled";
  });

  if (!pdfInfo && scheduledGames.length === 0) {
    return (
      <div className="p-4 text-center">
        <div className="text-gray-500">No upcoming game.</div>
      </div>
    );
  }

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
            style={{ border: "none" }}
            title={`Schedule: ${pdfInfo.filename}`}
          >
            <p>
              Your browser doesn&apos;t support PDF viewing.
              <a
                href={`/api/leagues/${leagueId}/schedule/pdf`}
                className="text-blue-600 underline ml-1"
              >
                Download the PDF
              </a>
            </p>
          </iframe>
        </div>
      </div>
    );
  }

  return (
    <ScheduleViewerShared
      pdfInfo={pdfInfo}
      scheduledGames={scheduledGames}
      leagueId={leagueId}
      downloadHref={`/api/leagues/${leagueId}/schedule/pdf`}
    />
  );
}
