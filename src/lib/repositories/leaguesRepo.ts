import { db } from "@/db/index";
import { leagueAdmins, leagues } from "@/db/schema";
import { leaguePublicRef, resolveLeagueByRef, type LeagueRow } from "@/lib/db/resolveLeague";
import { and, asc, eq, or } from "drizzle-orm";

export type LeagueDocRecord = Record<string, unknown>;

export async function listLeagueSlugs(opts?: {
  onlyApproved?: boolean;
  sport?: string;
}): Promise<string[]> {
  const rows = await db.select().from(leagues).orderBy(asc(leagues.name));
  const sportFilter = opts?.sport?.trim().toLowerCase();
  const onlyApproved = opts?.onlyApproved ?? false;

  return rows
    .filter((l) => {
      if (onlyApproved && !l.approved) return false;
      if (sportFilter && (l.sport ?? "").toLowerCase() !== sportFilter) return false;
      return Boolean(l.sport);
    })
    .map((l) => l.slug);
}

export async function getPrimaryLeagueAdminUserId(
  leagueUuid: string
): Promise<string | null> {
  const rows = await db
    .select({ userId: leagueAdmins.userId })
    .from(leagueAdmins)
    .where(eq(leagueAdmins.leagueId, leagueUuid))
    .limit(1);
  return rows[0]?.userId ?? null;
}

export function leagueRowToDoc(
  league: LeagueRow,
  adminUserId: string | null = null
): LeagueDocRecord {
  return {
    id: leaguePublicRef(league),
    _uuid: league.id,
    name: league.name,
    description: league.description,
    sport: league.sport,
    gender: league.gender,
    division: league.division,
    minTeamSize: league.minTeamSize,
    maxTeamSize: league.maxTeamSize,
    playerAddDeadline: league.playerAddDeadline?.toISOString() ?? null,
    playerAddDeadlineOverride: league.playerAddDeadlineOverride,
    approved: league.approved,
    adminUserId,
    createdAt: league.createdAt?.toISOString(),
    updatedAt: league.updatedAt?.toISOString(),
  };
}

export async function readLeagueDocByRef(ref: string): Promise<LeagueDocRecord | null> {
  const league = await resolveLeagueByRef(ref);
  if (!league) return null;
  const adminUserId = await getPrimaryLeagueAdminUserId(league.id);
  return leagueRowToDoc(league, adminUserId);
}

export async function listManagedLeagueRefs(user: {
  id: string;
  email: string | null;
  leagueAdminOf?: string[];
}): Promise<string[]> {
  const refs = new Set<string>();

  const adminRows = await db
    .select({ slug: leagues.slug, id: leagues.id })
    .from(leagueAdmins)
    .innerJoin(leagues, eq(leagueAdmins.leagueId, leagues.id))
    .where(eq(leagueAdmins.userId, user.id));

  for (const row of adminRows) refs.add(row.slug);

  if (Array.isArray(user.leagueAdminOf)) {
    for (const claimId of user.leagueAdminOf) {
      const league = await resolveLeagueByRef(claimId);
      if (league) refs.add(league.slug);
      else refs.add(claimId);
    }
  }

  return Array.from(refs).filter(Boolean);
}

export async function isUserLeagueAdmin(
  user: { id: string; email: string | null; superadmin?: boolean; leagueAdminOf?: string[] },
  leagueRef: string
): Promise<boolean> {
  if (user.superadmin) return true;

  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return false;

  const adminHit = await db
    .select({ userId: leagueAdmins.userId })
    .from(leagueAdmins)
    .where(and(eq(leagueAdmins.leagueId, league.id), eq(leagueAdmins.userId, user.id)))
    .limit(1);
  if (adminHit.length) return true;

  if (Array.isArray(user.leagueAdminOf)) {
    if (user.leagueAdminOf.includes(league.slug) || user.leagueAdminOf.includes(league.id)) {
      return true;
    }
  }

  return false;
}

