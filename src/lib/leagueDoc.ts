import {
  readLeagueDocByRef,
  setLeaguePrimaryAdmin,
  updateLeagueFields,
  type LeagueDocRecord,
} from "@/lib/repositories/leaguesRepo";

export type LeagueDoc = {
  id?: string;
  name?: string;
  description?: string;
  adminUserId: string | null;
  createdAt?: number | string;
  updatedAt?: number;
  sport?: string;
  gender?: string;
  division?: string;
  team_size?: string;
  minTeamSize?: number;
  maxTeamSize?: number;
  playerAddDeadline?: string;
  playerAddDeadlineOverride?: boolean;
  [k: string]: any;
};

function toLeagueDoc(record: LeagueDocRecord | null): LeagueDoc | null {
  if (!record) return null;
  return record as LeagueDoc;
}

export async function readLeagueDocJSON(leagueId: string): Promise<LeagueDoc | null> {
  return toLeagueDoc(await readLeagueDocByRef(leagueId));
}

export async function writeLeagueAdminJSON(leagueId: string, adminUserId: string | null) {
  await setLeaguePrimaryAdmin(leagueId, adminUserId);
  return (await readLeagueDocJSON(leagueId)) ?? ({ id: leagueId, adminUserId } as LeagueDoc);
}

export async function writeLeagueAdmin(leagueId: string, adminUserId: string | null): Promise<void> {
  await setLeaguePrimaryAdmin(leagueId, adminUserId);
}

export async function patchLeagueDocJSON(
  leagueId: string,
  patch: Partial<LeagueDoc>
): Promise<LeagueDoc | null> {
  const updated = await updateLeagueFields(leagueId, {
    name: patch.name,
    description: patch.description ?? undefined,
    minTeamSize: patch.minTeamSize,
    maxTeamSize: patch.maxTeamSize,
    playerAddDeadline: patch.playerAddDeadline
      ? new Date(patch.playerAddDeadline)
      : patch.playerAddDeadline === null
        ? null
        : undefined,
    playerAddDeadlineOverride: patch.playerAddDeadlineOverride,
    approved: patch.approved,
  });
  return toLeagueDoc(updated);
}
