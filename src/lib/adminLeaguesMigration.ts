import { adminAuth } from "@/lib/firebaseAdmin";
import {
  listEmailBasedLeagueAdminRows,
  listLeagueRefsForAdminUser,
  listLeagueSlugs,
  readLeagueDocByRef,
  removeAllLeagueAdminsForUser,
  setLeaguePrimaryAdmin,
  syncLeagueAdminsFromRefs,
} from "@/lib/repositories/leaguesRepo";

function parseAdminLeaguesKey(key: string): string | null {
  const match = key.match(/^admin:(.+):leagues$/);
  return match ? match[1] : null;
}

async function resolveAdminUserId(identifier: string): Promise<string | null> {
  if (!identifier.includes("@")) return identifier;
  try {
    return (await adminAuth.getUserByEmail(identifier.trim().toLowerCase())).uid;
  } catch {
    return null;
  }
}

/** Read league slugs managed by admin:{uid|email}:leagues from Postgres. */
export async function readAdminLeagueIds(key: string): Promise<string[]> {
  const identifier = parseAdminLeaguesKey(key);
  if (!identifier) return [];
  const uid = await resolveAdminUserId(identifier);
  if (!uid) return [];
  return listLeagueRefsForAdminUser(uid);
}

/** Persist admin leagues in Postgres league_admins (replaces legacy KV SET). */
export async function writeAdminLeaguesAsSet(
  key: string,
  leagueIds: string[],
  dry = false
): Promise<void> {
  const identifier = parseAdminLeaguesKey(key);
  if (!identifier) return;
  const uid = await resolveAdminUserId(identifier);
  if (!uid) return;
  await syncLeagueAdminsFromRefs(uid, leagueIds, dry);
}

export type EmailAdminMigrationRow = {
  email: string;
  uid: string;
  emailLeagues: string[];
  uidLeaguesBefore: string[];
  merged: string[];
  emailKeyDeleted: boolean;
  uidKeyNormalized: boolean;
  error?: string;
};

export type LeagueDocAdminMigrationRow = {
  leagueId: string;
  from: string;
  to: string;
};

export type AdminLeaguesMigrationReport = {
  dry: boolean;
  emailMigrations: EmailAdminMigrationRow[];
  leagueDocMigrations: LeagueDocAdminMigrationRow[];
  summary: {
    usersScanned: number;
    usersWithEmailKeys: number;
    uidKeysNormalized: number;
    emailKeysDeleted: number;
    leagueDocsFixed: number;
  };
};

/**
 * Merge admin leagues for an email-identified user into the canonical uid rows.
 * Idempotent — safe to run multiple times.
 */
export async function migrateEmailAdminKeyToUid(
  email: string,
  uid: string,
  opts: { dry?: boolean; deleteLegacy?: boolean } = {}
): Promise<EmailAdminMigrationRow> {
  void opts.deleteLegacy;
  const dry = opts.dry ?? false;

  let emailUid: string | null = null;
  try {
    emailUid = (await adminAuth.getUserByEmail(email.trim().toLowerCase())).uid;
  } catch {
    emailUid = null;
  }

  const uidLeaguesBefore = await listLeagueRefsForAdminUser(uid);
  let emailLeagues: string[] = [];

  if (emailUid && emailUid !== uid) {
    emailLeagues = await listLeagueRefsForAdminUser(emailUid);
    if (!dry && emailLeagues.length) {
      await syncLeagueAdminsFromRefs(uid, emailLeagues);
      await removeAllLeagueAdminsForUser(emailUid);
    }
  }

  const merged = dry
    ? Array.from(new Set([...uidLeaguesBefore, ...emailLeagues]))
    : await syncLeagueAdminsFromRefs(uid, [...uidLeaguesBefore, ...emailLeagues]);
  const uidKeyNormalized = merged.length > uidLeaguesBefore.length;

  return {
    email,
    uid,
    emailLeagues,
    uidLeaguesBefore,
    merged,
    emailKeyDeleted: false,
    uidKeyNormalized,
  };
}

/** @deprecated Postgres league_admins is already normalized — returns current slugs. */
export async function normalizeAdminLeaguesToSet(
  uid: string,
  _opts: { dry?: boolean } = {}
): Promise<string[]> {
  return listLeagueRefsForAdminUser(uid);
}

