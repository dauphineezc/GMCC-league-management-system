import { db } from "@/db/index";
import { leagues, teamMembers, teams, users } from "@/db/schema";
import { leaguePublicRef, resolveLeagueByRef, type LeagueRow } from "@/lib/db/resolveLeague";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

export type TeamDocRecord = Record<string, unknown>;

export type TeamCard = {
  teamId: string;
  name: string;
  description?: string;
  approved?: boolean;
};

export type MasterRosterRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paid: boolean;
};

/** Shape used by send-announcement and legacy league:players KV reads. */
export type LeaguePlayerRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paymentStatus: "PAID" | "UNPAID";
};

function teamRowToDoc(team: typeof teams.$inferSelect, league: LeagueRow | null): TeamDocRecord {
  return {
    id: team.id,
    name: team.name,
    description: team.description,
    leagueId: league ? leaguePublicRef(league) : null,
    _leagueUuid: team.leagueId,
    approved: team.approved,
    sport: team.sport,
    gender: team.gender,
    estimatedDivision: team.estimatedDivision,
    teamPaymentRequired: team.paymentRequired,
    paymentRequired: team.paymentRequired,
    createdAt: team.createdAt?.toISOString(),
    updatedAt: team.createdAt?.toISOString(),
  };
}

export async function getTeamById(teamId: string): Promise<TeamDocRecord | null> {
  const rows = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  const team = rows[0];
  if (!team) return null;

  let league: LeagueRow | null = null;
  if (team.leagueId) {
    const lr = await db.select().from(leagues).where(eq(leagues.id, team.leagueId)).limit(1);
    league = lr[0] ?? null;
  }
  return teamRowToDoc(team, league);
}

export async function batchGetTeamDocs(teamIds: string[]): Promise<Map<string, TeamDocRecord>> {
  const map = new Map<string, TeamDocRecord>();
  if (!teamIds.length) return map;

  const teamRows = await db.select().from(teams).where(inArray(teams.id, teamIds));
  const leagueUuids = Array.from(
    new Set(teamRows.map((t) => t.leagueId).filter(Boolean) as string[])
  );

  const leagueRows =
    leagueUuids.length > 0
      ? await db.select().from(leagues).where(inArray(leagues.id, leagueUuids))
      : [];
  const leagueById = new Map(leagueRows.map((l) => [l.id, l]));

  for (const team of teamRows) {
    const league = team.leagueId ? leagueById.get(team.leagueId) ?? null : null;
    map.set(`team:${team.id}`, teamRowToDoc(team, league));
    map.set(team.id, teamRowToDoc(team, league));
  }
  return map;
}

export async function batchGetTeamNames(teamIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!teamIds.length) return map;
  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(inArray(teams.id, teamIds));
  for (const r of rows) map.set(r.id, r.name);
  return map;
}

export async function getTeamIdsForLeagueRef(leagueRef: string): Promise<string[]> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return [];
  const rows = await db
    .select({ id: teams.id })
    .from(teams)
    .where(eq(teams.leagueId, league.id));
  return rows.map((r) => r.id);
}

export async function getTeamsForLeagueRef(leagueRef: string): Promise<TeamCard[]> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return [];

  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, league.id))
    .orderBy(asc(teams.name));

  return rows.map((t) => ({
    teamId: t.id,
    name: t.name,
    description: t.description ?? "",
    approved: t.approved,
  }));
}

export async function batchGetRosters(
  teamIds: string[]
): Promise<Map<string, Array<{ userId: string; displayName: string; isManager: boolean; joinedAt?: string }>>> {
  const map = new Map<string, Array<{ userId: string; displayName: string; isManager: boolean; joinedAt?: string }>>();
  if (!teamIds.length) return map;

  const rows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      isManager: teamMembers.isManager,
      joinedAt: teamMembers.joinedAt,
      displayName: users.displayName,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(inArray(teamMembers.teamId, teamIds));

  for (const id of teamIds) map.set(id, []);

  for (const r of rows) {
    const list = map.get(r.teamId) ?? [];
    list.push({
      userId: r.userId,
      displayName: r.displayName ?? r.email ?? r.userId,
      isManager: r.isManager,
      joinedAt: r.joinedAt?.toISOString() ?? new Date().toISOString(),
    });
    map.set(r.teamId, list);
  }
  return map;
}

