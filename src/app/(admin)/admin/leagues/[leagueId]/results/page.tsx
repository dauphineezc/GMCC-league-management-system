// src/app/(admin)/admin/leagues/[leagueId]/schedule/page.tsx
export const dynamic = "force-dynamic";

import ResultsClient from "./resultsClient";
import { readLeagueName } from "@/lib/readLeagueName";

export default async function ScheduleManagementPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const leagueId = params.leagueId;
  const leagueName = await readLeagueName(leagueId);

  return <ResultsClient leagueId={leagueId} leagueName={leagueName} />;
}