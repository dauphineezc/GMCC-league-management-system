export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import SendAnnouncementClient from "./client";

type LeaguePlayerRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paymentStatus?: "PAID" | "UNPAID";
};

async function isAdminOfLeague(userId: string, leagueId: string) {
  // lightweight check for gating the page itself
  try {
    const inPerLeagueSet = await kv.sismember<string>(`league:${leagueId}:admins`, userId);
    if (inPerLeagueSet) return true;
  } catch {}
  try {
    const isMember = await kv.sismember<string>(`admin:${userId}:leagues`, leagueId);
    if (isMember) return true;
  } catch {}
  return false;
}

export default async function SendAnnouncementPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await getServerUser();
  if (!user) redirect("/login");
  const ok = await isAdminOfLeague(user.id, leagueId);
  if (!ok) redirect(`/leagues/${leagueId}`);

  // quick counts for the UI
  const leaguePlayersKey = `league:${leagueId}:players`;
  const leaguePlayers = (await kv.get<LeaguePlayerRow[]>(leaguePlayersKey)) ?? [];
  const totals = {
    all: leaguePlayers.length,
    managers: leaguePlayers.filter((p) => p.isManager).length,
    paid: leaguePlayers.filter((p) => p.paymentStatus === "PAID").length,
    unpaid: leaguePlayers.filter((p) => p.paymentStatus === "UNPAID").length,
    // Calculate intersections
    managersPaid: leaguePlayers.filter((p) => p.isManager && p.paymentStatus === "PAID").length,
    managersUnpaid: leaguePlayers.filter((p) => p.isManager && p.paymentStatus === "UNPAID").length,
  };

  return (
    <SendAnnouncementClient 
      leagueId={leagueId}
      totals={totals}
    />
  );
}