// POST create invite (link/code)
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { requireUser } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const userId = requireUser();
  const { teamId } = await req.json();

  const team = await kv.get<any>(`team:${teamId}`);
  if (!team) return Response.json({ error: { code: "NOT_FOUND" }}, { status: 404 });
  if (team.managerUserId !== userId) return Response.json({ error: { code: "NOT_MANAGER" }}, { status: 403 });

  const roster = await kv.get<any[]>(`team:${teamId}:roster`) || [];
  if (roster.length >= (team.rosterLimit ?? 8)) {
    return Response.json({ error: { code: "TEAM_FULL", message: "Roster is full." }}, { status: 400 });
  }

  // rate limit
  const limKey = `ratelimit:invite-create:${userId}`;
  const count = await kv.incr(limKey);
  if (count === 1) await kv.expire(limKey, 60);
  if (count > 5) return Response.json({ error: { code: "RATE_LIMIT" }}, { status: 429 });

  // token
  const token = crypto.randomBytes(24).toString("base64url");
  const hash = crypto.createHash("sha256").update(token).digest("base64url");
  await kv.set(`invite:token:${hash}`, { teamId, createdBy: userId, uses: 0 }, { ex: 60 * 60 * 24 * 14 }); // 14d

  return Response.json({ token }); // client constructs join URL /join?t=${token}
}
