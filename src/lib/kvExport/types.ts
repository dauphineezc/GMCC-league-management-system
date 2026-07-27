import type { Division, Gender, Sport } from "@/db/schema";

export type ExportUser = {
  id: string;
  email: string;
  displayName: string | null;
  isSuperadmin: boolean;
  createdAt: string | null;
  sources: string[];
};

export type ExportLeague = {
  id: string;
  slug: string;
  legacyId: string;
  name: string;
  sport: Sport | null;
  gender: Gender | null;
  division: Division | null;
  description: string | null;
  minTeamSize: number | null;
  maxTeamSize: number | null;
  playerAddDeadline: string | null;
  playerAddDeadlineOverride: boolean;
  approved: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type ExportTeam = {
  id: string;
  leagueId: string | null;
  legacyLeagueId: string | null;
  name: string;
  description: string | null;
  approved: boolean;
  sport: Sport | null;
  gender: Gender | null;
  estimatedDivision: Division | null;
  paymentRequired: boolean;
  teamFeePaid: boolean;
  createdAt: string | null;
  managerUserId: string | null;
};

export type ExportTeamMember = {
  id: string;
  teamId: string;
  userId: string;
  isManager: boolean;
  paid: boolean;
  joinedAt: string | null;
  displayName: string | null;
};

export type ExportGame = {
  id: string;
  leagueId: string;
  legacyLeagueId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeTeamName: string | null;
  awayTeamName: string | null;
  location: string | null;
  startsAt: string | null;
  status: "scheduled" | "final" | "canceled";
  homeScore: number | null;
  awayScore: number | null;
  createdAt: string | null;
  legacyId: string | null;
};

export type ExportLeagueAdmin = {
  leagueId: string;
  legacyLeagueId: string;
  userId: string;
  source: "admin_set" | "legacy_email_set" | "league_doc";
};

export type ExportInvite = {
  id: string;
  code: string;
  kind: "code" | "token";
  teamId: string;
  createdBy: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  legacyKey: string;
};

export type ExportSchedulePdf = {
  leagueId: string;
  legacyLeagueId: string;
  legacyKvKey: string;
  hasContent: boolean;
  contentLength: number | null;
  filename: string | null;
};

export type ExportCounts = {
  users: number;
  leagues: number;
  teams: number;
  teamMembers: number;
  games: number;
  leagueAdmins: number;
  invites: number;
  schedulePdfs: number;
  warnings: number;
};

export type KvExportSnapshot = {
  version: 1;
  exportedAt: string;
  counts: ExportCounts;
  idMaps: {
    legacyLeagueIdToUuid: Record<string, string>;
    leagueUuidToSlug: Record<string, string>;
  };
  users: ExportUser[];
  leagues: ExportLeague[];
  teams: ExportTeam[];
  teamMembers: ExportTeamMember[];
  games: ExportGame[];
  leagueAdmins: ExportLeagueAdmin[];
  invites: ExportInvite[];
  schedulePdfs: ExportSchedulePdf[];
  warnings: string[];
};

export type ExportKvOptions = {
  includeFirebaseUsers?: boolean;
  includeInviteScan?: boolean;
};
