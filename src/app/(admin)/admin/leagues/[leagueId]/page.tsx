// Redirect to unified league page
// This route is deprecated - all users now use /leagues/[leagueId]
import { redirect } from "next/navigation";

export default function AdminLeagueRedirect({ params }: { params: { leagueId: string } }) {
  redirect(`/leagues/${params.leagueId}`);
}