export async function batchGetPayments(
  teamIds: string[]
): Promise<Map<string, Record<string, boolean>>> {
  const map = new Map<string, Record<string, boolean>>();
  if (!teamIds.length) return map;

  const rows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: teamMembers.userId,
      paid: teamMembers.paid,
    })
    .from(teamMembers)
    .where(inArray(teamMembers.teamId, teamIds));

  for (const id of teamIds) map.set(id, {});

  for (const r of rows) {
    const pay = map.get(r.teamId) ?? {};
    pay[r.userId] = r.paid;
    map.set(r.teamId, pay);
  }
  return map;
}

export async function buildLeagueMasterRoster(leagueRef: string): Promise<MasterRosterRow[]> {
  const cards = await getTeamsForLeagueRef(leagueRef);
  if (!cards.length) return [];

  const teamIds = cards.map((c) => c.teamId);
  const [rosters, payments] = await Promise.all([
    batchGetRosters(teamIds),
    batchGetPayments(teamIds),
  ]);

  const master: MasterRosterRow[] = [];
  for (const t of cards) {
    const roster = rosters.get(t.teamId) ?? [];
    const payMap = payments.get(t.teamId) ?? {};
    for (const entry of roster) {
      master.push({
        userId: entry.userId,
        displayName: entry.displayName,
        teamId: t.teamId,
        teamName: t.name,
        isManager: entry.isManager,
        paid: Boolean(payMap[entry.userId]),
      });
    }
  }
  return master;
}

export async function getLeaguePlayerRows(leagueRef: string): Promise<LeaguePlayerRow[]> {
  const master = await buildLeagueMasterRoster(leagueRef);
  return master.map((r) => ({
    userId: r.userId,
    displayName: r.displayName,
    teamId: r.teamId,
    teamName: r.teamName,
    isManager: r.isManager,
    paymentStatus: r.paid ? "PAID" : "UNPAID",
  }));
}

export async function createTeam(input: {
  id?: string;
  name: string;
  description?: string;
  leagueSlug?: string | null;
  managerUserId: string;
  sport?: "basketball" | "volleyball";
  gender?: "mens" | "womens" | "co-ed";
  estimatedDivision?: "low b" | "high b" | "a";
  paymentRequired?: boolean;
}): Promise<TeamDocRecord> {
  const id = input.id ?? crypto.randomUUID();
  const now = new Date();

  let leagueUuid: string | null = null;
  if (input.leagueSlug) {
    const league = await resolveLeagueByRef(input.leagueSlug);
    leagueUuid = league?.id ?? null;
  }

  const gender =
    input.gender === "co-ed" ? "coed" : (input.gender as "mens" | "womens" | undefined);
  const estimatedDivision =
    input.estimatedDivision === "low b"
      ? "low_b"
      : input.estimatedDivision === "high b"
        ? "high_b"
        : input.estimatedDivision === "a"
          ? "a"
          : undefined;

  const [team] = await db
    .insert(teams)
    .values({
      id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      leagueId: leagueUuid,
      sport: input.sport ?? "basketball",
      gender,
      estimatedDivision,
      paymentRequired: input.paymentRequired ?? false,
      approved: false,
      createdAt: now,
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: id,
    userId: input.managerUserId,
    isManager: true,
    paid: false,
    joinedAt: now,
  });

  let league: LeagueRow | null = null;
  if (leagueUuid) {
    const lr = await db.select().from(leagues).where(eq(leagues.id, leagueUuid)).limit(1);
    league = lr[0] ?? null;
  }
  return teamRowToDoc(team, league);
}

