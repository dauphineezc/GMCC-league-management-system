import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import type { LMSUser } from "./authTypes";
import { kv } from "@vercel/kv";

export type ServerUser = {
  id: string;
  email: string | null;
  superadmin: boolean;
  leagueAdminOf?: string[]; // <- optional
};

const COOKIE = "fb:session"; // <-- keep consistent with your /api/auth/session

type MinimalUser = {
  id?: string;
  uid?: string;
  email?: string | null;
  superadmin?: boolean;
  leagueAdminOf?: string[] | null;
};

export async function isLeagueAdminAsync(user: MinimalUser | null, leagueId: string) {
  if (!user) return false;

  // normalize uid/id
  const uid = String(user.id ?? user.uid ?? "");
  if (!uid) return false;

  // superadmin wins
  if (user.superadmin) return true;

  // check kv sets (uid and legacy email), then claims as fallback
  const [byUid, byEmail] = await Promise.all([
    kv.sismember(`admin:${uid}:leagues`, leagueId).catch(() => 0),
    user.email
      ? kv.sismember(`admin:${user.email}:leagues`, leagueId).catch(() => 0)
      : Promise.resolve(0),
  ]);

  return (
    Boolean(byUid) ||
    Boolean(byEmail) ||
    (Array.isArray(user.leagueAdminOf) && user.leagueAdminOf.includes(leagueId))
  );
}


export async function getServerUser(): Promise<ServerUser | null> {
  const sessionCookie = cookies().get("fb:session")?.value;
  if (!sessionCookie) return null;
  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const claims = (decoded as any) ?? {};
    return {
      id: decoded.uid,
      email: decoded.email ?? null,
      superadmin:
        claims.superadmin === true ||
        claims.customClaims?.superadmin === true ||
        false,
      leagueAdminOf:
        Array.isArray(claims.leagueAdminOf) ? claims.leagueAdminOf as string[] : undefined,
    };
  } catch {
    return null;
  }
}

/* optional helpers, unchanged */
export function isLeagueAdmin(user: ServerUser | null, leagueId: string) {
  return !!user?.superadmin; // or your own logic
}
export function isTeamManager(user: ServerUser | null, teamId: string) {
  return !!user?.superadmin; // or your own logic
}