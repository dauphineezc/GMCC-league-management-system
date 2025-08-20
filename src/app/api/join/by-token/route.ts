// POST join via invite link
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { requireUser } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const userId = requireUser();
  const { token } = await req.json();
  const hash = crypto.createHash("sha256").update(token).digest("base64url");

  const invite = await kv.get<any>(`invite:token:${hash}`);
  if (!invite) return Response.json({ error: { code: "INVITE_INVALID" }}, { status: 400 });

  const team = await kv.get<any>(`team:${invite.teamId}`);
  if (!team) return Response.json({ error: { code: "NOT_FOUND" }}, { status: 404 });

  const memberships = await kv.get<any[]>(`user:${userId}:memberships`) || [];
  if (memberships.some(m => m.leagueId === team.leagueId)) {
    return Response.json({ error: { code: "ALREADY_ON_TEAM" }}, { status: 400 });
  }

  const roster = await kv.get<any[]>(`team:${team.id}:roster`) || [];
  if (roster.length >= (team.rosterLimit ?? 8)) {
    return Response.json({ error: { code: "TEAM_FULL" }}, { status: 400 });
  }

  const now = new Date().toISOString();
  await kv.set(`team:${team.id}:roster`, [...roster, { userId, displayName: "You", isManager: false, joinedAt: now }]);
  await kv.set(`team:${team.id}:roster:private:${userId}`, { paymentStatus: "UNPAID" });
  await kv.set(`user:${userId}:memberships`, [...memberships, { leagueId: team.leagueId, teamId: team.id, isManager: false }]);
  await kv.del(`invite:token:${hash}`);

  return Response.json({ teamId: team.id });
}
