// /src/app/api/invite/join/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

export async function POST(req: NextRequest) {
  const me = await getServerUser();
  if (!me) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }

  const { token } = await req.json();
  if (!token) {
    return NextResponse.json({ error: { code: "BAD_REQUEST" } }, { status: 400 });
  }

  // Node-safe base64 for the token hash
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hashB64 = Buffer.from(new Uint8Array(digest)).toString("base64");

  const invite = await kv.get<any>(`invite:token:${hashB64}`);
  if (!invite) {
    return NextResponse.json({ error: { code: "INVITE_INVALID" } }, { status: 400 });
  }

  const teamId: string = invite.teamId;
  const team = (await kv.get<any>(`team:${teamId}`)) || null;
  if (!team) {
    return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
  }

  const leagueId: string = team.leagueId ?? invite.leagueId ?? "unknown";

  // Has this user already joined a team in this league?
  const userMembershipKey = `user:${me.uid}:memberships`;
  const memberships = await readArr<any>(userMembershipKey);
  if (memberships.some((m) => m.leagueId === leagueId)) {
    return NextResponse.json({ error: { code: "ALREADY_ON_TEAM" } }, { status: 400 });
  }

  // Is team full?
  const rosterKey = `team:${teamId}:roster`;
  const roster = await readArr<any>(rosterKey);
  const rosterLimit = team.rosterLimit ?? 8;
  if (roster.length >= rosterLimit) {
    return NextResponse.json({ error: { code: "TEAM_FULL" } }, { status: 400 });
  }

  // Write roster + payments + user memberships
  const now = new Date().toISOString();
  const displayName = me.displayName || me.email || "Player";

  const newRoster = [
    ...roster,
    { userId: me.uid, displayName, isManager: false, joinedAt: now },
  ];
  await kv.set(rosterKey, JSON.stringify(newRoster));

  // keep payments consistent with rest of app: team:<id>:payments is a { [uid]: boolean } map
  const payKey = `team:${teamId}:payments`;
  const payMap = (await kv.get<Record<string, boolean>>(payKey)) || {};
  if (payMap[me.uid] !== false) payMap[me.uid] = false; // mark unpaid on join
  await kv.set(payKey, payMap);

  const newMemberships = [
    ...memberships,
    { leagueId, teamId, isManager: false, joinedAt: now },
  ];
  await kv.set(userMembershipKey, JSON.stringify(newMemberships));

  // Burn invite
  await kv.del(`invite:token:${hashB64}`);

  return NextResponse.json({ teamId });
}