import "server-only";
import { kv } from "@vercel/kv";
import { getAuth } from "firebase-admin/auth";

type UserDoc = { displayName?: string; email?: string };

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6h

async function readUserDoc(uid: string): Promise<UserDoc | null> {
  const key = `user:${uid}`;

  // HASH first
  try {
    const h = (await kv.hgetall(key)) as Record<string, unknown> | null;
    if (h && Object.keys(h).length) return h as UserDoc;
  } catch {}

  // GET object / JSON string
  try {
    const g = await kv.get(key);
    if (!g) return null;
    if (typeof g === "object") return g as UserDoc;
    if (typeof g === "string") {
      const s = g.trim();
      if (!s) return null;
      try { return JSON.parse(s) as UserDoc; } catch {}
    }
  } catch {}

  return null;
}

async function writeUserCacheMerged(uid: string, patch: Partial<UserDoc>) {
  const key = `user:${uid}`;
  const current = (await readUserDoc(uid)) ?? {};

  // IMPORTANT: never downgrade displayName to email
  const next: UserDoc = {
    ...current,
    // keep existing displayName unless patch provides a real displayName
    displayName: patch.displayName ? patch.displayName : current.displayName,
    // but we can safely update email
    email: patch.email ?? current.email,
  };

  try {
    await kv.hset(key, next);
    if ((kv as any).expire) await (kv as any).expire(key, CACHE_TTL_SECONDS);
  } catch {
    await kv.set(key, next as any, { ex: CACHE_TTL_SECONDS } as any);
  }
}

export async function getAdminDisplayName(uid: string | null): Promise<string | null> {
  if (!uid) return null;

  // 1) Prefer KV (so manual or previously cached names win)
  const fromKvDoc = await readUserDoc(uid);
  const fromKvName = fromKvDoc?.displayName?.trim();
  if (fromKvName) return fromKvName;

  // 2) Firebase as a fill-in (non-fatal)
  try {
    const u = await getAuth().getUser(uid);
    const fbDisplay = u.displayName?.trim() || null;
    const fbEmail = u.email?.trim() || null;

    // cache without downgrading displayName
    await writeUserCacheMerged(uid, {
      displayName: fbDisplay || undefined, // only write if real displayName
      email: fbEmail || undefined,
    });

    // Return displayName if it exists; else fall back to:
    return fbDisplay || fromKvDoc?.email?.trim() || fbEmail || null;
  } catch {
    // No Firebase user — use KV email if present
    return fromKvDoc?.email?.trim() || null;
  }
}