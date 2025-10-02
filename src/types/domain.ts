// src/types/domain.ts

// ===== ENUMS =====
export type Sport = "basketball" | "volleyball";
export type Gender = "mens" | "womens" | "co-ed";
export type PracticeDay = "Mon"|"Tue"|"Wed"|"Thu"|"Fri"|"Sat"|"Sun";
export type Role = "player" | "admin";
export type GameStatus = "scheduled" | "final" | "postponed";
export type PaymentStatus = "UNPAID" | "PENDING" | "PAID";

// ===== CORE DOMAIN TYPES =====
export type TeamFee = {
  required: boolean;
  amountCents?: number;
  paid: boolean;
  paidAt?: string;
  payerNote?: string;
};

export type Team = {
  id: string;
  name: string;

  // signup intent
  sport: Sport;
  gender: Gender;
  divisionPref: string;             // e.g. "a" | "high b" | "low b" | string
  divisionEstimate: string;             // e.g. "A" | "High B" | "Low B" | string
  practiceDays: PracticeDay[];

  // assignment
  leagueId: string | null;

  // roster policy
  minPlayers: number;
  maxPlayers: number;

  // content
  description?: string;

  // team-level fee (separate from per-player fees)
  teamFee: TeamFee;

  managerUserId: string;
  approved: boolean;

  createdAt: string;
  updatedAt: string;
};

export type RosterEntry = {
  userId: string;
  displayName: string;
  isManager: boolean;
  joinedAt: string;
  paid: boolean;                    // per-player fee
};

export type League = {
  id: string;
  name: string;
  sport: Sport;
  gender?: Gender;
  levelTag?: string;                // "a", "high b", "low b", etc.
  practiceDays?: PracticeDay[];
  description?: string;
  season?: string;

  // denorm cache for fast lists (optional)
  teamIds?: string[];

  createdAt?: string;
  updatedAt?: string;
};

export type Game = {
  id: string;
  leagueId: string;
  dateTimeISO: string;           // stored in UTC
  location: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId?: string;
  awayTeamId?: string;
  status: 'scheduled' | 'final' | 'canceled';
  homeScore?: number;
  awayScore?: number;
};

export type StandingRow = {
  leagueId: string;
  teamId: string;
  wins: number;
  losses: number;
  ties?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  rank?: number;
};

export type Membership = {
  teamId: string;
  leagueId?: string;
  leagueName?: string;
  teamName?: string;
  isManager?: boolean;
  joinedAt?: string;
  paid?: boolean;
};

// ===== USER & AUTH TYPES =====
export type UserProfile = {
  id: string;
  email?: string;
  name?: string;
  phone?: string;
  address?: string;
  createdAt: string;
};

export type Profile = { 
  roles: Role[] 
};

// ===== PLAYER INFO TYPES =====
export type PlayerTeam = {
  teamId: string;
  teamName: string;
  leagueId?: string;
  leagueName?: string;
  isManager?: boolean;
  paid?: boolean;
};

export type PlayerContact = {
  email: string;
  phone: string;
  dob: string;
  emergencyName: string;
  emergencyPhone: string;
};

export type PlayerInfo = {
  userId: string;
  displayName: string;
  contact: {
    email: string;
    phone: string;
    dob?: string;
    emergencyName?: string;
    emergencyPhone?: string;
  };
  teams: PlayerTeam[];
};

// ===== PAYMENT TYPES =====
export type PaymentStatusType = {
  teamId: string;
  userId: string;
  status: PaymentStatus;
  amountCents: number;
  createdAt: string;
  updatedAt: string;
  provider?: 'other'|'stripe';
  providerInvoiceId?: string;
  dueBy?: string;
};

export type CheckoutInput = { 
  userId: string; 
  teamId: string; 
  amountCents: number 
};

export type CheckoutOutput = { 
  redirectUrl: string; 
  providerInvoiceId: string 
};

// ===== UI/COMPONENT TYPES =====
export type TeamLite = {
  teamId: string;
  name: string;
  approved?: boolean;
};

export type RosterRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paid?: boolean;
  joinedAt?: string;
};

export type MemberPublic = {
  userId: string;
  name: string;
  role: 'LEAD'|'PLAYER';
  joinedAt: string;
};