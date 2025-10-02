export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { adminAuth } from "@/lib/firebaseAdmin";
import { DIVISIONS } from "@/lib/divisions";

/* ---------- tiny helpers ---------- */
function json(data: any, status = 200) {
  return new NextResponse(JSON.stringify({ kind: "migrate-email-to-uid", ...data }), {
    status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
async function readArr<T=any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? JSON.parse(raw) as T[] : [];
  return [];
}
async function readMap<T extends Record<string, any>>(key: string): Promise<T> {
  const raw = await kv.get(key);
  if (!raw) return {} as T;
  if (typeof raw === "string") return JSON.parse(raw) as T;
  return raw as T;
}
async function getLeagues(): Promise<string[]> {
  const idx = (await kv.smembers("leagues:index")) as unknown;
  return Array.isArray(idx) && idx.length ? (idx as string[]) : DIVISIONS.map(d => d.id);
}
async function getTeamIds(leagueId: string): Promise<string[]> {
  // teams are now a SET
  const teamIds = (await kv.smembers(`league:${leagueId}:teams`)) as string[] || [];
  if (!teamIds.length) {
    const players = await readArr<any>(`league:${leagueId}:players`);
    const set = new Set<string>();
    for (const id of Array.from(new Set(players.map(p => p.teamId))).filter(Boolean)) set.add(String(id));
    return Array.from(set);
  }
  return teamIds;
}

/* ---------- core ---------- */
async function migrateOne(email: string) {
  const { uid } = await adminAuth.getUserByEmail(email);

  let rosterChanged = 0, paymentsChanged = 0, leaguePlayersChanged = 0;
  let privMoved = 0, membershipsMoved = 0, userDocMoved = 0, adminIdxMoved = 0;

  // move user:email → user:uid
  for (const suffix of ["", ":profile", ":memberships"] as const) {
    const from = `user:${email}${suffix}`;
    const to   = `user:${uid}${suffix}`;
    const val = await kv.get(from);
    if (val != null) {
      await kv.set(to, val);
      await kv.del(from);
      if (suffix === ":memberships") membershipsMoved++;
      else userDocMoved++;
    }
  }

  // move admin:<email>:leagues → admin:<uid>:leagues
  {
    const from = `admin:${email}:leagues`;
    const to   = `admin:${uid}:leagues`;
    const val = await kv.get(from);
    if (val != null) { await kv.set(to, val); await kv.del(from); adminIdxMoved++; }
  }

  // scan leagues/teams and rewrite occurrences
  const leagueIds = await getLeagues();
  for (const lid of leagueIds) {
    // team list
    const teamIds = await getTeamIds(lid);

    // league:<id>:players index
    {
      const key = `league:${lid}:players`;
      const list = await readArr<any>(key);
      let touched = false;
      for (const row of list) {
        if (row.userId === email) { row.userId = uid; touched = true; }
      }
      if (touched) { await kv.set(key, JSON.stringify(list)); leaguePlayersChanged++; }
    }

    for (const tid of teamIds) {
      // roster
      {
        const key = `team:${tid}:roster`;
        const roster = await readArr<any>(key);
        let touched = false;
        for (const r of roster) {
          if (r.userId === email) { r.userId = uid; touched = true; }
        }
        if (touched) { await kv.set(key, JSON.stringify(roster)); rosterChanged++; }
      }

      // payments map
      {
        const key = `team:${tid}:payments`;
        const pay = await readMap<Record<string, boolean>>(key);
        if (Object.prototype.hasOwnProperty.call(pay, email)) {
          pay[uid] = pay[email]; delete pay[email];
          await kv.set(key, pay); paymentsChanged++;
        }
      }

      // private roster doc rename
      {
        const from = `team:${tid}:roster:private:${email}`;
        const to   = `team:${tid}:roster:private:${uid}`;
        const val = await kv.get(from);
        if (val != null) { await kv.set(to, val); await kv.del(from); privMoved++; }
      }
    }
  }

  return {
    ok: true,
    email, uid,
    rosterChanged, paymentsChanged, leaguePlayersChanged,
    privMoved, membershipsMoved, userDocMoved, adminIdxMoved,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url); const email = url.searchParams.get("email");
  if (!email) return json({ ok:false, error:"email required" }, 400);
  try { return json(await migrateOne(email)); }
  catch (e:any) { return json({ ok:false, error: e?.message || "failed" }, 500); }
}
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body?.email) return json({ ok:false, error:"email required" }, 400);
  try { return json(await migrateOne(body.email)); }
  catch (e:any) { return json({ ok:false, error: e?.message || "failed" }, 500); }
}