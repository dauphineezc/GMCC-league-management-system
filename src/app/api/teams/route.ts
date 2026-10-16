// src/app/api/teams/route.ts
import type { NextRequest } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { resolveLeagueByRef, leaguePublicRef } from "@/lib/db/resolveLeague";
import {
  isKnownDivisionSlug,
  listDivisions,
  slugifyDivisionName,
} from "@/lib/repositories/divisionsRepo";
import { createTeam } from "@/lib/repositories/teamsRepo";

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
  /** Division catalog slug (e.g. low_b). Legacy "low b" forms still accepted. */
  estimatedDivision?: string;
  preferredPracticeDays?: string[]; // ["mon","tue",...]
  teamPaymentRequired?: boolean;
};

const SPORTS = new Set(["basketball", "volleyball"]);
const DAYS = new Set(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

function normalizeGender(value: unknown): "mens" | "womens" | "co-ed" {
  const g = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (g === "mens" || g === "men" || g === "men's") return "mens";
  if (g === "womens" || g === "women" || g === "women's") return "womens";
  if (g === "co-ed" || g === "coed" || g === "co ed") return "co-ed";
  return "co-ed";
}

export async function POST(req: NextRequest) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;
  const userId = auth.user.id;

  const body: Body = await req.json().catch(() => ({} as Body));
  const name = (body.name || "").trim();
  const description = (body.description || "").trim();

  if (!name) {
    return Response.json(
      { error: { code: "BAD_NAME", message: "Team name is required" } },
      { status: 400 }
    );
  }

  const rawLeagueRef =
    (body.leagueId ?? undefined) ??
    (body.division ?? undefined) ??
    (body.divisionId ?? undefined);

  let leagueId: string | null = null;
  let leagueRow: Awaited<ReturnType<typeof resolveLeagueByRef>> = null;
  if (rawLeagueRef != null && String(rawLeagueRef).trim() !== "") {
    const ref = String(rawLeagueRef).trim();
    leagueRow =
      (await resolveLeagueByRef(ref)) ??
      (await resolveLeagueByRef(ref.toLowerCase()));
    if (!leagueRow) {
      return Response.json(
        { error: { code: "BAD_LEAGUE", message: `Unknown league: ${rawLeagueRef}` } },
        { status: 400 }
      );
    }
    leagueId = leaguePublicRef(leagueRow);
  }

  // Prefer league demographics when joining a league at create time.
  let sport = SPORTS.has(String(body.sport))
    ? (body.sport as "basketball" | "volleyball")
    : "basketball";
  let gender = normalizeGender(body.gender);
  if (leagueRow) {
    if (SPORTS.has(String(leagueRow.sport))) {
      sport = leagueRow.sport as "basketball" | "volleyball";
    }
    if (leagueRow.gender) {
      gender = normalizeGender(leagueRow.gender);
    }
  }

  const sportForDivisions = leagueRow?.sport ?? sport;
  const divisions = await listDivisions(sportForDivisions);
  const requestedDiv = slugifyDivisionName(
    String(
      (leagueRow?.division && String(leagueRow.division).trim()) ||
        body.estimatedDivision ||
        ""
    )
  );

  // League.division is authoritative (catalog can drift after sport-scoping).
  // Free-form estimates must match the sport catalog, with soft fallbacks.
  let estimatedDivision: string | null = null;
  if (leagueRow && requestedDiv) {
    estimatedDivision = requestedDiv;
  } else if (requestedDiv) {
    if (await isKnownDivisionSlug(requestedDiv, sportForDivisions)) {
      estimatedDivision = requestedDiv;
    } else if (await isKnownDivisionSlug(requestedDiv, null)) {
      estimatedDivision = requestedDiv;
    } else {
      estimatedDivision = divisions[0]?.slug ?? null;
    }
  } else {
    estimatedDivision = divisions[0]?.slug ?? null;
  }

  if (!estimatedDivision) {
    return Response.json(
      {
        error: {
          code: "NO_DIVISIONS",
          message: `No divisions are configured${
            sportForDivisions ? ` for ${sportForDivisions}` : ""
          }`,
        },
      },
      { status: 400 }
    );
  }

  const preferredPracticeDays = Array.isArray(body.preferredPracticeDays)
    ? body.preferredPracticeDays.filter((d) => DAYS.has(String(d))).map(String)
    : [];
  const teamPaymentRequired = Boolean(body.teamPaymentRequired);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const teamDoc = await createTeam({
    id,
    name,
    description,
    leagueSlug: leagueId,
    managerUserId: userId,
    sport,
    gender,
    estimatedDivision,
    paymentRequired: teamPaymentRequired,
  });

  const team = {
    ...teamDoc,
    leagueId,
    managerUserId: userId,
    rosterLimit: 8,
    createdAt: now,
    updatedAt: now,
    preferredPracticeDays,
    teamPaymentRequired,
  };

  return Response.json({ ok: true, team });
}
