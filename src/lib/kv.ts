import { kv as vercelKv } from "@vercel/kv";

export const kv = vercelKv; // re-export so existing imports keep working

// Small helpers used around the app
export async function getJSON<T>(key: string): Promise<T | null> {
  const v = await kv.get<T>(key);
  return (v as T) ?? null;
}

export async function setJSON<T>(key: string, value: T, opts?: { ex?: number }) {
  if (opts?.ex) {
    return kv.set(key, value, { ex: opts.ex });
  }
  return kv.set(key, value);
}

export function del(key: string) {
  return kv.del(key);
}

export async function incrWithTTL(key: string, ttlSeconds: number) {
  const n = await kv.incr(key);
  if (n === 1) await kv.expire(key, ttlSeconds);
  return n;
}

// Helper function to get current timestamp
export function now(): string {
  return new Date().toISOString();
}

// Membership functions
export async function getMembership(userId: string) {
  return await kv.get<{ teamId: string; role: string }>(`user:${userId}:membership`);
}

export async function setMembership(userId: string, membership: { teamId: string; role: string }) {
  return await kv.set(`user:${userId}:membership`, membership);
}

// Team member functions
export async function getTeamMembers(teamId: string) {
  return (await kv.get<any[]>(`team:${teamId}:members`)) ?? [];
}

export async function setTeamMembers(teamId: string, members: any[]) {
  return await kv.set(`team:${teamId}:members`, members);
}

// Utility function for hashing tokens
export async function sha256b64(input: string): Promise<string> {
  // Using Web Crypto API available in Edge Runtime
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(hash);
  return btoa(String.fromCharCode(...bytes));
}