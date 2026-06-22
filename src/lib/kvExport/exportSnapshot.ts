import { kv } from "@vercel/kv";
import {
  batchGetPayments,
  batchGetRosters,
  batchGetTeams,
} from "@/lib/kvBatch";
import {
  readArr,
  readDoc,
  readLeagueDoc,
  smembersSafe,
} from "@/lib/kvHelpers";
import { readLeagueGames } from "@/lib/leagueData";
import { SCHEDULE_KEY } from "@/lib/scheduleKv";
import {
  dedupeStrings,
  leagueSlugFromLegacyId,
  normalizeDivision,
  normalizeGameStatus,
  normalizeGender,
  normalizeSport,
  parseIntOrNull,
  parseIsoTimestamp,
  truthy,
} from "@/lib/kvExport/normalize";
import { scanKeys } from "@/lib/kvExport/scanKeys";
import { listFirebaseUsersForExport } from "@/lib/kvExport/listFirebaseUsers";
import type {
  ExportGame,
  ExportInvite,
  ExportKvOptions,
  ExportLeague,
  ExportLeagueAdmin,
  ExportSchedulePdf,
  ExportTeam,
  ExportTeamMember,
  ExportUser,
  KvExportSnapshot,
} from "@/lib/kvExport/types";

function explodeIndexMembers(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.flatMap(explodeIndexMembers);
  const s = String(raw).trim();
  if (!s) return [];
  try {
    if (s.startsWith("[") && s.endsWith("]")) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.flatMap(explodeIndexMembers);
    }
  } catch {
    /* ignore */
  }
  if (s.includes(",")) return s.split(",").map((x) => x.trim()).filter(Boolean);
  return [s];
}

/** Tolerant reader for admin:{id}:leagues (SET, JSON array, CSV, single string). */
async function readAdminLeagueIds(key: string): Promise<string[]> {
  const fromSet = await smembersSafe(key);
  if (fromSet.length) return fromSet;

  let raw: unknown;
  try {
    raw = await kv.get(key);
  } catch {
    return [];
  }
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);

  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch {
      if (s.includes(",")) return s.split(",").map((t) => t.trim()).filter(Boolean);
      return [s];
    }
  }

  return [];
}

async function collectLegacyLeagueIds(): Promise<string[]> {
  const fromSet = explodeIndexMembers(await smembersSafe("leagues:index"));
  const legacyIndex = await readArr<{ id?: string }>("league:index");
  const fromLegacyIndex = legacyIndex.map((row) => String(row?.id ?? "")).filter(Boolean);

  const teamIds = await collectTeamIds(new Set());
  const teamsMap = await batchGetTeams(teamIds);
  const fromTeams = teamIds
    .map((id) => teamsMap.get(`team:${id}`)?.leagueId)
    .filter(Boolean)
    .map(String);

  return dedupeStrings([...fromSet, ...fromLegacyIndex, ...fromTeams]);
}

async function collectTeamIds(seenLeagues: Set<string>): Promise<string[]> {
  const fromIndex = explodeIndexMembers(await smembersSafe("teams:index"));
  const fromLeagueSets: string[] = [];

  for (const leagueId of seenLeagues) {
    const ids = await smembersSafe(`league:${leagueId}:teams`);
    fromLeagueSets.push(...ids);
  }

  return dedupeStrings([...fromIndex, ...fromLeagueSets]);
}

function emailToUid(
  identifier: string,
  firebaseByEmail: Map<string, string>,
  warnings: string[]
): string | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("@")) return trimmed;
  const uid = firebaseByEmail.get(trimmed.toLowerCase());
  if (!uid) warnings.push(`Could not resolve admin email to uid: ${trimmed}`);
  return uid ?? null;
}

function gameScores(g: Record<string, unknown>): {
  homeScore: number | null;
  awayScore: number | null;
  hasScores: boolean;
} {
  const score = g.score as { home?: unknown; away?: unknown } | undefined;
  const homeScore = parseIntOrNull(g.homeScore ?? score?.home);
  const awayScore = parseIntOrNull(g.awayScore ?? score?.away);
  return {
    homeScore,
    awayScore,
    hasScores: homeScore != null && awayScore != null,
  };
}

function stableGameId(
  g: Record<string, unknown>,
  legacyLeagueId: string
): { id: string; legacyId: string | null } {
  const existing = String(g.id ?? "").trim();
  if (existing) return { id: existing, legacyId: existing };

  const dateTimeISO =
    g.dateTimeISO || g.date || g.startTimeISO || g.start || "";
  const home = g.homeTeamName || g.homeName || g.homeTeamId || "home";
  const away = g.awayTeamName || g.awayName || g.awayTeamId || "away";
  const legacyId = `game:${legacyLeagueId}:${dateTimeISO}:${home}-${away}`;
  return { id: crypto.randomUUID(), legacyId };
}

