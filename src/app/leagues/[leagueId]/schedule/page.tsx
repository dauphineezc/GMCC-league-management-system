// Unified Schedule Management Page (Admin-only)
// Uses new permission system for consistency
// OPTIMIZED: Allow caching since this is a read page
export const revalidate = 30;

import ScheduleClient from "./scheduleClient";
import { readLeagueName } from "@/lib/readLeagueName";
import { getServerUser } from "@/lib/serverUser";
import { hasLeaguePermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";

export default async function LeagueSchedulePage({
  params,
}: {
  params: { leagueId: string };
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  
  // Use new permission system
  const isAuthorized = await hasLeaguePermission(user, params.leagueId, "admin");
  if (!isAuthorized) {
    notFound(); // More appropriate than redirect with error
  }

  const leagueId = params.leagueId;
  const leagueName = await readLeagueName(leagueId);

  return <ScheduleClient leagueId={leagueId} leagueName={leagueName} />;
}