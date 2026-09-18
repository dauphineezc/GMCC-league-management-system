export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { getAdminDisplayName } from "@/lib/adminUserLookup";
import { smembersSafe, readDoc } from "@/lib/kvHelpers";
import { toCsv, yyyymmdd } from "@/lib/csv";

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function explodeIds(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(explodeIds);

  const t = String(v).trim();
  if (!t) return [];

  try {
    if (t.startsWith("[") && t.endsWith("]")) {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr.flatMap(explodeIds);
    }
  } catch {
    // ignore
  }

  if (t.includes(",")) {
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [t];
}

export async function GET(req: Request) {
  const me = await getServerUser();
  const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  if (!me) return NextResponse.redirect(new URL("/login", base));
  if (!me.superadmin) return NextResponse.redirect(new URL("/", base));

  const sp = new URL(req.url).searchParams;
  const q = norm(sp.get("q") ?? "");
  const sportFilter = String(sp.get("sport") ?? "");
  const genderFilter = String(sp.get("gender") ?? "");
  const divisionFilter = String(sp.get("division") ?? "");

  const rawSetMembers = await smembersSafe("leagues:index");
  const leagueIds = Array.from(new Set(rawSetMembers.flatMap(explodeIds))).filter(Boolean);

  const allRows = await Promise.all(
    leagueIds.map(async (id) => {
      const t = await readDoc<Record<string, any>>(`league:${id}`);
      if (!t) {
        return {
          leagueId: id,
          name: id,
          approved: "no",
          sport: "",
          gender: "",
          division: "",
          adminUserId: "",
          adminName: "",
        };
      }

      const adminUserId = t.adminUserId ?? t.managerUserId ?? t.ownerUserId ?? null;
      const adminName = await getAdminDisplayName(adminUserId);

      return {
        leagueId: id,
        name: String(t.name ?? id),
        approved: Boolean(t.approved) ? "yes" : "no",
        sport: String(t.sport ?? ""),
        gender: String(t.gender ?? ""),
        division: String(t.estimatedDivision ?? t.division ?? ""),
        adminUserId: adminUserId ? String(adminUserId) : "",
        adminName: adminName ?? "",
      };
    })
  );

  const rows = allRows
    .filter((l) => {
      if (q && !l.name.toLowerCase().includes(q)) return false;
      if (sportFilter && norm(l.sport) !== sportFilter) return false;
      if (genderFilter && norm(l.gender) !== genderFilter) return false;
      if (divisionFilter && norm(l.division) !== divisionFilter) return false;
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const headers = [
    "leagueId",
    "name",
    "approved",
    "sport",
    "gender",
    "division",
    "adminUserId",
    "adminName",
  ];
  const csv = toCsv(rows, headers);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": `attachment; filename=leagues-${yyyymmdd()}.csv`,
    },
  });
}
