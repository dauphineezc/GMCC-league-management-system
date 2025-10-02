// /src/app/superadmin/export/admins.csv/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { adminAuth } from "@/lib/firebaseAdmin";
import { DIVISIONS } from "@/lib/divisions";
import { toCsv, yyyymmdd } from "@/lib/csv";

export async function GET() {
  const me = await getServerUser();
  if (!me) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  if (!me.superadmin) return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  const leagueName = (id: string) => DIVISIONS.find(d => d.id === id)?.name ?? id;

  const rows: Array<Record<string, string>> = [];

  let token: string | undefined = undefined;
  do {
    const page = await adminAuth.listUsers(1000, token);
    for (const u of page.users) {
      const claims = (u.customClaims ?? {}) as any;
      const isAdmin = !!claims.superadmin || Array.isArray(claims.leagueAdminOf);
      if (!isAdmin) continue;

      const displayName = u.displayName ?? "";
      const email = u.email ?? "";
      const uid = u.uid;

      if (claims.superadmin) {
        rows.push({
          uid, email, displayName,
          role: "superadmin",
          leagueId: "all",
          leagueName: "All Leagues",
        });
      }

      const leagues: string[] = Array.isArray(claims.leagueAdminOf) ? claims.leagueAdminOf : [];
      for (const lid of leagues) {
        rows.push({
          uid, email, displayName,
          role: "admin",
          leagueId: lid,
          leagueName: leagueName(lid),
        });
      }

      if (!claims.superadmin && leagues.length === 0) {
        rows.push({
          uid, email, displayName,
          role: "admin",
          leagueId: "org",
          leagueName: "Organization",
        });
      }
    }
    token = page.pageToken;
  } while (token);

  // stable order
  rows.sort((a, b) => (a.email || a.uid).localeCompare(b.email || b.uid));

  const headers = ["uid", "email", "displayName", "role", "leagueId", "leagueName"];
  const csv = toCsv(rows, headers);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename=admins-${yyyymmdd()}.csv`,
    },
  });
}