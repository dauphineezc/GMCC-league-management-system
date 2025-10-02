// Re-export types from domain for backward compatibility
// This file can be removed once all imports are updated to use @/types/domain

export type {
  UserProfile,
  MemberPublic,
  PaymentStatusType as PaymentStatus,
  Game,
  Membership,
} from "@/types/domain";

import type { DivisionId } from "@/lib/divisions";

// Legacy Team type that differs from domain Team - keeping for now
export type Team = {
  id: string;
  name: string;
  divisionId: DivisionId;
  leadUserId: string;
  createdAt: string;
  rosterLimit: number; // 8
};