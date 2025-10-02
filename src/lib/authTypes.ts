import type { DecodedIdToken } from "firebase-admin/auth";

export type LMSClaims = {
  superadmin?: boolean;
  leagueAdminOf?: string[];
  teamManagerOf?: string[];
};

export type LMSUser = DecodedIdToken & LMSClaims;