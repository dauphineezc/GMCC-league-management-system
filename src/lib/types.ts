// Shared TS types for Team/User/Payment/Game

import type { DivisionId } from "@/lib/divisions";

export type Team = {
  id: string;
  name: string;
  divisionId: DivisionId;
  leadUserId: string;
  createdAt: string;
  rosterLimit: number; // 8
};

export type MemberPublic = {
  userId: string;
  name: string;
  role: 'LEAD'|'PLAYER';
  joinedAt: string;
};

export type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  address?: string;
  createdAt: string;
};

export type PaymentStatus = {
  teamId: string;
  userId: string;
  status: 'UNPAID'|'PENDING'|'PAID';
  amountCents: number;
  createdAt: string;
  updatedAt: string;
  provider?: 'other'|'stripe';
  providerInvoiceId?: string;
  dueBy?: string;
};

export type Game = {
  id: string;
  divisionId: DivisionId;
  startAt: string;
  location: string;
  court?: string;
  status: 'SCHEDULED'|'FINAL';
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore?: number;
  awayScore?: number;
  round?: number;
};

export type Membership = {
  leagueId: DivisionId;
  teamId: string;
  isManager: boolean;
  teamName?: string;    // denormalized team name
  leagueName?: string;  // denormalized league name
};