export async function assignTeamToLeagueRef(
  teamId: string,
  leagueRef: string
): Promise<{ prevLeagueRef: string | null; leagueRef: string }> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) throw new Error(`League ${leagueRef} not found`);

  const existing = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  const team = existing[0];
  if (!team) throw new Error(`Team ${teamId} not found`);

  let prevLeagueRef: string | null = null;
  if (team.leagueId) {
    const prev = await db.select().from(leagues).where(eq(leagues.id, team.leagueId)).limit(1);
    prevLeagueRef = prev[0]?.slug ?? null;
  }

  await db.update(teams).set({ leagueId: league.id }).where(eq(teams.id, teamId));
  return { prevLeagueRef, leagueRef: league.slug };
}

export async function unassignTeamFromLeagueRef(teamId: string): Promise<string | null> {
  const existing = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  const team = existing[0];
  if (!team?.leagueId) return null;

  const prev = await db.select().from(leagues).where(eq(leagues.id, team.leagueId)).limit(1);
  const prevLeagueRef = prev[0]?.slug ?? null;

  await db.update(teams).set({ leagueId: null }).where(eq(teams.id, teamId));
  return prevLeagueRef;
}

export async function toggleMemberPaid(teamId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ paid: teamMembers.paid })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  const next = !Boolean(rows[0]?.paid);
  await db
    .update(teamMembers)
    .set({ paid: next })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));
  return next;
}

export async function listAllTeamIds(): Promise<string[]> {
  const rows = await db.select({ id: teams.id }).from(teams);
  return rows.map((r) => r.id);
}

export async function findTeamInLeagueByName(
  leagueRef: string,
  teamName: string
): Promise<typeof teams.$inferSelect | null> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return null;
  const rows = await db
    .select()
    .from(teams)
    .where(and(eq(teams.leagueId, league.id), eq(teams.name, teamName.trim())))
    .limit(1);
  return rows[0] ?? null;
}

export async function getLeagueTeamNames(leagueRef: string): Promise<Set<string>> {
  const cards = await getTeamsForLeagueRef(leagueRef);
  return new Set(cards.map((c) => c.name.trim()).filter(Boolean));
}

export async function deleteTeamById(teamId: string): Promise<boolean> {
  const rows = await db.delete(teams).where(eq(teams.id, teamId)).returning({ id: teams.id });
  return rows.length > 0;
}

export async function updateTeamDescription(teamId: string, description: string): Promise<void> {
  await db
    .update(teams)
    .set({ description: description.trim() })
    .where(eq(teams.id, teamId));
}

export async function toggleTeamApproved(teamId: string): Promise<boolean> {
  const rows = await db
    .select({ approved: teams.approved })
    .from(teams)
    .where(eq(teams.id, teamId))
    .limit(1);
  const next = !Boolean(rows[0]?.approved);
  await db.update(teams).set({ approved: next }).where(eq(teams.id, teamId));
  return next;
}

export async function setTeamManager(teamId: string, newManagerUserId: string): Promise<void> {
  await db.update(teamMembers).set({ isManager: false }).where(eq(teamMembers.teamId, teamId));
  await db
    .update(teamMembers)
    .set({ isManager: true })
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, newManagerUserId)));
}

export async function getTeamRosterMeta(teamId: string): Promise<{
  roster: Array<{ userId: string; isManager: boolean }>;
  size: number;
  managerCount: number;
}> {
  const rows = await db
    .select({ userId: teamMembers.userId, isManager: teamMembers.isManager })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  return {
    roster: rows,
    size: rows.length,
    managerCount: rows.filter((r) => r.isManager).length,
  };
}

export async function isUserTeamManager(teamId: string, userId: string): Promise<boolean> {
  const rows = await db
    .select({ isManager: teamMembers.isManager })
    .from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    .limit(1);
  return Boolean(rows[0]?.isManager);
}

export async function listUnassignedTeams(): Promise<Array<{ teamId: string; name: string }>> {
  const rows = await db
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(isNull(teams.leagueId))
    .orderBy(asc(teams.name));
  return rows.map((r) => ({ teamId: r.id, name: r.name }));
}

export async function setLeagueTeamsPaymentRequired(
  leagueRef: string,
  required: boolean
): Promise<number> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return 0;
  const rows = await db
    .update(teams)
    .set({ paymentRequired: required })
    .where(eq(teams.leagueId, league.id))
    .returning({ id: teams.id });
  return rows.length;
}

