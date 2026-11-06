// src/lib/adminActions.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  assertLeagueAdmin,
  assertSuperAdmin,
  isAuthFailure,
} from "@/lib/authGuards";
import {
  assignTeamToLeagueRef,
  getTeamById,
  toggleMemberPaid,
  toggleTeamFeePaid as toggleTeamFeePaidInDb,
  unassignTeamFromLeagueRef,
} from "@/lib/repositories/teamsRepo";

/** Superadmin, or league admin of the team's league (superadmin only when unassigned). */
async function requireTeamAdmin(teamId: string): Promise<void> {
  const team = await getTeamById(teamId);
  if (!team) throw new Error("Team not found");
  const leagueId = typeof team.leagueId === "string" && team.leagueId ? team.leagueId : null;
  const auth = leagueId ? await assertLeagueAdmin(leagueId) : await assertSuperAdmin();
  if (isAuthFailure(auth)) throw new Error("Forbidden");
}

async function requireSuperAdmin(): Promise<void> {
  if (isAuthFailure(await assertSuperAdmin())) throw new Error("Forbidden");
}

export async function toggleTeamFeePaid(teamId: string) {
  await requireTeamAdmin(teamId);
  await toggleTeamFeePaidInDb(teamId);

  await revalidatePath(`/admin/team/${teamId}`);
  const t = await getTeamById(teamId);
  const leagueId = typeof t?.leagueId === "string" ? t.leagueId : null;
  if (leagueId) {
    await revalidatePath(`/admin/leagues/${leagueId}`);
    await revalidatePath(`/leagues/${leagueId}`);
  }
  await revalidatePath(`/team/${teamId}`);
}

export async function toggleTeamFeePaidAction(teamId: string) {
  if (!teamId) return;
  await toggleTeamFeePaid(teamId);
}

export async function togglePlayerPaid(teamId: string, userId: string) {
  await requireTeamAdmin(teamId);
  await toggleMemberPaid(teamId, userId);
  await revalidatePath(`/admin/team/${teamId}`);
}

export async function togglePlayerPaidAction(formData: FormData) {
  const teamId = String(formData.get("teamId") || "");
  const userId = String(formData.get("userId") || "");
  if (!teamId || !userId) return;
  await togglePlayerPaid(teamId, userId);
}

export async function assignTeamToLeagueAction(formData: FormData) {
  const teamId = String(formData.get("teamId") || "");
  const leagueId = String(formData.get("leagueId") || "");
  if (!teamId || !leagueId) return;
  await assignTeamToLeague(teamId, leagueId);
}

export async function assignTeamToLeague(teamId: string, leagueId: string) {
  await requireSuperAdmin();
  const { prevLeagueRef } = await assignTeamToLeagueRef(teamId, leagueId);

  if (prevLeagueRef && prevLeagueRef !== leagueId) {
    await revalidatePath(`/leagues/${prevLeagueRef}`);
    await revalidatePath(`/admin/leagues/${prevLeagueRef}`);
  }

  await Promise.all([
    revalidatePath(`/admin/leagues/${leagueId}`),
    revalidatePath(`/leagues/${leagueId}`),
    revalidatePath(`/admin/team/${teamId}`),
    revalidatePath(`/team/${teamId}`),
    revalidatePath(`/admin`),
  ]);
}

export async function unassignTeamFromLeague(teamId: string) {
  await requireSuperAdmin();
  const prevLeagueRef = await unassignTeamFromLeagueRef(teamId);
  if (!prevLeagueRef) return;

  await Promise.all([
    revalidatePath(`/admin`),
    revalidatePath(`/admin/team/${teamId}`),
    revalidatePath(`/admin/leagues/${prevLeagueRef}`),
  ]);
}
