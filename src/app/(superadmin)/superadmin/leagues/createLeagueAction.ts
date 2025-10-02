"use server";

import { kv } from "@vercel/kv";
import { adminAuth } from "@/lib/firebaseAdmin"; // server-only import is OK here
import type { CreateLeagueState, UnassignedTeam, AddTeamState } from "./createLeagueTypes";
import { randomUUID } from "crypto";

/* ---------- constants (not exported) ---------- */
const SPORTS   = ["basketball", "volleyball"] as const;
const GENDERS  = ["mens", "womens", "coed"] as const;
const DIVS     = ["low_b", "high_b", "a"] as const;

/* ---------- tolerant KV helpers (not exported) ---------- */
async function smembers(key: string): Promise<string[]> {
  const v = (await kv.smembers(key)) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
}
async function readDoc<T extends Record<string, any>>(key: string): Promise<T | null> {
  try {
    const h = (await kv.hgetall(key)) as unknown;
    if (h && typeof h === "object" && Object.keys(h as object).length) return h as T;
  } catch {}
  const raw = (await kv.get(key)) as unknown;
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  if (typeof raw === "object") return raw as T;
  return null;
}
async function writePatch(key: string, patch: Record<string, any>) {
  try {
    await kv.hset(key, patch as any);
  } catch {
    const existing = (await kv.get(key)) as any;
    const merged = existing && typeof existing === "object" ? { ...existing, ...patch } : { ...patch };
    await kv.set(key, merged);
  }
}

/* ---------- utilities (not exported) ---------- */
const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const normEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();

async function resolveUidByEmail(email: string): Promise<string | null> {
  const e = normEmail(email);
  if (!e) return null;

  const idxKey = `user:email:${e}`;
  try {
    const uid = (await kv.get(idxKey)) as string | null;
    if (uid) return uid;
  } catch {}

  try {
    const user = await adminAuth.getUserByEmail(e);
    const uid = user.uid;
    try { await kv.set(idxKey, uid); } catch {}
    try { await kv.hset(`user:${uid}`, { displayName: user.displayName ?? "", email: user.email ?? e } as any); } catch {}
    return uid;
  } catch {
    return null;
  }
}

async function getUnassignedTeams(): Promise<UnassignedTeam[]> {
  const teamIds = await smembers("teams:index");
  const out: UnassignedTeam[] = [];
  for (const tid of teamIds) {
    const t = await readDoc<Record<string, any>>(`team:${tid}`);
    if (!t) continue;
    if (!t.leagueId) out.push({ teamId: tid, name: t.name ?? tid });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return out;
}

/* ====================== EXPORTED SERVER ACTIONS ====================== */

export async function createLeagueAction(
  _prevState: CreateLeagueState,
  formData: FormData
): Promise<CreateLeagueState> {
  const name        = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const sport       = String(formData.get("sport") || "").trim().toLowerCase();
  const division    = String(formData.get("division") || "").trim().toLowerCase();
  const gender      = String(formData.get("gender") || "").trim().toLowerCase();
  const adminEmail  = normEmail(formData.get("adminEmail"));

  if (!name) return { ok: false, error: "Please provide a league name." };
  if (!(SPORTS as readonly string[]).includes(sport))   return { ok: false, error: "Please choose a valid sport." };
  if (!(DIVS as readonly string[]).includes(division))  return { ok: false, error: "Please choose a valid division." };
  if (!(GENDERS as readonly string[]).includes(gender)) return { ok: false, error: "Please choose a valid gender." };

  const leagueId = randomUUID();

  let adminUserId: string | null = null;
  if (adminEmail) {
    adminUserId = await resolveUidByEmail(adminEmail);
    if (!adminUserId) return { ok: false, error: `No Firebase user found for ${adminEmail}` };
  }

  const now = new Date().toISOString();
  const docKey = `league:${leagueId}`;

  await writePatch(docKey, {
    id: leagueId,
    name,
    description,
    sport,
    division,
    gender,
    adminUserId: adminUserId ?? null,
    approved: false,
    createdAt: now,
    updatedAt: now,
  });

  try { await kv.sadd("leagues:index", leagueId); } catch {}

  const unassigned = await getUnassignedTeams();
  return { ok: true, leagueId, leagueName: name, unassigned };
}

export async function addTeamToLeagueDirect(
    leagueId: string,
    teamId: string
  ): Promise<AddTeamState> {
    "use server";
  
    if (!leagueId || !teamId) return { ok: false, error: "Missing leagueId or teamId." };
  
    const key = `team:${teamId}`;
    const existing = await readDoc<Record<string, any>>(key);
    if (!existing) return { ok: false, error: "Team not found." };
  
    await writePatch(key, { leagueId, updatedAt: new Date().toISOString() });
    try { await kv.sadd(`league:${leagueId}:teams`, teamId); } catch {}
  
    return { ok: true };
  }
  

export async function addTeamToLeagueAction(
  _prev: AddTeamState | null,
  formData: FormData
): Promise<AddTeamState> {
  const leagueId = String(formData.get("leagueId") || "");
  const teamId   = String(formData.get("teamId") || "");
  if (!leagueId || !teamId) return { ok: false, error: "Missing leagueId or teamId." };

  const key = `team:${teamId}`;
  const existing = await readDoc<Record<string, any>>(key);
  if (!existing) return { ok: false, error: "Team not found." };

  await writePatch(key, { leagueId, updatedAt: new Date().toISOString() });
  try { await kv.sadd(`league:${leagueId}:teams`, teamId); } catch {}

  return { ok: true };
}

/** One-arg wrapper for <form action={...}> in client */
export async function addTeamToLeague(formData: FormData) {
  return addTeamToLeagueAction(null, formData);
}