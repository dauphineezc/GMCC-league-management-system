// src/app/api/teams/route.ts
import type { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { normalizeDivision } from "@/lib/divisions";
import { upsertMembership } from "@/server/memberships";
import { DIVISIONS } from "@/lib/divisions";

type Body = {
  name?: string;
  description?: string;
  leagueId?: string;       // preferred
  division?: string;       // alias
  divisionId?: string;     // alias
};

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }

  const body: Body = await req.json().catch(() => ({} as Body));
  const name = (body.name || "").trim();
  const description = (body.description || "").trim();

  const rawDiv =
    body.leagueId ??
    body.division ??
    body.divisionId ??
    "";

  const leagueId = normalizeDivision(String(rawDiv));
  if (!leagueId) {
    return Response.json(
      { error: { code: "BAD_LEAGUE", message: `Unknown league/division: ${rawDiv}` } },
      { status: 400 }
    );
  }
  if (!name) {
    return Response.json(
      { error: { code: "BAD_NAME", message: "Team name is required" } },
      { status: 400 }
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const team = {
    id,
    leagueId,                 // <-- IMPORTANT
    name,
    description,
    managerUserId: userId,
    approved: false,
    rosterLimit: 8,
    createdAt: now,
    updatedAt: now,
  };

  // Save team
  await kv.set(`team:${id}`, team);

  // Add to league lists
  const teamCards = (await kv.get<any[]>(`league:${leagueId}:teams`)) ?? [];
  const teamIds = (await kv.get<string[]>(`league:${leagueId}:teamIds`)) ?? [];
  await kv.set(`league:${leagueId}:teams`, [
    ...teamCards,
    { teamId: id, name, description },
  ]);
  await kv.set(`league:${leagueId}:teamIds`, [...teamIds, id]);

  // Initial roster: manager
  const roster = (await kv.get<any[]>(`team:${id}:roster`)) ?? [];
  await kv.set(`team:${id}:roster`, [
    ...roster,
    { userId, displayName: userId, isManager: true, joinedAt: now },
  ]);

  const leagueName = DIVISIONS.find(d => d.id === leagueId)?.name ?? leagueId;

  await upsertMembership(userId, {
    leagueId,
    teamId: id,
    isManager: true,
    teamName: name,
    leagueName,
  });  

  return Response.json({ ok: true, team });
}