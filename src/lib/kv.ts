// Thin helpers (get/set + common queries + hashing)

import { kv } from '@vercel/kv';
import crypto from 'crypto';
import type { Game, MemberPublic } from '@/lib/types';

export { kv }; // re-export

export const now = () => new Date().toISOString();
export const sha256b64 = (s: string) => crypto.createHash('sha256').update(s).digest('base64url');

export async function getMembership(userId: string) {
  return kv.get<{ teamId: string; role: 'LEAD'|'PLAYER' }|null>(`user:${userId}:membership`);
}
export async function setMembership(userId: string, data: { teamId: string; role: 'LEAD'|'PLAYER' }|null) {
  return kv.set(`user:${userId}:membership`, data);
}
export async function getTeamMembers(teamId: string) {
  return (await kv.get<MemberPublic[]>(`team:${teamId}:members`)) ?? [];
}
export async function setTeamMembers(teamId: string, members: MemberPublic[]) {
  return kv.set(`team:${teamId}:members`, members);
}
export async function getTeamSchedule(teamId: string) {
  return (await kv.get<Game[]>(`game:${teamId}`)) ?? [];
}
