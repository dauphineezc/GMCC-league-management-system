// client-safe type exports (no server-only imports here)

export type UnassignedTeam = { teamId: string; name: string };

export type CreateLeagueState =
  | { ok: true; leagueId: string; leagueName: string; unassigned: UnassignedTeam[] }
  | { ok: false; error: string }
  | null;

export type AddTeamState = { ok: true } | { ok: false; error: string };