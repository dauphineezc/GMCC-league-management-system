import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { v5 as uuidv5 } from "uuid";
import {
  games,
  invites,
  leagueAdmins,
  leagues,
  schedulePdfs,
  teamMembers,
  teams,
  users,
} from "@/db/schema";
import type { KvExportSnapshot } from "@/lib/kvExport/types";

export type BackfillOptions = {
  dry?: boolean;
  fresh?: boolean;
};

export type BackfillReport = {
  dry: boolean;
  fresh: boolean;
  snapshotPath: string;
  exportedAt: string;
  upserted: Record<string, number>;
  skipped: Record<string, number>;
  warnings: string[];
};

function toDate(iso: string | null | undefined): Date | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d : undefined;
}

export function loadSnapshot(path: string): KvExportSnapshot {
  const raw = JSON.parse(readFileSync(path, "utf8")) as KvExportSnapshot;
  if (raw.version !== 1) {
    throw new Error(`Unsupported snapshot version: ${String((raw as { version?: unknown }).version)}`);
  }
  return raw;
}

async function truncateAll(db: Awaited<ReturnType<typeof getDb>>) {
  await db.execute(sql`
    TRUNCATE TABLE
      games,
      team_members,
      league_admins,
      invites,
      schedule_pdfs,
      teams,
      leagues,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function getDb() {
  const { db } = await import("@/db/index");
  return db;
}

const MIGRATION_NAMESPACE = uuidv5("gmcc-kv-migration", uuidv5.DNS);

function legacyIdToUuid(kind: "team" | "game" | "member" | "invite", legacyId: string): string {
  return uuidv5(`${kind}:${legacyId}`, MIGRATION_NAMESPACE);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

/** Mint UUIDs for legacy non-uuid team ids (e.g. seed data `t-bulls`). */
function remapLegacyTeamIds(snapshot: KvExportSnapshot): {
  snapshot: KvExportSnapshot;
  teamIdMap: Record<string, string>;
} {
  const teamIdMap: Record<string, string> = {};

  for (const team of snapshot.teams) {
    if (isUuid(team.id)) {
      teamIdMap[team.id] = team.id;
    } else if (!teamIdMap[team.id]) {
      teamIdMap[team.id] = legacyIdToUuid("team", team.id);
    }
  }

  const mapTeamId = (id: string | null | undefined): string | null => {
    if (!id) return null;
    if (teamIdMap[id]) return teamIdMap[id];
    if (isUuid(id)) return id;
    teamIdMap[id] = legacyIdToUuid("team", id);
    return teamIdMap[id];
  };

  return {
    teamIdMap,
    snapshot: {
      ...snapshot,
      teams: snapshot.teams.map((t) => ({
        ...t,
        id: mapTeamId(t.id)!,
      })),
      teamMembers: snapshot.teamMembers.map((m) => ({
        ...m,
        id: isUuid(m.id) ? m.id : legacyIdToUuid("member", m.id),
        teamId: mapTeamId(m.teamId)!,
      })),
      games: snapshot.games.map((g) => ({
        ...g,
        id: isUuid(g.id) ? g.id : legacyIdToUuid("game", g.id),
        homeTeamId: mapTeamId(g.homeTeamId),
        awayTeamId: mapTeamId(g.awayTeamId),
      })),
      invites: snapshot.invites.map((inv) => ({
        ...inv,
        id: isUuid(inv.id) ? inv.id : legacyIdToUuid("invite", inv.id),
        teamId: mapTeamId(inv.teamId)!,
      })),
    },
  };
}

export async function backfillSnapshotFromFile(
  snapshotPath: string,
  opts: BackfillOptions = {}
): Promise<BackfillReport> {
  const dry = opts.dry ?? false;
  const fresh = opts.fresh ?? false;
  const loaded = loadSnapshot(snapshotPath);
  const { snapshot, teamIdMap } = remapLegacyTeamIds(loaded);
  const warnings = [...snapshot.warnings];

  if (Object.keys(teamIdMap).some((k) => k !== teamIdMap[k])) {
    const remapped = Object.entries(teamIdMap).filter(([k, v]) => k !== v).length;
    warnings.push(`Remapped ${remapped} legacy team id(s) to UUIDs during backfill`);
  }

  const report: BackfillReport = {
    dry,
    fresh,
    snapshotPath,
    exportedAt: snapshot.exportedAt,
    upserted: {},
    skipped: {},
    warnings,
  };

  const bump = (key: string, field: "upserted" | "skipped") => {
    report[field][key] = (report[field][key] ?? 0) + 1;
  };

  if (dry) {
    report.upserted = { ...snapshot.counts };
    delete (report.upserted as { warnings?: number }).warnings;
    return report;
  }

  const db = await getDb();

  if (fresh) {
    await truncateAll(db);
  }

  const userIds = new Set(snapshot.users.map((u) => u.id));
  const teamIds = new Set(snapshot.teams.map((t) => t.id));
  const leagueIds = new Set(snapshot.leagues.map((l) => l.id));

  // 1. users
  for (const u of snapshot.users) {
    await db
      .insert(users)
      .values({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        isSuperadmin: u.isSuperadmin,
        createdAt: toDate(u.createdAt) ?? new Date(),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: u.email,
          displayName: u.displayName,
          isSuperadmin: u.isSuperadmin,
        },
      });
    bump("users", "upserted");
  }

  // 2. leagues
  for (const l of snapshot.leagues) {
    try {
      await db
        .insert(leagues)
        .values({
          id: l.id,
          slug: l.slug,
          name: l.name,
          sport: l.sport,
          gender: l.gender,
          division: l.division,
          description: l.description,
          minTeamSize: l.minTeamSize,
          maxTeamSize: l.maxTeamSize,
          playerAddDeadline: toDate(l.playerAddDeadline),
          playerAddDeadlineOverride: l.playerAddDeadlineOverride,
          approved: l.approved,
          createdAt: toDate(l.createdAt) ?? new Date(),
          updatedAt: toDate(l.updatedAt) ?? toDate(l.createdAt) ?? new Date(),
        })
        .onConflictDoUpdate({
          target: leagues.id,
          set: {
            slug: l.slug,
            name: l.name,
            sport: l.sport,
            gender: l.gender,
            division: l.division,
            description: l.description,
            minTeamSize: l.minTeamSize,
            maxTeamSize: l.maxTeamSize,
            playerAddDeadline: toDate(l.playerAddDeadline),
            playerAddDeadlineOverride: l.playerAddDeadlineOverride,
            approved: l.approved,
            updatedAt: toDate(l.updatedAt) ?? new Date(),
          },
        });
      bump("leagues", "upserted");
    } catch (err) {
      warnings.push(
        `Failed league ${l.slug}: ${err instanceof Error ? err.message : String(err)}`
      );
      bump("leagues", "skipped");
    }
  }

  // 3. teams
  for (const t of snapshot.teams) {
    if (t.leagueId && !leagueIds.has(t.leagueId)) {
      warnings.push(`Skipped team ${t.id}: unknown leagueId ${t.leagueId}`);
      bump("teams", "skipped");
      continue;
    }

    try {
      await db
        .insert(teams)
        .values({
          id: t.id,
          leagueId: t.leagueId,
          name: t.name,
          description: t.description,
          approved: t.approved,
          sport: t.sport,
          gender: t.gender,
          estimatedDivision: t.estimatedDivision,
          paymentRequired: t.paymentRequired,
          teamFeePaid: t.teamFeePaid,
          createdAt: toDate(t.createdAt) ?? new Date(),
        })
        .onConflictDoUpdate({
          target: teams.id,
          set: {
            leagueId: t.leagueId,
            name: t.name,
            description: t.description,
            approved: t.approved,
            sport: t.sport,
            gender: t.gender,
            estimatedDivision: t.estimatedDivision,
            paymentRequired: t.paymentRequired,
            teamFeePaid: t.teamFeePaid,
          },
        });
      bump("teams", "upserted");
    } catch (err) {
      warnings.push(
        `Failed team ${t.id} (${t.name}): ${err instanceof Error ? err.message : String(err)}`
      );
      bump("teams", "skipped");
    }
  }

  // 4. team_members
  for (const m of snapshot.teamMembers) {
    if (!userIds.has(m.userId)) {
      warnings.push(`Skipped team_member ${m.id}: unknown userId ${m.userId}`);
      bump("teamMembers", "skipped");
      continue;
    }
    if (!teamIds.has(m.teamId)) {
      warnings.push(`Skipped team_member ${m.id}: unknown teamId ${m.teamId}`);
      bump("teamMembers", "skipped");
      continue;
    }

    await db
      .insert(teamMembers)
      .values({
        id: m.id,
        teamId: m.teamId,
        userId: m.userId,
        isManager: m.isManager,
        paid: m.paid,
        joinedAt: toDate(m.joinedAt) ?? new Date(),
      })
      .onConflictDoUpdate({
        target: [teamMembers.teamId, teamMembers.userId],
        set: {
          isManager: m.isManager,
          paid: m.paid,
          joinedAt: toDate(m.joinedAt) ?? new Date(),
        },
      });
    bump("teamMembers", "upserted");
  }

  // 5. games
  for (const g of snapshot.games) {
    if (!leagueIds.has(g.leagueId)) {
      warnings.push(`Skipped game ${g.id}: unknown leagueId ${g.leagueId}`);
      bump("games", "skipped");
      continue;
    }

    const homeTeamId = g.homeTeamId && teamIds.has(g.homeTeamId) ? g.homeTeamId : null;
    const awayTeamId = g.awayTeamId && teamIds.has(g.awayTeamId) ? g.awayTeamId : null;
    if (g.homeTeamId && !homeTeamId) {
      warnings.push(`Game ${g.id}: dropped unknown homeTeamId ${g.homeTeamId}`);
    }
    if (g.awayTeamId && !awayTeamId) {
      warnings.push(`Game ${g.id}: dropped unknown awayTeamId ${g.awayTeamId}`);
    }

    await db
      .insert(games)
      .values({
        id: g.id,
        leagueId: g.leagueId,
        homeTeamId,
        awayTeamId,
        homeTeamName: g.homeTeamName,
        awayTeamName: g.awayTeamName,
        location: g.location,
        startsAt: toDate(g.startsAt),
        status: g.status,
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        createdAt: toDate(g.createdAt) ?? new Date(),
      })
      .onConflictDoUpdate({
        target: games.id,
        set: {
          leagueId: g.leagueId,
          homeTeamId,
          awayTeamId,
          homeTeamName: g.homeTeamName,
          awayTeamName: g.awayTeamName,
          location: g.location,
          startsAt: toDate(g.startsAt),
          status: g.status,
          homeScore: g.homeScore,
          awayScore: g.awayScore,
        },
      });
    bump("games", "upserted");
  }

  // 6. league_admins
  for (const a of snapshot.leagueAdmins) {
    if (!leagueIds.has(a.leagueId)) {
      bump("leagueAdmins", "skipped");
      continue;
    }
    if (!userIds.has(a.userId)) {
      warnings.push(`Skipped league_admin: unknown userId ${a.userId} for league ${a.leagueId}`);
      bump("leagueAdmins", "skipped");
      continue;
    }

    await db
      .insert(leagueAdmins)
      .values({
        leagueId: a.leagueId,
        userId: a.userId,
      })
      .onConflictDoNothing({
        target: [leagueAdmins.leagueId, leagueAdmins.userId],
      });
    bump("leagueAdmins", "upserted");
  }

  // 7. invites
  for (const inv of snapshot.invites) {
    if (!teamIds.has(inv.teamId)) {
      bump("invites", "skipped");
      continue;
    }
    if (inv.createdBy && !userIds.has(inv.createdBy)) {
      warnings.push(`Invite ${inv.id}: dropped unknown createdBy ${inv.createdBy}`);
    }

    await db
      .insert(invites)
      .values({
        id: inv.id,
        code: inv.code,
        teamId: inv.teamId,
        createdBy: inv.createdBy && userIds.has(inv.createdBy) ? inv.createdBy : null,
        expiresAt: toDate(inv.expiresAt),
        usedAt: null,
        usedBy: null,
      })
      .onConflictDoUpdate({
        target: invites.code,
        set: {
          teamId: inv.teamId,
          createdBy: inv.createdBy && userIds.has(inv.createdBy) ? inv.createdBy : null,
          expiresAt: toDate(inv.expiresAt),
        },
      });
    bump("invites", "upserted");
  }

  // 8. schedule_pdfs — bytes are stored inline (b64:) after cutover; skip KV placeholders.
  for (const pdf of snapshot.schedulePdfs) {
    void pdf;
    bump("schedulePdfs", "skipped");
  }

  report.warnings = warnings;
  return report;
}

export async function countPostgresRows(): Promise<Record<string, number>> {
  const db = await getDb();
  const [u, l, t, tm, g, la, inv, pdf] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(users),
    db.select({ n: sql<number>`count(*)::int` }).from(leagues),
    db.select({ n: sql<number>`count(*)::int` }).from(teams),
    db.select({ n: sql<number>`count(*)::int` }).from(teamMembers),
    db.select({ n: sql<number>`count(*)::int` }).from(games),
    db.select({ n: sql<number>`count(*)::int` }).from(leagueAdmins),
    db.select({ n: sql<number>`count(*)::int` }).from(invites),
    db.select({ n: sql<number>`count(*)::int` }).from(schedulePdfs),
  ]);

  return {
    users: u[0]?.n ?? 0,
    leagues: l[0]?.n ?? 0,
    teams: t[0]?.n ?? 0,
    teamMembers: tm[0]?.n ?? 0,
    games: g[0]?.n ?? 0,
    leagueAdmins: la[0]?.n ?? 0,
    invites: inv[0]?.n ?? 0,
    schedulePdfs: pdf[0]?.n ?? 0,
  };
}
