// Unified Results Management Page (Admin-only)
// Uses new permission system for consistency
export const dynamic = "force-dynamic";

import ResultsClient from "./resultsClient";
import { readLeagueName } from "@/lib/readLeagueName";
import { getServerUser } from "@/lib/serverUser";
import { hasLeaguePermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";

export default async function ResultsPage({
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

  return <ResultsClient leagueId={leagueId} leagueName={leagueName} />;
}