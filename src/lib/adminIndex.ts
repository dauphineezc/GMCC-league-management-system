// src/lib/adminIndex.ts
import { kv } from "@vercel/kv";

/** Tolerant reader: supports both legacy string and new SET */
export async function readAdminLeagues(uid: string): Promise<string[]> {
  const key = `admin:${uid}:leagues`;

  // Prefer SET
  try {
    const raw = (await kv.smembers(key)) as unknown;
    if (Array.isArray(raw)) {
      return raw.map(String);
    }
  } catch {
    // ignore WRONGTYPE / missing
  }

  // Legacy single string
  try {
    const legacy = (await kv.get(key)) as unknown;
    if (typeof legacy === "string" && legacy.trim()) {
      return [legacy.trim()];
    }
  } catch {
    // ignore
  }

  return [];
}

/** Idempotent migration: if legacy string exists, add it into the SET */
export async function migrateAdminLeaguesToSet(uid: string): Promise<void> {
  const key = `admin:${uid}:leagues`;
  try {
    const current = (await kv.get(key)) as unknown;
    if (typeof current === "string" && current.trim()) {
      await kv.sadd(key, current.trim());
    }
  } catch {
    // ignore
  }
}

/** Writers to maintain the reverse index */
export async function addLeagueToAdmin(uid: string, leagueId: string) {
  await kv.sadd(`admin:${uid}:leagues`, leagueId);
}

export async function removeLeagueFromAdmin(uid: string, leagueId: string) {
  await kv.srem(`admin:${uid}:leagues`, leagueId);
}