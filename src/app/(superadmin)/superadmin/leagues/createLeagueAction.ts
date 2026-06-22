"use server";

import { adminAuth } from "@/lib/firebaseAdmin";
import { assignTeamToLeagueRef } from "@/lib/repositories/teamsRepo";
import { createLeagueRecord, readLeagueDocByRef } from "@/lib/repositories/leaguesRepo";
import { listUnassignedTeams } from "@/lib/repositories/teamsRepo";
import { upsertUserProfile } from "@/lib/repositories/usersRepo";
import type { CreateLeagueState, UnassignedTeam, AddTeamState } from "./createLeagueTypes";

const SPORTS = ["basketball", "volleyball"] as const;
const GENDERS = ["mens", "womens", "coed"] as const;
const DIVS = ["low_b", "high_b", "a"] as const;

const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();

async function resolveUidByEmail(email: string): Promise<string | null> {
  const e = normEmail(email);
  if (!e) return null;

  try {
    const user = await adminAuth.getUserByEmail(e);
    await upsertUserProfile({
      id: user.uid,
      email: user.email ?? e,
      displayName: user.displayName ?? null,
    });
    return user.uid;
  } catch {
    return null;
  }
}

async function getUnassignedTeams(): Promise<UnassignedTeam[]> {
  return listUnassignedTeams();
}

export async function createLeagueAction(
  _prevState: CreateLeagueState,
  formData: FormData
): Promise<CreateLeagueState> {
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const sport = String(formData.get("sport") || "").trim().toLowerCase();
  const division = String(formData.get("division") || "").trim().toLowerCase();
  const gender = String(formData.get("gender") || "").trim().toLowerCase();
  const adminEmail = normEmail(formData.get("adminEmail"));

  const minTeamSizeStr = String(formData.get("minTeamSize") || "").trim();
  const maxTeamSizeStr = String(formData.get("maxTeamSize") || "").trim();
  const minTeamSize = minTeamSizeStr ? parseInt(minTeamSizeStr, 10) : undefined;
  const maxTeamSize = maxTeamSizeStr ? parseInt(maxTeamSizeStr, 10) : undefined;

  if (!name) return { ok: false, error: "Please provide a league name." };
  if (!(SPORTS as readonly string[]).includes(sport))
    return { ok: false, error: "Please choose a valid sport." };
  if (!(DIVS as readonly string[]).includes(division))
    return { ok: false, error: "Please choose a valid division." };
  if (!(GENDERS as readonly string[]).includes(gender))
    return { ok: false, error: "Please choose a valid gender." };

  if (minTeamSize !== undefined && (isNaN(minTeamSize) || minTeamSize < 1)) {
    return { ok: false, error: "Minimum team size must be at least 1." };
  }
  if (maxTeamSize !== undefined && (isNaN(maxTeamSize) || maxTeamSize < 1)) {
    return { ok: false, error: "Maximum team size must be at least 1." };
  }
  if (
    minTeamSize !== undefined &&
    maxTeamSize !== undefined &&
    minTeamSize > maxTeamSize
  ) {
    return { ok: false, error: "Minimum team size cannot be greater than maximum team size." };
  }

  let adminUserId: string | null = null;
  if (adminEmail) {
    adminUserId = await resolveUidByEmail(adminEmail);
    if (!adminUserId) return { ok: false, error: `No Firebase user found for ${adminEmail}` };
  }

  const league = await createLeagueRecord({
    name,
    description,
    sport,
    gender,
    division,
    minTeamSize,
    maxTeamSize,
    adminUserId,
  });

  const unassigned = await getUnassignedTeams();
  return { ok: true, leagueId: league.slug, leagueName: name, unassigned };
}

export async function addTeamToLeagueDirect(
  leagueId: string,
  teamId: string
): Promise<AddTeamState> {
  "use server";

  if (!leagueId || !teamId) return { ok: false, error: "Missing leagueId or teamId." };

  const league = await readLeagueDocByRef(leagueId);
  if (!league) return { ok: false, error: "League not found." };

  try {
    await assignTeamToLeagueRef(teamId, leagueId);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? "Failed to assign team." };
  }
}

export async function addTeamToLeagueAction(
  _prev: AddTeamState | null,
  formData: FormData
): Promise<AddTeamState> {
  const leagueId = String(formData.get("leagueId") || "");
  const teamId = String(formData.get("teamId") || "");
  return addTeamToLeagueDirect(leagueId, teamId);
}

export async function addTeamToLeague(formData: FormData) {
  return addTeamToLeagueAction(null, formData);
}
