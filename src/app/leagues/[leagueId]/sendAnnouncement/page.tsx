// src/app/leagues/[leagueId]/sendAnnouncement/page.tsx
export const runtime = "nodejs";
export const revalidate = 30;

import { redirect } from "next/navigation";
import { getServerUser, isLeagueAdminAsync } from "@/lib/serverUser";
import { getTeamsForLeague } from "@/lib/kvHelpers";
import { getLeaguePlayerRows } from "@/lib/repositories/teamsRepo";
import SendAnnouncementClient from "./client";

export default async function SendAnnouncementPage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = await params;
  const user = await getServerUser();
  if (!user) redirect("/login");

  const ok = await isLeagueAdminAsync(user, leagueId);
  if (!ok) redirect(`/leagues/${leagueId}`);

  const leaguePlayers = await getLeaguePlayerRows(leagueId);
  const totals = {
    all: leaguePlayers.length,
    managers: leaguePlayers.filter((p) => p.isManager).length,
    paid: leaguePlayers.filter((p) => p.paymentStatus === "PAID").length,
    unpaid: leaguePlayers.filter((p) => p.paymentStatus === "UNPAID").length,
    managersPaid: leaguePlayers.filter(
      (p) => p.isManager && p.paymentStatus === "PAID"
    ).length,
    managersUnpaid: leaguePlayers.filter(
      (p) => p.isManager && p.paymentStatus === "UNPAID"
    ).length,
  };

  const teams = (await getTeamsForLeague(leagueId)).map((t) => ({
    id: t.teamId,
    name: t.name,
  }));

  return (
    <SendAnnouncementClient leagueId={leagueId} totals={totals} teams={teams} />
  );
}
