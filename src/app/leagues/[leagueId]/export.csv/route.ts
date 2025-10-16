export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";
import { getServerUser } from "@/lib/serverUser";
import { hasLeaguePermission } from "@/lib/permissions";
import { adminAuth } from "@/lib/firebaseAdmin";
import { toCsv, yyyymmdd } from "@/lib/csv";

/** tolerant KV helpers (values might be stored as JSON strings) */
async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}
async function readMap<T extends Record<string, any>>(key: string): Promise<T> {
  const raw = await kv.get(key);
  if (!raw) return {} as T;
  if (typeof raw === "string") return JSON.parse(raw) as T;
  return raw as T;
}

/** read teams from SET and hydrate from team:<id> (matches page.tsx) */
async function getMergedTeams(leagueId: string) {
  // teams are now a SET
  const teamIds = (await kv.smembers(`league:${leagueId}:teams`)) as string[] || [];

  const initial = new Map<string, { teamId: string; name: string; approved?: boolean }>();
  for (const id of teamIds) initial.set(id, { teamId: id, name: id });

  // Infer from league:<id>:players if needed
  if (initial.size === 0) {
    const players = await readArr<any>(`league:${leagueId}:players`);
    for (const id of Array.from(new Set(players.map((p) => p.teamId))).filter(Boolean)) {
      initial.set(id, { teamId: id as string, name: id as string });
    }
  }

  const rows: Array<{ teamId: string; name: string; approved?: boolean }> = [];
  await Promise.all(
    Array.from(initial.keys()).map(async (id) => {
      const t = (await kv.get<any>(`team:${id}`)) || null;
      const base = initial.get(id)!;
      rows.push({ teamId: id, name: t?.name ?? base.name, approved: Boolean(t?.approved) });
    })
  );
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(
  _req: Request,
  { params }: { params: { leagueId: string } }
) {
  const me = await getServerUser();
  if (!me) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }
  const leagueId = params.leagueId;

  // Use new permission system - requires admin level
  if (!(await hasLeaguePermission(me, leagueId, "admin"))) {
    return NextResponse.redirect(new URL("/player", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }

  // Build master roster exactly like your page.tsx
  const teams = await getMergedTeams(leagueId);
  const master: Array<{ userId: string; displayName: string; teamId: string; teamName: string; isManager: boolean; paid: boolean }> = [];

  await Promise.all(
    teams.map(async (t) => {
      const [roster, payMap] = await Promise.all([
        readArr<any>(`team:${t.teamId}:roster`),
        readMap<Record<string, boolean>>(`team:${t.teamId}:payments`),
      ]);
      roster.forEach((entry) =>
        master.push({
          userId: entry.userId,
          displayName: entry.displayName,
          teamId: t.teamId,
          teamName: t.name,
          isManager: Boolean(entry.isManager),
          paid: Boolean(payMap?.[entry.userId]),
        })
      );
    })
  );

  // Resolve emails for UID-looking ids; if an id looks like an email, keep it
  const uids = Array.from(new Set(master.map(r => r.userId))).filter(id => !id.includes("@"));
  const uidToEmail = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100).map(uid => ({ uid }));
    const res = await adminAuth.getUsers(batch);
    for (const u of res.users) uidToEmail.set(u.uid, u.email ?? "");
  }

  const LNAME = DIVISIONS.find(d => d.id === leagueId)?.name ?? leagueId;

  const rows = master
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map(r => ({
      uid: r.userId,
      email: r.userId.includes("@") ? r.userId : (uidToEmail.get(r.userId) ?? ""),
      displayName: r.displayName,
      leagueId,
      leagueName: LNAME,
      teamId: r.teamId,
      teamName: r.teamName,
      isManager: r.isManager ? "yes" : "no",
      paid: r.paid ? "yes" : "no",
    }));

  const headers = ["uid", "email", "displayName", "leagueId", "leagueName", "teamId", "teamName", "isManager", "paid"];
  const csv = toCsv(rows, headers);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename=${leagueId}-roster-${yyyymmdd()}.csv`,
    },
  });
}

