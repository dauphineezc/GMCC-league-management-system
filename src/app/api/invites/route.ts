// POST create invite (link/code)
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user) return Response.json({ error: { code: "UNAUTHENTICATED" }}, { status: 401 });
  
  const { teamId } = await req.json();

  const team = await kv.get<any>(`team:${teamId}`);
  if (!team) return Response.json({ error: { code: "NOT_FOUND" }}, { status: 404 });
  if (team.managerUserId !== user.id) return Response.json({ error: { code: "NOT_MANAGER" }}, { status: 403 });

  const roster = await kv.get<any[]>(`team:${teamId}:roster`) || [];
  if (roster.length >= (team.rosterLimit ?? 8)) {
    return Response.json({ error: { code: "TEAM_FULL", message: "Roster is full." }}, { status: 400 });
  }

  // rate limit
  const limKey = `ratelimit:invite-create:${user.id}`;
  const count = await kv.incr(limKey);
  if (count === 1) await kv.expire(limKey, 60);
  if (count > 5) return Response.json({ error: { code: "RATE_LIMIT" }}, { status: 429 });

  // token - use crypto.randomUUID() for browser compatibility
  const token = crypto.randomUUID().replace(/-/g, '');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  await kv.set(`invite:token:${hashB64}`, { teamId, createdBy: user.id, uses: 0 }, { ex: 60 * 60 * 24 * 14 }); // 14d

  return Response.json({ token }); // client constructs join URL /join?t=${token}
}
