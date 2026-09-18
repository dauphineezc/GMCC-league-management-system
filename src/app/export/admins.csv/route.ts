export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
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

  const leagueIds = await smembersSafe("leagues:index");
  const leagueMeta = await Promise.all(
    leagueIds.map(async (id) => {
      const L = await readDoc<Record<string, any>>(`league:${id}`);
      return {
        id,
        name: String(L?.name ?? id),
        sport: normalizeSport(L?.sport),
      };
    })
  );
  const leagueNameById = new Map(leagueMeta.map((l) => [l.id, l.name]));
  const leagueSportById = new Map(leagueMeta.map((l) => [l.id, l.sport]));

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

      if (displayNameQ && !displayName.toLowerCase().includes(displayNameQ)) continue;

      const leagues: string[] = Array.isArray(claims.leagueAdminOf) ? claims.leagueAdminOf : [];

      if (claims.superadmin) {
        const includeSuper =
          (!leagueFilter && !sportFilter) ||
          !!leagueFilter ||
          (!!sportFilter && leagueMeta.some((l) => l.sport === sportFilter));

        if (includeSuper) {
          // When filtering to a specific league, emit that league row for the superadmin.
          if (leagueFilter) {
            rows.push({
              uid,
              email,
              displayName,
              role: "superadmin",
              leagueId: leagueFilter,
              leagueName: leagueNameById.get(leagueFilter) ?? leagueFilter,
            });
          } else if (sportFilter) {
            for (const l of leagueMeta) {
              if (l.sport !== sportFilter) continue;
              rows.push({
                uid,
                email,
                displayName,
                role: "superadmin",
                leagueId: l.id,
                leagueName: l.name,
              });
            }
          } else {
            rows.push({
              uid,
              email,
              displayName,
              role: "superadmin",
              leagueId: "all",
              leagueName: "All Leagues",
            });
          }
        }
      }

      for (const lid of leagues) {
        if (leagueFilter && lid !== leagueFilter) continue;
        if (sportFilter && leagueSportById.get(lid) !== sportFilter) continue;
        rows.push({
          uid,
          email,
          displayName,
          role: "admin",
          leagueId: lid,
          leagueName: leagueNameById.get(lid) ?? lid,
        });
      }

      if (!claims.superadmin && leagues.length === 0) {
        if (!leagueFilter && !sportFilter) {
          rows.push({
            uid,
            email,
            displayName,
            role: "admin",
            leagueId: "org",
            leagueName: "Organization",
          });
        }
      }
    }
    token = page.pageToken;
  } while (token);

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
