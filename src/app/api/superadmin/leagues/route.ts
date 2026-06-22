// src/app/api/superadmin/leagues/route.ts
import { NextRequest } from "next/server";
import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import { createLeagueRecord } from "@/lib/repositories/leaguesRepo";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function POST(req: NextRequest) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    leagueId?: string;
    description?: string;
    sport?: string | null;
  };

  if (!body.name?.trim()) {
    return Response.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  }

  const slug = (body.leagueId || slugify(body.name)).trim();
  const sport =
    body.sport === "volleyball" || body.sport === "basketball" ? body.sport : "basketball";

  const league = await createLeagueRecord({
    name: body.name.trim(),
    description: body.description ?? "",
    sport,
    gender: "coed",
    division: "low_b",
    slug,
  });

  return Response.json({
    ok: true,
    leagueId: league.slug,
    league: {
      id: league.slug,
      name: league.name,
      description: body.description ?? "",
      sport,
    },
  });
}
