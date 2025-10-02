// src/lib/adminActions.ts
"use server";

import { kv } from "@vercel/kv";
import { revalidatePath } from "next/cache";
import type { Team, League } from "@/types/domain";

/* ---------- small helpers ---------- */
const uniq = <T,>(arr: T[]) => Array.from(new Set(arr));
const remove = <T,>(arr: T[], x: T) => arr.filter((v) => v !== x);

/* =========================================================
   TEAM FEE: toggle paid/unpaid on the team-level fee
   ========================================================= */
export async function toggleTeamFeePaid(teamId: string) {
  const t = await kv.get<Team>(`team:${teamId}`);
  if (!t) return;

  const now = new Date().toISOString();
  const nextPaid = !(t.teamFee?.paid ?? false);

  const teamFee = {
    required: t.teamFee?.required ?? false,
    amountCents: t.teamFee?.amountCents,
    paid: nextPaid,
    paidAt: nextPaid ? now : undefined,
    payerNote: t.teamFee?.payerNote,
  };

  await kv.set(`team:${teamId}`, { ...t, teamFee, updatedAt: now });

  // Revalidate admin + public surfaces that show team/league
  await revalidatePath(`/admin/team/${teamId}`);
  if (t.leagueId) {
    await revalidatePath(`/admin/leagues/${t.leagueId}`);
    await revalidatePath(`/leagues/${t.leagueId}`);
  }
  await revalidatePath(`/team/${teamId}`);
}

/* Optional form-friendly wrapper */
export async function toggleTeamFeePaidAction(formData: FormData) {
  const teamId = String(formData.get("teamId") || "");
  if (!teamId) return;
  await toggleTeamFeePaid(teamId);
}

/* =========================================================
   PLAYER FEE: toggle per-player paid/unpaid (handy utility)
   ========================================================= */
export async function togglePlayerPaid(teamId: string, userId: string) {
  const key = `team:${teamId}:payments`;
  const map = (await kv.get<Record<string, boolean>>(key)) ?? {};
  map[userId] = !Boolean(map[userId]);
  await kv.set(key, map);
  await revalidatePath(`/admin/team/${teamId}`);
}

export async function togglePlayerPaidAction(formData: FormData) {
  const teamId = String(formData.get("teamId") || "");
  const userId = String(formData.get("userId") || "");
  if (!teamId || !userId) return;
  await togglePlayerPaid(teamId, userId);
}

/* =========================================================
   ASSIGN TEAM → LEAGUE (handles reassign & indices)
   ========================================================= */
export async function assignTeamToLeagueAction(formData: FormData) {
  const teamId = String(formData.get("teamId") || "");
  const leagueId = String(formData.get("leagueId") || "");
  if (!teamId || !leagueId) return;
  await assignTeamToLeague(teamId, leagueId);
}

/** Programmatic variant (server → server) */
export async function assignTeamToLeague(teamId: string, leagueId: string) {
  const t = await kv.get<Team>(`team:${teamId}`);
  if (!t) throw new Error(`Team ${teamId} not found`);
  const league = await kv.get<League>(`league:${leagueId}`);
  if (!league) throw new Error(`League ${leagueId} not found`);

  const now = new Date().toISOString();

  // Update team assignment
  const prevLeagueId = t.leagueId;
  await kv.set<Team>(`team:${teamId}`, { ...t, leagueId, updatedAt: now });

  // Add to new league.teamIds
  const newTeamIds = uniq([...(league.teamIds ?? []), teamId]);
  await kv.set<League>(`league:${leagueId}`, { ...league, teamIds: newTeamIds, updatedAt: now });

  // Remove from old league.teamIds (if moving)
  if (prevLeagueId && prevLeagueId !== leagueId) {
    const prev = await kv.get<League>(`league:${prevLeagueId}`);
    if (prev) {
      const pruned = remove(prev.teamIds ?? [], teamId);
      await kv.set<League>(`league:${prevLeagueId}`, { ...prev, teamIds: pruned, updatedAt: now });
      await revalidatePath(`/leagues/${prevLeagueId}`);
      await revalidatePath(`/admin/leagues/${prevLeagueId}`);
    }
  }

  // Clean up "unassigned" indexes
  const unassignedKey = `index:teams:unassigned`;
  const unassignedSportKey = `index:teams:unassigned:sport:${t.sport}`;
  const [allUnassigned, sportUnassigned] = await Promise.all([
    kv.get<string[]>(unassignedKey).then((a) => a ?? []),
    kv.get<string[]>(unassignedSportKey).then((a) => a ?? []),
  ]);
  await Promise.all([
    kv.set(unassignedKey, remove(allUnassigned, teamId)),
    kv.set(unassignedSportKey, remove(sportUnassigned, teamId)),
  ]);

  // Revalidate screens (admin + public)
  await Promise.all([
    revalidatePath(`/admin/leagues/${leagueId}`),
    revalidatePath(`/leagues/${leagueId}`),
    revalidatePath(`/admin/team/${teamId}`),
    revalidatePath(`/team/${teamId}`),
    revalidatePath(`/admin`),
  ]);
}

/* (Optional) Unassign helper — if you ever need to move a team back to pool */
export async function unassignTeamFromLeague(teamId: string) {
  const t = await kv.get<Team>(`team:${teamId}`);
  if (!t || !t.leagueId) return;
  const league = await kv.get<League>(`league:${t.leagueId}`);
  const now = new Date().toISOString();

  await kv.set<Team>(`team:${teamId}`, { ...t, leagueId: null, updatedAt: now });

  if (league) {
    const pruned = remove(league.teamIds ?? [], teamId);
    await kv.set<League>(`league:${t.leagueId}`, { ...league, teamIds: pruned, updatedAt: now });
  }

  // Add back to unassigned indices
  const unassignedKey = `index:teams:unassigned`;
  const unassignedSportKey = `index:teams:unassigned:sport:${t.sport}`;
  const [allUnassigned, sportUnassigned] = await Promise.all([
    kv.get<string[]>(unassignedKey).then((a) => a ?? []),
    kv.get<string[]>(unassignedSportKey).then((a) => a ?? []),
  ]);
  await Promise.all([
    kv.set(unassignedKey, uniq([...allUnassigned, teamId])),
    kv.set(unassignedSportKey, uniq([...sportUnassigned, teamId])),
  ]);

  await Promise.all([
    revalidatePath(`/admin`),
    revalidatePath(`/admin/team/${teamId}`),
    revalidatePath(`/admin/leagues/${t.leagueId}`),
  ]);
}