import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebaseAdmin";
import { isUserLeagueAdmin } from "@/lib/repositories/leaguesRepo";

export type ServerUser = {
  id: string;
  email: string | null;
  superadmin: boolean;
  leagueAdminOf?: string[]; // <- optional
};

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

  return isUserLeagueAdmin(
    {
      id: uid,
      email: user.email ?? null,
      superadmin: user.superadmin,
      leagueAdminOf: user.leagueAdminOf ?? undefined,
    },
    leagueId
  );
}


export async function getServerUser(): Promise<ServerUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("fb:session")?.value;
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

export async function isSuperAdmin(user: ServerUser | null) {
  return !!user?.superadmin;
}