// /src/app/superadmin/export/players.csv/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { buildGlobalPlayerRoster } from "@/lib/rosterAggregate";
import { adminAuth } from "@/lib/firebaseAdmin";
import { toCsv, yyyymmdd } from "@/lib/csv";

export async function GET() {
  const me = await getServerUser();
  if (!me) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  if (!me.superadmin) return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  // Build roster (all leagues/teams)
  const { roster } = await buildGlobalPlayerRoster();

  // Map UID -> email (batch in chunks of 100)
  const uids = Array.from(new Set(roster.map(r => r.userId)));
  const uidToEmail = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100).map(uid => ({ uid }));
    const res = await adminAuth.getUsers(batch);
    for (const u of res.users) uidToEmail.set(u.uid, u.email ?? "");
  }

  const rows = roster.map(r => ({
    uid: r.userId,
    email: uidToEmail.get(r.userId) ?? "",
    displayName: r.displayName,
    leagueId: (r as any).leagueId ?? "",      // roster rows built from KV don’t store leagueId per row; ok to blank
    leagueName: (r as any).leagueName ?? "",
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
      "Content-Disposition": `attachment; filename=players-${yyyymmdd()}.csv`,
    },
  });
}