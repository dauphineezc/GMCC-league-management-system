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
  
  // Parse team size values
  const minTeamSizeStr = String(formData.get("minTeamSize") || "").trim();
  const maxTeamSizeStr = String(formData.get("maxTeamSize") || "").trim();
  const minTeamSize = minTeamSizeStr ? parseInt(minTeamSizeStr, 10) : undefined;
  const maxTeamSize = maxTeamSizeStr ? parseInt(maxTeamSizeStr, 10) : undefined;

  if (!name) return { ok: false, error: "Please provide a league name." };
  if (!(SPORTS as readonly string[]).includes(sport))   return { ok: false, error: "Please choose a valid sport." };
  if (!(DIVS as readonly string[]).includes(division))  return { ok: false, error: "Please choose a valid division." };
  if (!(GENDERS as readonly string[]).includes(gender)) return { ok: false, error: "Please choose a valid gender." };

  // Validate team sizes if provided
  if (minTeamSize !== undefined && (isNaN(minTeamSize) || minTeamSize < 1)) {
    return { ok: false, error: "Minimum team size must be at least 1." };
  }
  if (maxTeamSize !== undefined && (isNaN(maxTeamSize) || maxTeamSize < 1)) {
    return { ok: false, error: "Maximum team size must be at least 1." };
  }
  if (minTeamSize !== undefined && maxTeamSize !== undefined && minTeamSize > maxTeamSize) {
    return { ok: false, error: "Minimum team size cannot be greater than maximum team size." };
  }

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
    minTeamSize,
    maxTeamSize,
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
  
    // Get league document to get league name
    const league = await readDoc<Record<string, any>>(`league:${leagueId}`);
    const leagueName = league?.name ?? leagueId;
  
    // Update team with leagueId
    await writePatch(key, { leagueId, updatedAt: new Date().toISOString() });
    try { await kv.sadd(`league:${leagueId}:teams`, teamId); } catch {}
  
    // Update all roster members' memberships with league information
    // Read roster (stored as array)
    let rosterArray: any[] = [];
    try {
      const rosterRaw = await kv.get(`team:${teamId}:roster`);
      if (Array.isArray(rosterRaw)) {
        rosterArray = rosterRaw;
      } else if (typeof rosterRaw === 'string') {
        try {
          rosterArray = JSON.parse(rosterRaw);
        } catch {}
      }
    } catch {}
  
    // Update memberships for all roster members
    for (const member of rosterArray) {
      if (!member?.userId) continue;
      
      const membershipKey = `user:${member.userId}:memberships`;
      let memberships: any[] = [];
      try {
        const raw = await kv.get(membershipKey);
        if (Array.isArray(raw)) {
          memberships = raw;
        } else if (typeof raw === 'string') {
          try {
            memberships = JSON.parse(raw);
          } catch {}
        }
      } catch {}
      
      const membershipIndex = memberships.findIndex((m: any) => m?.teamId === teamId);
      const membershipData = {
        teamId,
        leagueId,
        leagueName,
        teamName: existing.name ?? teamId,
        isManager: member.isManager ?? false,
      };
      
      if (membershipIndex >= 0) {
        memberships[membershipIndex] = { ...memberships[membershipIndex], ...membershipData };
      } else {
        memberships.push(membershipData);
      }
      
      try {
        await kv.set(membershipKey, memberships);
      } catch {}
    }
  
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