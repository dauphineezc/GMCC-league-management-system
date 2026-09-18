// Re-export types from domain for backward compatibility
// This file can be removed once all imports are updated to use @/types/domain

export type {
  UserProfile,
  MemberPublic,
  Game,
  Membership,
} from "@/types/domain";

// Legacy Team type that differs from domain Team - keeping for now
export type Team = {
  id: string;
  name: string;
  /** League slug / id (legacy field name). */
  divisionId: string;
  leadUserId: string;
  createdAt: string;
  rosterLimit: number; // 8
};
