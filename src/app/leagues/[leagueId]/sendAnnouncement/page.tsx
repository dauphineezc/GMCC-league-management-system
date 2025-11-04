// src/app/leagues/[leagueId]/sendAnnouncement/page.tsx

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { getServerUser, isLeagueAdminAsync } from "@/lib/serverUser";
import SendAnnouncementClient from "./client";

type LeaguePlayerRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paymentStatus?: "PAID" | "UNPAID";
};

type TeamOption = {
  id: string;
  name: string;
};

async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers(key)) as unknown;
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  } catch {
    /* ignore WRONGTYPE or other errors */
  }
  return [];
}

async function getTeamsForLeague(leagueId: string): Promise<TeamOption[]> {
  // Get team IDs from the league:teams set
  const teamIds = await smembersSafe(`league:${leagueId}:teams`);
  
  // If no teams found in set, fallback to inferring from players
  let ids = teamIds;
  if (ids.length === 0) {
    const players = (await kv.get<LeaguePlayerRow[]>(`league:${leagueId}:players`)) ?? [];
    ids = Array.from(new Set(players.map(p => p.teamId).filter(Boolean)));
  }
  
  // Fetch team details
  const teams: TeamOption[] = [];
  await Promise.all(
    ids.map(async (id) => {
      const team = await kv.get<any>(`team:${id}`);
      teams.push({
        id,
        name: team?.name ?? id,
      });
    })
  );
  
  return teams.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export default async function SendAnnouncementPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await getServerUser();
  if (!user) redirect("/login");
  const ok = await isLeagueAdminAsync(user, leagueId);
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
  
  // Fetch teams for the league
  const teams = await getTeamsForLeague(leagueId);

  return (
    <SendAnnouncementClient 
      leagueId={leagueId}
      totals={totals}
      teams={teams}
    />
  );
}