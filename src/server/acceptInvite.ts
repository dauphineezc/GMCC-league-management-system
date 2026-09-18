import { readLeagueDocJSON } from "@/lib/leagueDoc";
import { markInviteUsed, type PeekedInvite } from "@/lib/repositories/invitesRepo";
import { getTeamById, getTeamRosterMeta } from "@/lib/repositories/teamsRepo";
import { readMembershipsForUid } from "@/lib/repositories/usersRepo";
import { addPlayerToTeam } from "@/server/memberships";

const ROSTER_LIMIT = 8;

function joinError(message: string, status: number, code: string): never {
  throw Object.assign(new Error(message), { status, code });
}

/** Validate league/roster rules, then consume the invite and add the player. */
export async function acceptInviteForUser(userId: string, invite: PeekedInvite) {
  const team = await getTeamById(invite.teamId);
  if (!team) joinError("Team not found", 404, "NOT_FOUND");

  const leagueId = typeof team.leagueId === "string" ? team.leagueId : null;

  if (leagueId) {
    const league = await readLeagueDocJSON(leagueId);
    if (league?.playerAddDeadline) {
      const deadlinePassed = new Date(String(league.playerAddDeadline)) < new Date();
      const overrideActive = Boolean(league.playerAddDeadlineOverride);
      if (deadlinePassed && !overrideActive) {
        joinError(
          "The player add deadline for this league has passed. This invite is no longer valid.",
          403,
          "DEADLINE_PASSED"
        );
      }
    }
  }

  const memberships = await readMembershipsForUid(userId);
  if (leagueId && memberships.some((m) => m.leagueId === leagueId)) {
    joinError("Already on a team", 409, "ALREADY_ON_TEAM");
  }

  const { size: rosterSize } = await getTeamRosterMeta(invite.teamId);
  if (rosterSize >= ROSTER_LIMIT) {
    joinError("Team is full", 400, "TEAM_FULL");
  }

  await markInviteUsed(invite.id, userId);
  await addPlayerToTeam(userId, invite.teamId);

  return { teamId: invite.teamId, team };
}
