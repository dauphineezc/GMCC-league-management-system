// Redirect to unified team page
// This route is deprecated - all users now use /team/[teamId]
import { redirect } from "next/navigation";

export default function SuperadminTeamRedirect({ params }: { params: { teamId: string } }) {
  redirect(`/team/${params.teamId}`);
}
