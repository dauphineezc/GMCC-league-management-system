// src/lib/adminActions.ts
"use server";

import { revalidatePath } from "next/cache";
import {
  assignTeamToLeagueRef,
  getTeamById,
  toggleMemberPaid,
  toggleTeamFeePaid as toggleTeamFeePaidInDb,
  unassignTeamFromLeagueRef,
} from "@/lib/repositories/teamsRepo";

export async function toggleTeamFeePaid(teamId: string) {
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
  const prevLeagueRef = await unassignTeamFromLeagueRef(teamId);
  if (!prevLeagueRef) return;

  await Promise.all([
    revalidatePath(`/admin`),
    revalidatePath(`/admin/team/${teamId}`),
    revalidatePath(`/admin/leagues/${prevLeagueRef}`),
  ]);
}
