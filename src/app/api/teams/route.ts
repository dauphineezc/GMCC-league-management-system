// src/app/api/teams/route.ts
import type { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { normalizeDivision, DIVISIONS } from "@/lib/divisions";
import { upsertMembership } from "@/server/memberships";

/* ----- request body shape (back-compat + new fields) ----- */
type Body = {
  name?: string;
  description?: string;

  // league identifiers (any may be provided). If all are omitted/empty/null,
  // we treat the team as UNASSIGNED and set leagueId: null.
  leagueId?: string | null;
  division?: string | null;
  divisionId?: string | null;

  // new team classification fields
  sport?: "basketball" | "volleyball";
  gender?: "mens" | "womens" | "co-ed";
  estimatedDivision?: "low b" | "high b" | "a";
  preferredPracticeDays?: string[]; // ["mon","tue",...]
  teamPaymentRequired?: boolean;
};

const SPORTS = new Set(["basketball", "volleyball"]);
const GENDERS = new Set(["mens", "womens", "co-ed"]);
const DIV_EST = new Set(["low b", "high b", "a"]);
const DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export async function POST(req: NextRequest) {
  const userId = req.headers.get("x-user-id") || "";
  if (!userId) {
    return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }

  const body: Body = await req.json().catch(() => ({} as Body));
  const name = (body.name || "").trim();
  const description = (body.description || "").trim();

  if (!name) {
    return Response.json(
      { error: { code: "BAD_NAME", message: "Team name is required" } },
      { status: 400 }
    );
  }

  // ---- sanitize new fields (with sensible defaults) ----
  const sport = SPORTS.has(String(body.sport)) ? (body.sport as "basketball" | "volleyball") : "basketball";
  const gender = GENDERS.has(String(body.gender)) ? (body.gender as "mens" | "womens" | "co-ed") : "co-ed";
  const estimatedDivision = DIV_EST.has(String(body.estimatedDivision)) ? (body.estimatedDivision as "low b" | "high b" | "a") : "low b";
  const preferredPracticeDays =
    Array.isArray(body.preferredPracticeDays)
      ? body.preferredPracticeDays.filter((d) => DAYS.has(String(d))).map(String)
      : [];
  const teamPaymentRequired = Boolean(body.teamPaymentRequired);

  // ---- league assignment logic: optional at creation ----
  const rawDiv =
    (body.leagueId ?? undefined) ??
    (body.division ?? undefined) ??
    (body.divisionId ?? undefined);

  // If caller provided a value, normalize & validate. If nothing provided, we leave it null.
  let leagueId: string | null = null;
  if (rawDiv != null && String(rawDiv).trim() !== "") {
    const normalized = normalizeDivision(String(rawDiv));
    if (!normalized) {
      return Response.json(
        { error: { code: "BAD_LEAGUE", message: `Unknown league/division: ${rawDiv}` } },
        { status: 400 }
      );
    }
    leagueId = normalized;
  }

  // ---- create & persist team ----
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const team = {
    id,
    name,
    description,
    leagueId, // may be null
    managerUserId: userId,
    approved: false,
    rosterLimit: 8,
    createdAt: now,
    updatedAt: now,

    // new fields
    sport,
    gender,
    estimatedDivision,
    preferredPracticeDays,
    teamPaymentRequired,
  };

  await kv.set(`team:${id}`, team);
  await kv.sadd("teams:index", id);

  // initial roster: manager
  const roster = (await kv.get<any[]>(`team:${id}:roster`)) ?? [];
  await kv.set(`team:${id}:roster`, [
    ...roster,
    { userId, displayName: userId, isManager: true, joinedAt: now },
  ]);

  // membership: always add the creator as a member/manager
  if (leagueId) {
    // assigned at creation → add to league team set
    await kv.sadd(`league:${leagueId}:teams`, id);

    const leagueName = DIVISIONS.find((d) => d.id === leagueId)?.name ?? leagueId;
    await upsertMembership(userId, {
      leagueId,
      leagueName,
      teamId: id,
      teamName: name,
      isManager: true,
    });
  } else {
    // unassigned at creation → membership without league context
    const key = `user:${userId}:memberships`;
    const existing = (await kv.get<any[]>(key)) ?? [];
    const next = [
      ...existing.filter((m) => m?.teamId !== id),
      { teamId: id, teamName: name, isManager: true },
    ];
    await kv.set(key, next);
  }

  return Response.json({ ok: true, team });
}