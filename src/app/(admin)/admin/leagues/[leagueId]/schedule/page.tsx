// src/app/(admin)/admin/leagues/[leagueId]/schedule/page.tsx
export const dynamic = "force-dynamic";

import ScheduleClient from "./scheduleClient";
import { readLeagueName } from "@/lib/readLeagueName";

export default async function ScheduleManagementPage({
  params,
}: {
  params: { leagueId: string };
}) {
  const leagueId = params.leagueId;
  const leagueName = await readLeagueName(leagueId);

  return <ScheduleClient leagueId={leagueId} leagueName={leagueName} />;
}
