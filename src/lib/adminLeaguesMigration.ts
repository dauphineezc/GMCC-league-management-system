import { kv } from "@vercel/kv";
import { adminAuth } from "@/lib/firebaseAdmin";
import { smembersSafe, readLeagueDoc } from "@/lib/kvHelpers";
import { writeLeagueAdminJSON } from "@/lib/leagueDoc";

/** Read league IDs from any legacy storage shape (SET, JSON array, CSV, single string). */
export async function readAdminLeagueIds(key: string): Promise<string[]> {
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
      if (s.includes(",")) {
        return s.split(",").map((t) => t.trim()).filter(Boolean);
      }
      return [s];
    }
  }

  return [];
}

/** Persist admin leagues as a Redis SET (canonical format). */
export async function writeAdminLeaguesAsSet(
  key: string,
  leagueIds: string[],
  dry = false
): Promise<void> {
  const ids = Array.from(new Set(leagueIds.map(String).filter(Boolean)));
  if (dry) return;
  await kv.del(key);
  if (ids.length) await kv.sadd(key, ...ids);
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
 * Copy admin:{email}:leagues → admin:{uid}:leagues (SET) and optionally delete the email key.
 * Idempotent — safe to run multiple times.
 */
export async function migrateEmailAdminKeyToUid(
  email: string,
  uid: string,
  opts: { dry?: boolean; deleteLegacy?: boolean } = {}
): Promise<EmailAdminMigrationRow> {
  const dry = opts.dry ?? false;
  const deleteLegacy = opts.deleteLegacy ?? !dry;
  const emailKey = `admin:${email}:leagues`;
  const uidKey = `admin:${uid}:leagues`;

  const emailLeagues = await readAdminLeagueIds(emailKey);
  const uidLeaguesBefore = await readAdminLeagueIds(uidKey);
  const merged = Array.from(new Set([...uidLeaguesBefore, ...emailLeagues])).filter(Boolean);

  const uidWasSet = (await smembersSafe(uidKey)).length > 0;
  const uidKeyNormalized = merged.length > 0 && (!uidWasSet || emailLeagues.length > 0);

  if (!dry && uidKeyNormalized) {
    await writeAdminLeaguesAsSet(uidKey, merged);
  }

  let emailKeyDeleted = false;
  if (!dry && deleteLegacy && emailLeagues.length > 0) {
    await kv.del(emailKey);
    emailKeyDeleted = true;
  }

  return {
    email,
    uid,
    emailLeagues,
    uidLeaguesBefore,
    merged,
    emailKeyDeleted,
    uidKeyNormalized,
  };
}

/** Normalize admin:{uid}:leagues from legacy string/array/JSON into a SET. */
export async function normalizeAdminLeaguesToSet(
  uid: string,
  opts: { dry?: boolean } = {}
): Promise<string[]> {
  const key = `admin:${uid}:leagues`;
  const ids = await readAdminLeagueIds(key);
  const alreadySet = (await smembersSafe(key)).length > 0;
  if (!opts.dry && ids.length > 0 && !alreadySet) {
    await writeAdminLeaguesAsSet(key, ids);
  }
  return ids;
}

/** Fix league docs whose adminUserId is still an email address. */
export async function migrateLeagueDocAdminEmails(
  opts: { dry?: boolean } = {}
): Promise<LeagueDocAdminMigrationRow[]> {
  const dry = opts.dry ?? false;
  const rows: LeagueDocAdminMigrationRow[] = [];
  const leagueIds = await smembersSafe("leagues:index");

  for (const leagueId of leagueIds) {
    const doc = await readLeagueDoc(leagueId);
    const adminId = doc?.adminUserId;
    if (!adminId || !String(adminId).includes("@")) continue;

    const email = String(adminId).trim().toLowerCase();
    try {
      const fbUser = await adminAuth.getUserByEmail(email);
      rows.push({ leagueId, from: email, to: fbUser.uid });
      if (!dry) {
        await writeLeagueAdminJSON(leagueId, fbUser.uid);
        await migrateEmailAdminKeyToUid(email, fbUser.uid, { dry: false, deleteLegacy: true });
      }
    } catch {
      // User not in Firebase — leave doc unchanged
    }
  }

  return rows;
}

/**
 * One-time migration: email-based admin keys → uid-based SETs for all Firebase users,
 * plus normalize any remaining legacy uid key formats.
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
      if (!u.email) continue;
      try {
        const row = await migrateEmailAdminKeyToUid(u.email, u.uid, {
          dry,
          deleteLegacy: !dry,
        });
        if (row.emailLeagues.length > 0 || row.uidKeyNormalized) {
          emailMigrations.push(row);
        } else {
          const normalized = await normalizeAdminLeaguesToSet(u.uid, { dry });
          if (normalized.length > 0 && !dry) {
            emailMigrations.push({
              ...row,
              uidKeyNormalized: true,
              merged: normalized,
            });
          }
        }
      } catch (e) {
        emailMigrations.push({
          email: u.email,
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
