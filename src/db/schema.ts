import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Game status. Well-defined and enforced at the DB level. Other categorical
 * fields (sport/gender/division) are kept as text + app-level unions for now,
 * since legacy KV data needs normalizing during backfill.
 */
export const gameStatus = pgEnum("game_status", ["scheduled", "final", "canceled"]);

export type Sport = "basketball" | "volleyball";
export type Gender = "mens" | "womens" | "coed";
export type Division = "low_b" | "high_b" | "a";

/** One row per Firebase account. id is the Firebase UID — no surrogate key. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Replaces league:{id} doc + leagues:index. slug carries the human-readable URL. */
export const leagues = pgTable(
  "leagues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    sport: text("sport").$type<Sport>(),
    gender: text("gender").$type<Gender>(),
    division: text("division").$type<Division>(),
    description: text("description"),
    minTeamSize: integer("min_team_size"),
    maxTeamSize: integer("max_team_size"),
    playerAddDeadline: timestamp("player_add_deadline", { withTimezone: true }),
    playerAddDeadlineOverride: boolean("player_add_deadline_override")
      .notNull()
      .default(false),
    approved: boolean("approved").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

/** Replaces team:{id} doc + teams:index. league_id is null for unassigned teams. */
export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id").references(() => leagues.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    approved: boolean("approved").notNull().default(false),
    sport: text("sport").$type<Sport>(),
    gender: text("gender").$type<Gender>(),
    estimatedDivision: text("estimated_division").$type<Division>(),
    paymentRequired: boolean("payment_required").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("teams_league_id_idx").on(t.leagueId),
    unique("teams_league_name_uq").on(t.leagueId, t.name),
  ],
);

/**
 * Collapses team:{id}:roster, team:{id}:payments, league:{id}:players, and
 * user:{uid}:memberships into one join table.
 */
export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isManager: boolean("is_manager").notNull().default(false),
    paid: boolean("paid").notNull().default(false),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("team_members_team_user_uq").on(t.teamId, t.userId),
    index("team_members_team_id_idx").on(t.teamId),
    index("team_members_user_id_idx").on(t.userId),
  ],
);

/**
 * Replaces league:{id}:games and the denormalized team:{id}:games (now derived
 * by query). team name columns are snapshots for display stability.
 */
export const games = pgTable(
  "games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    homeTeamId: uuid("home_team_id").references(() => teams.id, { onDelete: "set null" }),
    awayTeamId: uuid("away_team_id").references(() => teams.id, { onDelete: "set null" }),
    homeTeamName: text("home_team_name"),
    awayTeamName: text("away_team_name"),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    status: gameStatus("status").notNull().default("scheduled"),
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("games_league_id_idx").on(t.leagueId),
    index("games_home_team_id_idx").on(t.homeTeamId),
    index("games_away_team_id_idx").on(t.awayTeamId),
  ],
);

/** Replaces admin:{uid}:leagues, legacy admin:{email}:leagues, and league:{id}:admins sets. */
export const leagueAdmins = pgTable(
  "league_admins",
  {
    leagueId: uuid("league_id")
      .notNull()
      .references(() => leagues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.leagueId, t.userId] }),
    index("league_admins_user_id_idx").on(t.userId),
  ],
);

/** Backs the invites + join-by-code flow. */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: text("used_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("invites_team_id_idx").on(t.teamId)],
);

/**
 * Replaces the base64 PDF stored under league:{id}:schedule. Prefer object
 * storage (Vercel Blob) with a reference row over storing bytes in Postgres.
 */
export const schedulePdfs = pgTable("schedule_pdfs", {
  leagueId: uuid("league_id")
    .primaryKey()
    .references(() => leagues.id, { onDelete: "cascade" }),
  blobUrl: text("blob_url").notNull(),
  filename: text("filename"),
  size: integer("size"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type League = typeof leagues.$inferSelect;
export type NewLeague = typeof leagues.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type LeagueAdmin = typeof leagueAdmins.$inferSelect;
export type NewLeagueAdmin = typeof leagueAdmins.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
export type SchedulePdf = typeof schedulePdfs.$inferSelect;
export type NewSchedulePdf = typeof schedulePdfs.$inferInsert;
