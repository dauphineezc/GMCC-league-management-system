import { getTeamById, isUserTeamManager } from "@/lib/repositories/teamsRepo";
import {
  consumeCodeInvite as consumeCode,
  consumeLinkInvite as consumeLink,
  createCodeInvite as createCode,
  createLinkInvite as createLink,
} from "@/lib/repositories/invitesRepo";

export async function ensureLead(userId: string, teamId: string) {
  const team = await getTeamById(teamId);
  if (!team) throw Object.assign(new Error("Team not found"), { status: 404 });
  const isManager = await isUserTeamManager(teamId, userId);
  if (!isManager) throw Object.assign(new Error("Forbidden"), { status: 403 });
  return team;
}

export function makeCode8() {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 8);
}

export async function createLinkInvite(
  teamId: string,
  options?: {
    ttlHours?: number;
    email?: string;
    phone?: string;
    createdBy?: string;
  }
) {
  return createLink(teamId, {
    ttlHours: options?.ttlHours,
    createdBy: options?.createdBy,
  });
}

export async function consumeLinkInvite(token: string, usedBy?: string) {
  return consumeLink(token, usedBy);
}

export async function createCodeInvite(
  teamId: string,
  options?: {
    ttlHours?: number;
    email?: string;
    phone?: string;
    createdBy?: string;
  }
) {
  return createCode(teamId, {
    ttlHours: options?.ttlHours,
    createdBy: options?.createdBy,
  });
}

export async function consumeCodeInvite(code: string, usedBy?: string) {
  return consumeCode(code, usedBy);
}
