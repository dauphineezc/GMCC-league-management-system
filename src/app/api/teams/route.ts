// POST create team
import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { kv } from "@vercel/kv";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  const userId = requireUser();
  const { leagueId, name, description } = await req.json();

  const memberships = await kv.get<any[]>(`user:${userId}:memberships`) || [];
  if (memberships.some(m => m.leagueId === leagueId)) {
    return Response.json({ error: { code: "ALREADY_ON_TEAM", message: "Already on a team in this league." }}, { status: 400 });
  }

  const teamId = uuid();
  const now = new Date().toISOString();
  const team = { id: teamId, leagueId, name, description, managerUserId: userId, approved: false, rosterLimit: 8, createdAt: now, updatedAt: now };
  await kv.set(`team:${teamId}`, team);

  // public team card
  const card = { teamId, name, description };
  const teams = (await kv.get<any[]>(`league:${leagueId}:teams`)) || [];
  await kv.set(`league:${leagueId}:teams`, [...teams, card]);

  // teamIds index (admin)
  const ids = (await kv.get<string[]>(`league:${leagueId}:teamIds`)) || [];
  await kv.set(`league:${leagueId}:teamIds`, [...ids, teamId]);

  // roster with manager
  const roster = [{ userId, displayName: "You", isManager: true, joinedAt: now }];
  await kv.set(`team:${teamId}:roster`, roster);

  // user memberships
  await kv.set(`user:${userId}:memberships`, [...memberships, { leagueId, teamId, isManager: true }]);

  return Response.json({ teamId });
}
