// src/app/api/superadmin/leagues/route.ts
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function nowISO() { return new Date().toISOString(); }

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user?.superadmin) {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    leagueId?: string;
    description?: string;
    sport?: string | null;
  };

  if (!body.name?.trim()) {
    return Response.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  }

  const leagueId = (body.leagueId || slugify(body.name)).trim();
  const now = nowISO();

  const league = {
    id: leagueId,
    name: body.name.trim(),
    description: body.description ?? "",
    sport: body.sport ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await kv.set(`league:${leagueId}`, league);
  await kv.sadd("leagues:index", leagueId);

  // (optional) initialize empty sets/arrays
  // teams is now a SET - no need to initialize empty sets in Redis
  await kv.set(`league:${leagueId}:players`, []);

  return Response.json({ ok: true, leagueId, league });
}