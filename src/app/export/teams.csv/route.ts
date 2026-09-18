export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { readDoc, smembersSafe } from "@/lib/kvHelpers";
import { batchGetTeams } from "@/lib/kvBatch";
import { toCsv, yyyymmdd } from "@/lib/csv";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function normalizeSport(v: unknown) {
  const s = norm(v).replace(/\s+/g, "");
  if (!s) return null;
  if (/(basket|bball)/.test(s)) return "basketball";
  if (/(volley|vball)/.test(s)) return "volleyball";
  return s;
}

function normalizeGender(v: unknown) {
  const s = norm(v).replace(/\s+/g, "");
  if (!s) return null;
  if (/^(men|mens|male|m)$/.test(s)) return "mens";
  if (/^(women|womens|female|w|f)$/.test(s)) return "womens";
  if (/^(co[-\s]?ed|mixed|all)$/.test(s)) return "coed";
  return s;
}

function normalizeDivision(v: unknown) {
  let s = norm(v).replace(/\s+/g, "_").replace(/-/g, "_");
  if (!s) return null;
  if (s === "low_b" || s === "lowb" || s === "b_low") s = "low_b";
  if (s === "high_b" || s === "highb" || s === "b_high") s = "high_b";
  if (s === "a_division" || s === "div_a") s = "a";
  return s;
}

export async function GET(req: Request) {
  const me = await getServerUser();
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!me) return NextResponse.redirect(new URL("/login", base));
  if (!me.superadmin) return NextResponse.redirect(new URL("/", base));

  const sp = new URL(req.url).searchParams;
  const q = norm(sp.get("q") ?? "");
  const approvedFilter = String(sp.get("approved") ?? "all");
  const leagueFilter = String(sp.get("league") ?? "");
  const onlyUnassigned = String(sp.get("unassigned") ?? "") === "1";
  const sportFilter = normalizeSport(sp.get("sport") ?? "");
  const genderFilter = normalizeGender(sp.get("gender") ?? "");
  const divisionFilter = normalizeDivision(sp.get("division") ?? "");

  const teamIds = await smembersSafe("teams:index");
  const teamsMap = await batchGetTeams(teamIds);

  const allTeams = teamIds.map((id) => {
    const t = teamsMap.get(`team:${id}`) as Record<string, unknown> | null | undefined;
    if (!t) {
      return {
        teamId: id,
        name: id,
        approved: false,
        leagueId: "",
        sport: null as string | null,
        gender: null as string | null,
        division: null as string | null,
      };
    }
    return {
      teamId: id,
      name: String(t.name ?? id).trim(),
      approved: Boolean(t.approved),
      leagueId: t.leagueId != null ? String(t.leagueId) : "",
      sport: normalizeSport(t.sport),
      gender: normalizeGender(t.gender),
      division: normalizeDivision(t.estimatedDivision ?? t.division),
    };
  });

  const indexIds = await smembersSafe("leagues:index");
  const teamLeagueIds = Array.from(
    new Set(allTeams.map((t) => t.leagueId).filter(Boolean))
  );
  const allLeagueIds = Array.from(new Set([...indexIds, ...teamLeagueIds]));

  const leagueNameById = new Map<string, string>();
  await Promise.all(
    allLeagueIds.map(async (id) => {
      const L = await readDoc<Record<string, any>>(`league:${id}`);
      leagueNameById.set(id, String(L?.name ?? id));
    })
  );

  const rows = allTeams
    .filter((t) => {
      if (q && !t.name.toLowerCase().includes(q)) return false;
      if (approvedFilter === "yes" && !t.approved) return false;
      if (approvedFilter === "no" && t.approved) return false;
      if (onlyUnassigned && t.leagueId) return false;
      if (leagueFilter && t.leagueId !== leagueFilter) return false;
      if (sportFilter && t.sport !== sportFilter) return false;
      if (genderFilter && t.gender !== genderFilter) return false;
      if (divisionFilter && t.division !== divisionFilter) return false;
      return true;
    })
    .map((t) => ({
      teamId: t.teamId,
      name: t.name,
      approved: t.approved ? "yes" : "no",
      leagueId: t.leagueId,
      leagueName: t.leagueId ? (leagueNameById.get(t.leagueId) ?? "") : "",
      sport: t.sport ?? "",
      gender: t.gender ?? "",
      division: t.division ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const headers = [
    "teamId",
    "name",
    "approved",
    "leagueId",
    "leagueName",
    "sport",
    "gender",
    "division",
  ];
  const csv = toCsv(rows, headers);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename=teams-${yyyymmdd()}.csv`,
    },
  });
}