export async function setLeaguePrimaryAdmin(
  leagueRef: string,
  adminUserId: string | null
): Promise<void> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) throw new Error("League not found");

  await db.delete(leagueAdmins).where(eq(leagueAdmins.leagueId, league.id));
  if (adminUserId) {
    await db
      .insert(leagueAdmins)
      .values({ leagueId: league.id, userId: adminUserId })
      .onConflictDoNothing();
  }

  await db
    .update(leagues)
    .set({ updatedAt: new Date() })
    .where(eq(leagues.id, league.id));
}

export async function updateLeagueFields(
  leagueRef: string,
  patch: Partial<{
    name: string;
    description: string | null;
    minTeamSize: number | null;
    maxTeamSize: number | null;
    playerAddDeadline: Date | null;
    playerAddDeadlineOverride: boolean;
    approved: boolean;
  }>
): Promise<LeagueDocRecord | null> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return null;

  const [updated] = await db
    .update(leagues)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(leagues.id, league.id))
    .returning();

  if (!updated) return null;
  const adminUserId = await getPrimaryLeagueAdminUserId(updated.id);
  return leagueRowToDoc(updated, adminUserId);
}

export async function addLeagueAdmin(leagueRef: string, userId: string): Promise<void> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) throw new Error("League not found");
  await db
    .insert(leagueAdmins)
    .values({ leagueId: league.id, userId })
    .onConflictDoNothing();
}

export async function removeLeagueAdmin(leagueRef: string, userId: string): Promise<void> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) throw new Error("League not found");
  await db
    .delete(leagueAdmins)
    .where(and(eq(leagueAdmins.leagueId, league.id), eq(leagueAdmins.userId, userId)));
}

export async function listLeagueRefsForAdminUser(userId: string): Promise<string[]> {
  const rows = await db
    .select({ slug: leagues.slug })
    .from(leagueAdmins)
    .innerJoin(leagues, eq(leagueAdmins.leagueId, leagues.id))
    .where(eq(leagueAdmins.userId, userId));
  return rows.map((r) => r.slug);
}

export async function listAllLeaguesLite(opts?: {
  onlyApproved?: boolean;
  sport?: string;
}): Promise<Array<{ id: string; name: string; sport: string }>> {
  const rows = await db.select().from(leagues).orderBy(asc(leagues.name));
  const sportFilter = opts?.sport?.trim().toLowerCase();
  const onlyApproved = opts?.onlyApproved ?? true;

  return rows
    .filter((l) => {
      if (!l.sport) return false;
      if (onlyApproved && !l.approved) return false;
      if (sportFilter && l.sport.toLowerCase() !== sportFilter) return false;
      return true;
    })
    .map((l) => ({ id: l.slug, name: l.name, sport: l.sport! }));
}

function slugifyName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function uniqueLeagueSlug(base: string): Promise<string> {
  let slug = base || "league";
  let suffix = 0;
  while (true) {
    const candidate = suffix === 0 ? slug : `${slug}-${suffix}`;
    const hit = await resolveLeagueByRef(candidate);
    if (!hit) return candidate;
    suffix++;
  }
}

export async function createLeagueRecord(input: {
  name: string;
  description?: string;
  sport: string;
  gender: string;
  division: string;
  minTeamSize?: number;
  maxTeamSize?: number;
  adminUserId?: string | null;
  slug?: string;
}): Promise<{ id: string; slug: string; name: string }> {
  const baseSlug = slugifyName(input.slug ?? input.name);
  const slug = await uniqueLeagueSlug(baseSlug);
  const now = new Date();

  const [league] = await db
    .insert(leagues)
    .values({
      slug,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sport: input.sport as "basketball" | "volleyball",
      gender: input.gender as "mens" | "womens" | "coed",
      division: input.division as "low_b" | "high_b" | "a",
      minTeamSize: input.minTeamSize ?? null,
      maxTeamSize: input.maxTeamSize ?? null,
      approved: false,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (input.adminUserId) {
    await db
      .insert(leagueAdmins)
      .values({ leagueId: league.id, userId: input.adminUserId })
      .onConflictDoNothing();
  }

  return { id: league.id, slug: league.slug, name: league.name };
}

export async function deleteLeagueByRef(leagueRef: string): Promise<boolean> {
  const league = await resolveLeagueByRef(leagueRef);
  if (!league) return false;
  await db.delete(leagues).where(eq(leagues.id, league.id));
  return true;
}
