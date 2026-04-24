// Redirect to unified team page
// This route is deprecated - all users now use /team/[teamId]
import { redirect } from "next/navigation";

export default async function AdminTeamRedirect({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  redirect(`/team/${teamId}`);
}
