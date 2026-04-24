// Redirect to unified league page
// This route is deprecated - all users now use /leagues/[leagueId]
import { redirect } from "next/navigation";

export default async function AdminLeagueRedirect({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  redirect(`/leagues/${leagueId}`);
}