// Unified Results Management Page (Admin-only)
// Uses new permission system for consistency
export const revalidate = 30;

import ResultsClient from "./resultsClient";
import { readLeagueName } from "@/lib/readLeagueName";
import { readLeagueDoc } from "@/lib/kvHelpers";
import { getServerUser } from "@/lib/serverUser";
import { hasLeaguePermission } from "@/lib/permissions";
import { redirect, notFound } from "next/navigation";

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  const { leagueId } = await params;

  const isAuthorized = await hasLeaguePermission(user, leagueId, "admin");
  if (!isAuthorized) {
    notFound();
  }
  const [leagueName, leagueDoc] = await Promise.all([
    readLeagueName(leagueId),
    readLeagueDoc(leagueId),
  ]);

  return (
    <ResultsClient
      leagueId={leagueId}
      leagueName={leagueName}
      sport={typeof leagueDoc?.sport === "string" ? leagueDoc.sport : null}
    />
  );
}
