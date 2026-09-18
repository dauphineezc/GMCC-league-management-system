// POST create invite (link/code)
import { NextRequest } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { PermissionChecker } from "@/lib/permissions";
import { readLeagueDocJSON } from "@/lib/leagueDoc";
import {
  getTeamById,
  getTeamRosterMeta,
  isUserTeamManager,
} from "@/lib/repositories/teamsRepo";
import { createLinkInvite, createCodeInvite } from "@/server/invites";
import { absoluteUrl } from "@/lib/absoluteUrl";
import {
  deliverInvite,
  parseOptionalEmail,
  parseOptionalPhone,
} from "@/lib/deliverInvite";

export async function POST(req: NextRequest) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;
  const user = auth.user;

  const body = await req.json();
  const { teamId, type, ttlHours } = body;

  let email: string | undefined;
  let phone: string | undefined;
  try {
    email = parseOptionalEmail(body.email);
    phone = parseOptionalPhone(body.phone);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid contact details.";
    return Response.json({ error: { code: "INVALID_CONTACT", message } }, { status: 400 });
  }

  if (type !== "link" && type !== "code") {
    return Response.json(
      { error: { code: "INVALID_TYPE", message: "Type must be 'link' or 'code'" } },
      { status: 400 }
    );
  }

  const team = await getTeamById(teamId);
  if (!team) return Response.json({ error: { code: "NOT_FOUND" } }, { status: 404 });

  const isManager = await isUserTeamManager(teamId, user.id);
  if (!isManager) {
    return Response.json(
      { error: { code: "NOT_MANAGER", message: "Only team managers can create invites" } },
      { status: 403 }
    );
  }

  const leagueId = typeof team.leagueId === "string" ? team.leagueId : null;
  if (leagueId) {
    const league = await readLeagueDocJSON(leagueId);
    if (league?.playerAddDeadline) {
      const deadlinePassed = new Date(String(league.playerAddDeadline)) < new Date();
      const overrideActive = Boolean(league.playerAddDeadlineOverride);
      if (deadlinePassed && !overrideActive) {
        const permissions = await PermissionChecker.create(user, leagueId);
        if (!permissions.isAdmin()) {
          return Response.json(
            {
              error: {
                code: "DEADLINE_PASSED",
                message:
                  "The player add deadline for this league has passed. Contact your league admin if you need to add a player.",
              },
            },
            { status: 403 }
          );
        }
      }
    }
  }

  const { size: rosterSize } = await getTeamRosterMeta(teamId);
  const rosterLimit = 8;
  if (rosterSize >= rosterLimit) {
    return Response.json(
      { error: { code: "TEAM_FULL", message: "Roster is full." } },
      { status: 400 }
    );
  }


  const options = {
    ttlHours: ttlHours || 24,
    email,
    phone,
    createdBy: user.id,
  };

  const teamName = typeof team.name === "string" && team.name.trim() ? team.name.trim() : "a GMCC team";
  const joinUrl = await absoluteUrl("/join");

  if (type === "link") {
    const result = await createLinkInvite(teamId, options);
    const link = `${joinUrl}?t=${result.token}`;
    const delivery = await deliverInvite({
      email,
      phone,
      kind: "link",
      teamName,
      link,
      expiresIn: result.expiresIn,
      joinUrl,
    });
    return Response.json({
      token: result.token,
      expiresIn: result.expiresIn,
      type: "link",
      delivery,
    });
  }

  const result = await createCodeInvite(teamId, options);
  const delivery = await deliverInvite({
    email,
    phone,
    kind: "code",
    teamName,
    code: result.code,
    expiresIn: result.expiresIn,
    joinUrl,
  });
  return Response.json({
    code: result.code,
    expiresIn: result.expiresIn,
    type: "code",
    delivery,
  });
}
