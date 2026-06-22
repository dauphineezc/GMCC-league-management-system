export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { DIVISIONS } from "@/lib/divisions";
import { getServerUser } from "@/lib/serverUser";
import { hasLeaguePermission } from "@/lib/permissions";
import { adminAuth } from "@/lib/firebaseAdmin";
import { toCsv, yyyymmdd } from "@/lib/csv";
import { buildLeagueMasterRoster } from "@/lib/kvHelpers";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const me = await getServerUser();
  if (!me) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }
  const { leagueId } = await params;

  if (!(await hasLeaguePermission(me, leagueId, "admin"))) {
    return NextResponse.redirect(new URL("/player", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  }

  const master = await buildLeagueMasterRoster(leagueId);

  const uids = Array.from(new Set(master.map((r) => r.userId))).filter((id) => !id.includes("@"));
  const uidToEmail = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100).map((uid) => ({ uid }));
    const res = await adminAuth.getUsers(batch);
    for (const u of res.users) uidToEmail.set(u.uid, u.email ?? "");
  }

  const LNAME = DIVISIONS.find((d) => d.id === leagueId)?.name ?? leagueId;

  const rows = master
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
    .map((r) => ({
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
