// /src/lib/adminDisplayName.ts
import "server-only";
import { kv } from "@vercel/kv";
import { getAdminAuth } from "./firebaseAdmin";

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6h

export async function getDisplayNameForUid(uid?: string | null): Promise<string | null> {
  if (!uid) return null;
  const cacheKey = `user:${uid}`;

  // Try KV cache (hash or JSON)
  try {
    const h = (await kv.hgetall(cacheKey)) as Record<string, any> | null;
    const cached = h?.displayName ?? null;
    if (cached) return String(cached);
  } catch {
    // ignore
  }

  // Fallback: whole JSON object
  try {
    const raw = (await kv.get(cacheKey)) as any;
    const cached = raw?.displayName ?? null;
    if (cached) return String(cached);
  } catch {
    // ignore
  }

  // Ask Firebase Admin
  try {
    const auth = getAdminAuth();
    const user = await auth.getUser(uid);
    const name = user.displayName || user.email || null;

    if (name) {
      // Cache as hash; if that fails, store JSON
      try {
        await kv.hset(cacheKey, { displayName: name, email: user.email ?? "" });
        // optional TTL if your KV supports it
        // @ts-ignore
        if (kv.expire) await (kv as any).expire(cacheKey, CACHE_TTL_SECONDS);
      } catch {
        await kv.set(cacheKey, { displayName: name, email: user.email ?? "" }, { ex: CACHE_TTL_SECONDS } as any);
      }
    }
    return name;
  } catch {
    return null;
  }
}