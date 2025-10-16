// Create/verify tokens/codes (hashing, TTL)

import { kv } from '@vercel/kv';
import type { Team } from '@/lib/types';

export async function ensureLead(userId: string, teamId: string) {
  const team = await kv.get<Team>(`team:${teamId}`);
  if (!team) throw Object.assign(new Error('Team not found'), { status: 404 });
  if (team.leadUserId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });
  return team;
}

export function makeCode8() {
  // Use crypto.randomUUID() instead of crypto.randomBytes for browser compatibility
  return crypto.randomUUID().replace(/-/g, '').substring(0, 8);
}

export async function createLinkInvite(
  teamId: string, 
  options?: { 
    ttlHours?: number; 
    email?: string; 
    phone?: string;
    createdBy?: string;
  }
) {
  const ttlHours = options?.ttlHours ?? 24; // Default 24 hours
  const token = crypto.randomUUID().replace(/-/g, '');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  
  const inviteData = { 
    teamId, 
    uses: 0,
    email: options?.email,
    phone: options?.phone,
    createdBy: options?.createdBy,
    createdAt: new Date().toISOString(),
  };
  
  await kv.set(`invite:token:${hashB64}`, inviteData, { ex: ttlHours * 60 * 60 });
  return { token, expiresIn: ttlHours };
}

export async function consumeLinkInvite(token: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  const invite = await kv.get<{ 
    teamId: string; 
    uses: number;
    email?: string;
    phone?: string;
  }>(`invite:token:${hashB64}`);
  if (!invite) throw Object.assign(new Error('Invalid/expired invite'), { status: 400 });
  // one-time use for now
  await kv.del(`invite:token:${hashB64}`);
  return invite.teamId;
}

export async function createCodeInvite(
  teamId: string,
  options?: { 
    ttlHours?: number; 
    email?: string; 
    phone?: string;
    createdBy?: string;
  }
) {
  const ttlHours = options?.ttlHours ?? 24; // Default 24 hours
  const code = makeCode8().toLowerCase(); // Normalize to lowercase
  
  const inviteData = {
    teamId,
    email: options?.email,
    phone: options?.phone,
    createdBy: options?.createdBy,
    createdAt: new Date().toISOString(),
  };
  
  await kv.set(`invite:code:${code}`, inviteData, { ex: ttlHours * 60 * 60 });
  return { code: code.toUpperCase(), expiresIn: ttlHours }; // Return uppercase for display
}

export async function consumeCodeInvite(code: string) {
  const normalizedCode = code.toLowerCase(); // Normalize to lowercase for lookup
  const rec = await kv.get<{ 
    teamId: string;
    email?: string;
    phone?: string;
  }>(`invite:code:${normalizedCode}`);
  if (!rec) throw Object.assign(new Error('Invalid/expired code'), { status: 400 });
  await kv.del(`invite:code:${normalizedCode}`);
  return rec.teamId;
}
