import { db } from "@/db/index";
import { invites } from "@/db/schema";
import { and, eq, gte, isNull } from "drizzle-orm";

function makeCode8(): string {
  return crypto.randomUUID().replace(/-/g, "").substring(0, 8).toLowerCase();
}

async function hashToken(token: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

export async function countRecentInvitesByUser(
  userId: string,
  windowMinutes = 1
): Promise<number> {
  const since = new Date(Date.now() - windowMinutes * 60_000);
  const rows = await db
    .select({ id: invites.id })
    .from(invites)
    .where(and(eq(invites.createdBy, userId), gte(invites.expiresAt, since)));
  return rows.length;
}

export async function createLinkInvite(
  teamId: string,
  options?: { ttlHours?: number; createdBy?: string }
): Promise<{ token: string; expiresIn: number }> {
  const ttlHours = options?.ttlHours ?? 24;
  const token = crypto.randomUUID().replace(/-/g, "");
  const code = `tok:${await hashToken(token)}`;
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await db.insert(invites).values({
    code,
    teamId,
    createdBy: options?.createdBy ?? null,
    expiresAt,
  });

  return { token, expiresIn: ttlHours };
}

export async function createCodeInvite(
  teamId: string,
  options?: { ttlHours?: number; createdBy?: string }
): Promise<{ code: string; expiresIn: number }> {
  const ttlHours = options?.ttlHours ?? 24;
  const code = makeCode8();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  await db.insert(invites).values({
    code,
    teamId,
    createdBy: options?.createdBy ?? null,
    expiresAt,
  });

  return { code: code.toUpperCase(), expiresIn: ttlHours };
}

async function consumeInvite(code: string, usedBy?: string): Promise<string> {
  const now = new Date();
  const rows = await db
    .select()
    .from(invites)
    .where(and(eq(invites.code, code), isNull(invites.usedAt)))
    .limit(1);

  const invite = rows[0];
  if (!invite) {
    throw Object.assign(new Error("Invalid/expired invite"), { status: 400 });
  }
  if (invite.expiresAt && invite.expiresAt < now) {
    throw Object.assign(new Error("Invalid/expired invite"), { status: 400 });
  }

  await db
    .update(invites)
    .set({ usedAt: now, usedBy: usedBy ?? null })
    .where(eq(invites.id, invite.id));

  return invite.teamId;
}

export async function consumeLinkInvite(token: string, usedBy?: string): Promise<string> {
  const code = `tok:${await hashToken(token)}`;
  return consumeInvite(code, usedBy);
}

export async function consumeCodeInvite(rawCode: string, usedBy?: string): Promise<string> {
  return consumeInvite(rawCode.toLowerCase(), usedBy);
}