export async function exportKvSnapshot(
  opts: ExportKvOptions = {}
): Promise<KvExportSnapshot> {
  const includeFirebaseUsers = opts.includeFirebaseUsers ?? true;
  const includeInviteScan = opts.includeInviteScan ?? true;
  const warnings: string[] = [];
  const exportedAt = new Date().toISOString();

  const legacyLeagueIdToUuid: Record<string, string> = {};
  const leagueUuidToSlug: Record<string, string> = {};

  const legacyLeagueIds = await collectLegacyLeagueIds();
  const usedSlugs = new Set<string>();
  for (const legacyId of legacyLeagueIds) {
    const uuid = crypto.randomUUID();
    const slug = leagueSlugFromLegacyId(legacyId);
    if (usedSlugs.has(slug)) {
      warnings.push(`Slug collision for legacy league id "${legacyId}" → "${slug}"`);
    }
    usedSlugs.add(slug);
    legacyLeagueIdToUuid[legacyId] = uuid;
    leagueUuidToSlug[uuid] = slug;
  }

  const resolveLeagueUuid = (legacyId: string | null | undefined): string | null => {
    if (!legacyId) return null;
    const id = String(legacyId).trim();
    if (!id) return null;
    if (legacyLeagueIdToUuid[id]) return legacyLeagueIdToUuid[id];
    const uuid = crypto.randomUUID();
    const slug = leagueSlugFromLegacyId(id);
    legacyLeagueIdToUuid[id] = uuid;
    leagueUuidToSlug[uuid] = slug;
    warnings.push(`League id "${id}" was not in index; minted uuid during export`);
    return uuid;
  };

  const leagues: ExportLeague[] = [];
  for (const legacyId of Object.keys(legacyLeagueIdToUuid)) {
    const doc = (await readLeagueDoc(legacyId)) ?? {};
    const uuid = legacyLeagueIdToUuid[legacyId];
    leagues.push({
      id: uuid,
      slug: leagueUuidToSlug[uuid],
      legacyId,
      name: String(doc.name ?? legacyId),
      sport: normalizeSport(doc.sport),
      gender: normalizeGender(doc.gender),
      division: normalizeDivision(doc.division ?? doc.estimatedDivision),
      description: doc.description != null ? String(doc.description) : null,
      minTeamSize: parseIntOrNull(doc.minTeamSize ?? doc.min_team_size),
      maxTeamSize: parseIntOrNull(doc.maxTeamSize ?? doc.max_team_size),
      playerAddDeadline: parseIsoTimestamp(doc.playerAddDeadline),
      playerAddDeadlineOverride: truthy(doc.playerAddDeadlineOverride),
      approved: truthy(doc.approved),
      createdAt: parseIsoTimestamp(doc.createdAt),
      updatedAt: parseIsoTimestamp(doc.updatedAt),
    });
  }
  leagues.sort((a, b) => a.name.localeCompare(b.name));

  const teamIds = await collectTeamIds(new Set(Object.keys(legacyLeagueIdToUuid)));
  const teamsMap = await batchGetTeams(teamIds);
  const [rostersMap, paymentsMap] = await Promise.all([
    batchGetRosters(teamIds),
    batchGetPayments(teamIds),
  ]);

  const teams: ExportTeam[] = [];
  const userIdSet = new Set<string>();

  for (const teamId of teamIds) {
    const doc = teamsMap.get(`team:${teamId}`) as Record<string, unknown> | null | undefined;
    if (!doc) {
      warnings.push(`Team index references missing team doc: ${teamId}`);
      continue;
    }

    const legacyLeagueId = doc.leagueId != null ? String(doc.leagueId) : null;
    const leagueUuid = legacyLeagueId ? resolveLeagueUuid(legacyLeagueId) : null;
    const managerUserId = doc.managerUserId != null ? String(doc.managerUserId) : null;
    if (managerUserId) userIdSet.add(managerUserId);
    if (doc.leadUserId) userIdSet.add(String(doc.leadUserId));

    teams.push({
      id: teamId,
      leagueId: leagueUuid,
      legacyLeagueId,
      name: String(doc.name ?? teamId),
      description: doc.description != null ? String(doc.description) : null,
      approved: truthy(doc.approved),
      sport: normalizeSport(doc.sport),
      gender: normalizeGender(doc.gender),
      estimatedDivision: normalizeDivision(doc.estimatedDivision),
      paymentRequired: truthy(doc.teamPaymentRequired ?? doc.paymentRequired),
      createdAt: parseIsoTimestamp(doc.createdAt),
      managerUserId,
    });
  }
  teams.sort((a, b) => a.name.localeCompare(b.name));

  const teamMembers: ExportTeamMember[] = [];
  const memberKeySet = new Set<string>();

  for (const team of teams) {
    const roster = rostersMap.get(team.id) ?? [];
    const payments = paymentsMap.get(team.id) ?? {};

    for (const entry of roster) {
      const userId = String(entry?.userId ?? "").trim();
      if (!userId) continue;
      userIdSet.add(userId);

      const dedupeKey = `${team.id}:${userId}`;
      if (memberKeySet.has(dedupeKey)) continue;
      memberKeySet.add(dedupeKey);

      teamMembers.push({
        id: crypto.randomUUID(),
        teamId: team.id,
        userId,
        isManager: Boolean(entry?.isManager),
        paid: Boolean(payments[userId]),
        joinedAt: parseIsoTimestamp(entry?.joinedAt),
        displayName: entry?.displayName != null ? String(entry.displayName) : null,
      });
    }
  }

  const games: ExportGame[] = [];
  const gameKeySet = new Set<string>();

  for (const legacyId of Object.keys(legacyLeagueIdToUuid)) {
    const leagueUuid = legacyLeagueIdToUuid[legacyId];
    const rawGames = await readLeagueGames(legacyId);

    for (const raw of rawGames) {
      if (!raw || typeof raw !== "object") continue;
      const g = raw as Record<string, unknown>;
      const { homeScore, awayScore, hasScores } = gameScores(g);
      const { id, legacyId: gameLegacyId } = stableGameId(g, legacyId);
      const dedupeKey = `${leagueUuid}:${id}`;
      if (gameKeySet.has(dedupeKey)) continue;
      gameKeySet.add(dedupeKey);

      games.push({
        id,
        leagueId: leagueUuid,
        legacyLeagueId: legacyId,
        homeTeamId: g.homeTeamId != null ? String(g.homeTeamId) : null,
        awayTeamId: g.awayTeamId != null ? String(g.awayTeamId) : null,
        homeTeamName:
          g.homeTeamName != null
            ? String(g.homeTeamName)
            : g.homeName != null
              ? String(g.homeName)
              : null,
        awayTeamName:
          g.awayTeamName != null
            ? String(g.awayTeamName)
            : g.awayName != null
              ? String(g.awayName)
              : null,
        location:
          g.location != null
            ? String(g.location)
            : g.court != null
              ? String(g.court)
              : g.venue != null
                ? String(g.venue)
                : null,
        startsAt: parseIsoTimestamp(
          g.dateTimeISO ?? g.date ?? g.startTimeISO ?? g.start
        ),
        status: normalizeGameStatus(g.status, hasScores),
        homeScore,
        awayScore,
        createdAt: parseIsoTimestamp(g.createdAt),
        legacyId: gameLegacyId,
      });
    }
  }

  const leagueAdmins: ExportLeagueAdmin[] = [];
  const adminPairSet = new Set<string>();

  const addAdmin = (
    legacyLeagueId: string,
    userIdentifier: string,
    source: ExportLeagueAdmin["source"],
    firebaseByEmail: Map<string, string>
  ) => {
    const leagueUuid = resolveLeagueUuid(legacyLeagueId);
    if (!leagueUuid) return;
    const userId = emailToUid(userIdentifier, firebaseByEmail, warnings);
    if (!userId) return;
    userIdSet.add(userId);
    const key = `${leagueUuid}:${userId}`;
    if (adminPairSet.has(key)) return;
    adminPairSet.add(key);
    leagueAdmins.push({
      leagueId: leagueUuid,
      legacyLeagueId,
      userId,
      source,
    });
  };

  let firebaseByEmail = new Map<string, string>();
  let firebaseUsers = new Map<string, import("@/lib/kvExport/listFirebaseUsers").FirebaseUserLite>();

  if (includeFirebaseUsers) {
    try {
      firebaseUsers = await listFirebaseUsersForExport();
    } catch (err) {
      throw new Error(
        `Firebase user listing failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    firebaseByEmail = new Map(
      [...firebaseUsers.values()]
        .filter((u) => u.email)
        .map((u) => [u.email!.toLowerCase(), u.uid])
    );
    for (const u of firebaseUsers.values()) userIdSet.add(u.uid);
  }

  for (const legacyId of Object.keys(legacyLeagueIdToUuid)) {
    const doc = await readLeagueDoc(legacyId);
    const adminUserId =
      doc?.adminUserId ?? doc?.ownerUserId ?? doc?.managerUserId ?? null;
    if (adminUserId) addAdmin(legacyId, String(adminUserId), "league_doc", firebaseByEmail);
  }

  const adminKeys = await scanKeys("admin:*:leagues");
  for (const key of adminKeys) {
    const parts = key.split(":");
    if (parts.length < 3) continue;
    const identifier = parts.slice(1, -1).join(":");
    const leagueIds = await readAdminLeagueIds(key);
    const source: ExportLeagueAdmin["source"] = identifier.includes("@")
      ? "legacy_email_set"
      : "admin_set";
    for (const legacyLeagueId of leagueIds) {
      addAdmin(legacyLeagueId, identifier, source, firebaseByEmail);
    }
  }

  const invites: ExportInvite[] = [];
  if (includeInviteScan) {
    const inviteKeys = [
      ...(await scanKeys("invite:code:*")),
      ...(await scanKeys("invite:token:*")),
    ];

    for (const key of inviteKeys) {
      let raw: unknown;
      try {
        raw = await kv.get(key);
      } catch {
        continue;
      }
      if (!raw || typeof raw !== "object") continue;
      const rec = raw as Record<string, unknown>;
      const teamId = String(rec.teamId ?? "").trim();
      if (!teamId) continue;

      const kind: ExportInvite["kind"] = key.startsWith("invite:code:") ? "code" : "token";
      const code =
        kind === "code"
          ? key.slice("invite:code:".length)
          : key.slice("invite:token:".length);

      if (rec.createdBy) userIdSet.add(String(rec.createdBy));

      invites.push({
        id: crypto.randomUUID(),
        code,
        kind,
        teamId,
        createdBy: rec.createdBy != null ? String(rec.createdBy) : null,
        createdAt: parseIsoTimestamp(rec.createdAt),
        expiresAt: null,
        legacyKey: key,
      });
    }
  }

  const schedulePdfs: ExportSchedulePdf[] = [];
  for (const legacyId of Object.keys(legacyLeagueIdToUuid)) {
    const leagueUuid = legacyLeagueIdToUuid[legacyId];
    const legacyKvKey = SCHEDULE_KEY(legacyId);
    let raw: unknown;
    try {
      raw = await kv.get(legacyKvKey);
    } catch {
      raw = null;
    }
    if (raw == null) continue;

    let contentLength: number | null = null;
    if (typeof raw === "string") contentLength = raw.length;
    else if (typeof raw === "object" && raw !== null) {
      const blob = (raw as Record<string, unknown>).data ?? (raw as Record<string, unknown>).base64;
      if (typeof blob === "string") contentLength = blob.length;
    }

    schedulePdfs.push({
      leagueId: leagueUuid,
      legacyLeagueId: legacyId,
      legacyKvKey,
      hasContent: true,
      contentLength,
      filename:
        typeof raw === "object" && raw !== null && (raw as Record<string, unknown>).filename
          ? String((raw as Record<string, unknown>).filename)
          : null,
    });
  }

  const users: ExportUser[] = [];
  const userSources = new Map<string, Set<string>>();

  const noteSource = (uid: string, source: string) => {
    if (!userSources.has(uid)) userSources.set(uid, new Set());
    userSources.get(uid)!.add(source);
  };

  for (const uid of userIdSet) noteSource(uid, "referenced");

  for (const u of firebaseUsers.values()) noteSource(u.uid, "firebase");

  for (const uid of userIdSet) {
    const fb = firebaseUsers.get(uid);
    const profile = await readDoc<Record<string, unknown>>(`user:${uid}`);
    const email =
      fb?.email ??
      (profile?.email != null ? String(profile.email).toLowerCase() : null) ??
      `${uid}@import.local`;

    if (email.endsWith("@import.local")) {
      warnings.push(`User ${uid} has no email; using placeholder ${email}`);
    }

    users.push({
      id: uid,
      email,
      displayName:
        (profile?.displayName != null ? String(profile.displayName) : null) ??
        fb?.displayName ??
        null,
      isSuperadmin: Boolean(fb?.isSuperadmin),
      createdAt: parseIsoTimestamp(profile?.createdAt),
      sources: Array.from(userSources.get(uid) ?? ["referenced"]),
    });
  }

  users.sort((a, b) => a.email.localeCompare(b.email));

  const snapshot: KvExportSnapshot = {
    version: 1,
    exportedAt,
    counts: {
      users: users.length,
      leagues: leagues.length,
      teams: teams.length,
      teamMembers: teamMembers.length,
      games: games.length,
      leagueAdmins: leagueAdmins.length,
      invites: invites.length,
      schedulePdfs: schedulePdfs.length,
      warnings: warnings.length,
    },
    idMaps: { legacyLeagueIdToUuid, leagueUuidToSlug },
    users,
    leagues,
    teams,
    teamMembers,
    games,
    leagueAdmins,
    invites,
    schedulePdfs,
    warnings,
  };

  return snapshot;
}
