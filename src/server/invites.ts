// Create/verify tokens/codes (hashing, TTL)

import { kv, sha256b64 } from '@/lib/kv';
import type { Team } from '@/lib/types';
import { randomBytes } from 'crypto';

export async function ensureLead(userId: string, teamId: string) {
  const team = await kv.get<Team>(`team:${teamId}`);
  if (!team) throw Object.assign(new Error('Team not found'), { status: 404 });
  if (team.leadUserId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return team;
}

export function makeCode8() {
  return randomBytes(4).toString('hex');
}

export async function createLinkInvite(teamId: string) {
  const token = randomBytes(32).toString('base64url');
  const hash = sha256b64(token);
  await kv.set(`invite:token:${hash}`, { teamId, uses: 0 }, { ex: 60 * 60 * 24 * 14 }); // 14d TTL
  return { token };
}

export async function consumeLinkInvite(token: string) {
  const hash = sha256b64(token || '');
  const invite = await kv.get<{ teamId: string; uses: number }>(`invite:token:${hash}`);
  if (!invite) throw Object.assign(new Error('Invalid/expired invite'), { status: 400 });
  // one-time use for now
  await kv.del(`invite:token:${hash}`);
  return invite.teamId;
}

export async function createCodeInvite(teamId: string) {
  const code = makeCode8();
  await kv.set(`code:${code}`, { teamId }, { ex: 60 * 60 * 24 * 14 });
  return { code };
}

export async function consumeCodeInvite(code: string) {
  const rec = await kv.get<{ teamId: string }>(`code:${code}`);
  if (!rec) throw Object.assign(new Error('Invalid/expired code'), { status: 400 });
  await kv.del(`code:${code}`);
  return rec.teamId;
}