/** Fix league admins stored with an email address instead of a Firebase uid. */
export async function migrateLeagueDocAdminEmails(
  opts: { dry?: boolean } = {}
): Promise<LeagueDocAdminMigrationRow[]> {
  const dry = opts.dry ?? false;
  const rows: LeagueDocAdminMigrationRow[] = [];
  const fixed = new Set<string>();

  const emailAdminRows = await listEmailBasedLeagueAdminRows();

  for (const row of emailAdminRows) {
    const email = row.userId.trim().toLowerCase();
    const key = `${row.slug}:${email}`;
    if (fixed.has(key)) continue;
    try {
      const fbUser = await adminAuth.getUserByEmail(email);
      rows.push({ leagueId: row.slug, from: email, to: fbUser.uid });
      fixed.add(key);
      if (!dry) {
        await setLeaguePrimaryAdmin(row.slug, fbUser.uid);
      }
    } catch {
      // User not in Firebase — leave row unchanged
    }
  }

  const slugs = await listLeagueSlugs({ onlyApproved: false });
  for (const slug of slugs) {
    const doc = await readLeagueDocByRef(slug);
    const adminId = doc?.adminUserId;
    if (!adminId || !String(adminId).includes("@")) continue;

    const email = String(adminId).trim().toLowerCase();
    const key = `${slug}:${email}`;
    if (fixed.has(key)) continue;
    try {
      const fbUser = await adminAuth.getUserByEmail(email);
      rows.push({ leagueId: slug, from: email, to: fbUser.uid });
      fixed.add(key);
      if (!dry) {
        await setLeaguePrimaryAdmin(slug, fbUser.uid);
      }
    } catch {
      // User not in Firebase — leave doc unchanged
    }
  }

  return rows;
}

/**
 * Sync Firebase custom claims and email-based admin ids into Postgres league_admins.
 */
export async function migrateAllAdminLeaguesFromEmail(
  opts: { dry?: boolean } = {}
): Promise<AdminLeaguesMigrationReport> {
  const dry = opts.dry ?? false;
  const emailMigrations: EmailAdminMigrationRow[] = [];
  let usersScanned = 0;

  let token: string | undefined;
  do {
    const res = await adminAuth.listUsers(1000, token);
    for (const u of res.users) {
      usersScanned++;
      const claims = (u.customClaims ?? {}) as { leagueAdminOf?: string[] };
      const claimLeagues = Array.isArray(claims.leagueAdminOf) ? claims.leagueAdminOf : [];

      try {
        if (u.email) {
          const row = await migrateEmailAdminKeyToUid(u.email, u.uid, { dry });
          if (row.emailLeagues.length > 0 || row.uidKeyNormalized) {
            emailMigrations.push(row);
          }
        }

        if (claimLeagues.length) {
          const before = await listLeagueRefsForAdminUser(u.uid);
          const merged = await syncLeagueAdminsFromRefs(u.uid, claimLeagues, dry);
          if (merged.length > before.length) {
            emailMigrations.push({
              email: u.email ?? "",
              uid: u.uid,
              emailLeagues: [],
              uidLeaguesBefore: before,
              merged,
              emailKeyDeleted: false,
              uidKeyNormalized: true,
            });
          }
        }
      } catch (e) {
        emailMigrations.push({
          email: u.email ?? "",
          uid: u.uid,
          emailLeagues: [],
          uidLeaguesBefore: [],
          merged: [],
          emailKeyDeleted: false,
          uidKeyNormalized: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    token = res.pageToken;
  } while (token);

  const leagueDocMigrations = await migrateLeagueDocAdminEmails({ dry });

  return {
    dry,
    emailMigrations,
    leagueDocMigrations,
    summary: {
      usersScanned,
      usersWithEmailKeys: emailMigrations.filter((r) => r.emailLeagues.length > 0).length,
      uidKeysNormalized: emailMigrations.filter((r) => r.uidKeyNormalized).length,
      emailKeysDeleted: emailMigrations.filter((r) => r.emailKeyDeleted).length,
      leagueDocsFixed: leagueDocMigrations.length,
    },
  };
}
