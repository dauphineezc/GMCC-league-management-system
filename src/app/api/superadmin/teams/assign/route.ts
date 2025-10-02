import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";

type TeamDoc = {
  id: string;
  name?: string;
  description?: string;
  leagueId?: string | null;
  managerUserId?: string;
  updatedAt?: string;
};

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

async function readDoc<T>(key: string): Promise<{ doc: T | null; isHash: boolean }> {
  // try HASH first
  try {
    const h = (await kv.hgetall(key)) as Record<string, any> | null;
    if (h && Object.keys(h).length) return { doc: h as T, isHash: true };
  } catch {
    /* WRONGTYPE -> fall back */
  }
  // fall back to GET (string JSON or plain object)
  const raw = (await kv.get(key)) as unknown;
  if (!raw) return { doc: null, isHash: false };
  if (typeof raw === "string") {
    try { return { doc: JSON.parse(raw) as T, isHash: false }; } catch { return { doc: null, isHash: false }; }
  }
  if (typeof raw === "object") return { doc: raw as T, isHash: false };
  return { doc: null, isHash: false };
}

export async function POST(req: Request) {
  // --- auth (superadmin required) ---
  const cookie = cookies().get("fb:session")?.value;
  if (!cookie) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  const caller = await adminAuth.verifySessionCookie(cookie, true);
  if (!caller.superadmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const teamId = String(body.teamId || "");
  const leagueId = String(body.leagueId || "");
  if (!teamId || !leagueId) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  // --- load team regardless of storage format ---
  const key = `team:${teamId}`;
  const { doc: team, isHash } = await readDoc<TeamDoc>(key);
  if (!team) return NextResponse.json({ error: "team not found" }, { status: 404 });

  const prevLeague = team.leagueId ?? null;
  const now = new Date().toISOString();

  // --- update team doc ---
  const updated: TeamDoc = { ...team, leagueId, updatedAt: now };
  if (isHash) {
    await kv.hset(key, updated);
  } else {
    await kv.set(key, updated);
  }

  // --- maintain indexes/collections ---
  await kv.sadd("teams:index", teamId);
  await kv.sadd("leagues:index", leagueId);

  // add to new league team set
  await kv.sadd(`league:${leagueId}:teams`, teamId);

  // remove from previous league (if reassigning)
  if (prevLeague && prevLeague !== leagueId) {
    await kv.srem(`league:${prevLeague}:teams`, teamId);
  }

  // --- update manager membership (optional but nice) ---
  if (team.managerUserId) {
    const mKey = `user:${team.managerUserId}:memberships`;
    const ms = asArray<any>(await kv.get(mKey));
    const leagueName = DIVISIONS.find((d) => d.id === leagueId)?.name ?? leagueId;
    const next = ms.map((m) => (m?.teamId === teamId ? { ...m, leagueId, leagueName } : m));
    await kv.set(mKey, next);
  }

  return NextResponse.json({ ok: true });
}