import { db } from "@/db/index";
import { teamMembers } from "@/db/schema";
import { getTeamById } from "@/lib/repositories/teamsRepo";
import { upsertUserProfile } from "@/lib/repositories/usersRepo";
import type { Membership } from "@/lib/types";
import { and, eq } from "drizzle-orm";

/** Memberships are derived from team_members; upsert ensures roster row exists. */
export async function upsertMembership(_userId: string, _m: Membership) {
  /* no-op — roster row is source of truth */
}

export async function updateMembershipNamesForTeam(
  _teamId: string,
  _teamName: string,
  _leagueId: string
) {
  /* no-op — names resolved via joins */
}

export async function addPlayerToTeam(userId: string, teamId: string) {
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found");

  const now = new Date();

  await db
    .insert(teamMembers)
    .values({
      teamId,
      userId,
      isManager: false,
      paid: false,
      joinedAt: now,
    })
    .onConflictDoUpdate({
      target: [teamMembers.teamId, teamMembers.userId],
      set: { joinedAt: now },
    });

  return team;
}

export async function removePlayerFromTeam(userId: string, teamId: string) {
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found");

  await db
    .delete(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  return { team, removedUser: userId };
}

export async function ensureUserExists(userId: string, email?: string | null) {
  if (!email) return;
  await upsertUserProfile({
    id: userId,
    email,
    displayName: null,
  });
}
