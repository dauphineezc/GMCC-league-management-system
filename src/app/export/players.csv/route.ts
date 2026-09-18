export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { buildGlobalPlayerRoster } from "@/lib/rosterAggregate";
import { adminAuth } from "@/lib/firebaseAdmin";
import { smembersSafe, readDoc } from "@/lib/kvHelpers";
import { toCsv, yyyymmdd } from "@/lib/csv";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function normalizeSport(v: unknown) {
  const s = norm(v).replace(/\s+/g, "");
  if (!s) return null;
  if (/(basket|bball)/.test(s)) return "basketball";
  if (/(volley|vball)/.test(s)) return "volleyball";
  return s;
}

export async function GET(req: Request) {
  const me = await getServerUser();
  if (!me) return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  if (!me.superadmin) return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));

  const sp = new URL(req.url).searchParams;
  const displayNameQ = (sp.get("displayName") ?? "").trim().toLowerCase();
  const sportFilter = normalizeSport(sp.get("sport") ?? "");
  const leagueFilter = String(sp.get("league") ?? "");

  const { roster } = await buildGlobalPlayerRoster();

  let leagueSportById = new Map<string, string | null>();
  if (sportFilter) {
    const leagueIds = await smembersSafe("leagues:index");
    const docs = await Promise.all(
      leagueIds.map(async (id) => {
        const L = await readDoc<Record<string, any>>(`league:${id}`);
        return [id, normalizeSport(L?.sport)] as const;
      })
    );
    leagueSportById = new Map(docs);
  }

  const filtered = roster.filter((r) => {
    if (displayNameQ && !r.displayName.toLowerCase().includes(displayNameQ)) return false;
    if (leagueFilter && r.leagueId !== leagueFilter) return false;
    if (sportFilter) {
      const sport = r.leagueId ? leagueSportById.get(r.leagueId) : null;
      if (sport !== sportFilter) return false;
    }
    return true;
  });

  const uids = Array.from(new Set(filtered.map((r) => r.userId)));
  const uidToEmail = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100).map((uid) => ({ uid }));
    const res = await adminAuth.getUsers(batch);
    for (const u of res.users) uidToEmail.set(u.uid, u.email ?? "");
  }

  const rows = filtered.map((r) => ({
    uid: r.userId,
    email: uidToEmail.get(r.userId) ?? "",
    displayName: r.displayName,
    leagueId: r.leagueId ?? "",
    leagueName: r.leagueName ?? "",
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
