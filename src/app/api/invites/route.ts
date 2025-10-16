// POST create invite (link/code)
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { createLinkInvite, createCodeInvite } from "@/server/invites";

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED" }}, { status: 401 });
  
  const { teamId, type, ttlHours, email, phone } = await req.json();

  // Validate invite type
  if (type !== 'link' && type !== 'code') {
    return Response.json({ error: { code: "INVALID_TYPE", message: "Type must be 'link' or 'code'" }}, { status: 400 });
  }

  const team = await kv.get<any>(`team:${teamId}`);
  if (!team) return Response.json({ error: { code: "NOT_FOUND" }}, { status: 404 });
  
  // Check if user is manager - look in roster
  const roster = await kv.get<any[]>(`team:${teamId}:roster`) || [];
  const userInRoster = roster.find(r => r.userId === user.id);
  const isManager = userInRoster?.isManager === true;
  
  if (!isManager && team.managerUserId !== user.id && team.leadUserId !== user.id) {
    return Response.json({ error: { code: "NOT_MANAGER", message: "Only team managers can create invites" }}, { status: 403 });
  }

  if (roster.length >= (team.rosterLimit ?? 8)) {
    return Response.json({ error: { code: "TEAM_FULL", message: "Roster is full." }}, { status: 400 });
  }

  // rate limit
  const limKey = `ratelimit:invite-create:${user.id}`;
  const count = await kv.incr(limKey);
  if (count === 1) await kv.expire(limKey, 60);
  if (count > 10) return Response.json({ error: { code: "RATE_LIMIT" }}, { status: 429 });

  const options = {
    ttlHours: ttlHours || 24,
    email,
    phone,
    createdBy: user.id,
  };

  if (type === 'link') {
    const result = await createLinkInvite(teamId, options);
    return Response.json({ 
      token: result.token, 
      expiresIn: result.expiresIn,
      type: 'link' 
    });
  } else {
    const result = await createCodeInvite(teamId, options);
    return Response.json({ 
      code: result.code, 
      expiresIn: result.expiresIn,
      type: 'code' 
    });
  }
}
