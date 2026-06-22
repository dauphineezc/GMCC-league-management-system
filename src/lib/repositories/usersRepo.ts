import { db } from "@/db/index";
import { leagueAdmins, leagues, teamMembers, teams, users } from "@/db/schema";
import { eq, inArray, and } from "drizzle-orm";

export async function getUserDoc(uid: string): Promise<Record<string, unknown> | null> {
  const rows = await db.select().from(users).where(eq(users.id, uid)).limit(1);
  const u = rows[0];
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    isSuperadmin: u.isSuperadmin,
    createdAt: u.createdAt?.toISOString(),
  };
}

export async function upsertUserProfile(input: {
  id: string;
  email: string;
  displayName?: string | null;
  isSuperadmin?: boolean;
}): Promise<void> {
  await db
    .insert(users)
    .values({
      id: input.id,
      email: input.email.toLowerCase(),
      displayName: input.displayName ?? null,
      isSuperadmin: input.isSuperadmin ?? false,
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        email: input.email.toLowerCase(),
        displayName: input.displayName ?? null,
        isSuperadmin: input.isSuperadmin ?? false,
      },
    });
}

export type MembershipRow = {
  teamId: string;
  leagueId: string | null;
  isManager: boolean;
  teamName?: string | null;
  leagueName?: string | null;
};

export async function readMembershipsForUid(
  uid: string,
  _email?: string | null
): Promise<MembershipRow[]> {
  const rows = await db
    .select({
      teamId: teamMembers.teamId,
      isManager: teamMembers.isManager,
      teamName: teams.name,
      leagueSlug: leagues.slug,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(leagues, eq(teams.leagueId, leagues.id))
    .where(eq(teamMembers.userId, uid));

  const seen = new Set<string>();
  const out: MembershipRow[] = [];
  for (const r of rows) {
    if (seen.has(r.teamId)) continue;
    seen.add(r.teamId);
    out.push({
      teamId: r.teamId,
      leagueId: r.leagueSlug ?? null,
      isManager: r.isManager,
      teamName: r.teamName,
      leagueName: r.leagueSlug ?? null,
    });
  }
  return out;
}

export async function getUserDisplayName(uid: string): Promise<string> {
  const doc = await getUserDoc(uid);
  return String(doc?.displayName ?? doc?.email ?? uid);
}

export async function readMembershipsForUids(
  uids: string[]
): Promise<Map<string, MembershipRow[]>> {
  const map = new Map<string, MembershipRow[]>();
  if (!uids.length) return map;
  for (const uid of uids) map.set(uid, []);

  const rows = await db
    .select({
      userId: teamMembers.userId,
      teamId: teamMembers.teamId,
      isManager: teamMembers.isManager,
      teamName: teams.name,
      leagueSlug: leagues.slug,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .leftJoin(leagues, eq(teams.leagueId, leagues.id))
    .where(inArray(teamMembers.userId, uids));

  for (const r of rows) {
    const list = map.get(r.userId) ?? [];
    if (list.some((m) => m.teamId === r.teamId)) continue;
    list.push({
      teamId: r.teamId,
      leagueId: r.leagueSlug ?? null,
      isManager: r.isManager,
      teamName: r.teamName,
      leagueName: r.leagueSlug ?? null,
    });
    map.set(r.userId, list);
  }
  return map;
}

export async function deleteUserAccount(uid: string): Promise<{
  rostersUpdated: number;
  teamsDeleted: number;
}> {
  let rostersUpdated = 0;
  let teamsDeleted = 0;

  const memberships = await db
    .select({ teamId: teamMembers.teamId, isManager: teamMembers.isManager })
    .from(teamMembers)
    .where(eq(teamMembers.userId, uid));

  for (const { teamId } of memberships) {
    const roster = await db
      .select({ userId: teamMembers.userId, isManager: teamMembers.isManager })
      .from(teamMembers)
      .where(eq(teamMembers.teamId, teamId));

    if (roster.length === 1 && roster[0].userId === uid) {
      await db.delete(teams).where(eq(teams.id, teamId));
      teamsDeleted++;
      continue;
    }

    const isOnlyManager =
      roster.filter((r) => r.isManager).length === 1 &&
      roster.some((r) => r.userId === uid && r.isManager);

    if (isOnlyManager && roster.length > 1) {
      const successor = roster.find((r) => r.userId !== uid);
      if (successor) {
        await db
          .update(teamMembers)
          .set({ isManager: true })
          .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, successor.userId)));
      }
    }

    await db
      .delete(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, uid)));
    rostersUpdated++;
  }

  await db.delete(leagueAdmins).where(eq(leagueAdmins.userId, uid));
  await db.delete(users).where(eq(users.id, uid));

  return { rostersUpdated, teamsDeleted };
}
