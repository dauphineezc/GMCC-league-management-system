import { adminAuth } from "@/lib/firebaseAdmin";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";

function isUserNotFound(err: unknown): boolean {
  return (err as { code?: string })?.code === "auth/user-not-found";
}

/**
 * Session cookies embed custom claims at sign-in, so a role change only takes
 * effect once existing sessions are revoked (verifySessionCookie checks revocation).
 */
export async function setClaimsAndRevokeSessions(
  uid: string,
  claims: Record<string, unknown>
): Promise<void> {
  await adminAuth.setCustomUserClaims(uid, claims);
  await adminAuth.revokeRefreshTokens(uid);
}

/**
 * Strip a league from the user's leagueAdminOf claim and end their sessions.
 * The claim must go too: /api/auth/bootstrap re-seeds league_admins from it.
 */
export async function revokeLeagueAdminAccess(
  uid: string,
  leagueRef: string,
  opts?: { keepSessions?: boolean }
): Promise<void> {
  const league = await resolveLeagueByRef(leagueRef);
  const refs = new Set([leagueRef, league?.slug, league?.id].filter(Boolean) as string[]);

  let user;
  try {
    user = await adminAuth.getUser(uid);
  } catch (err) {
    if (isUserNotFound(err)) return;
    throw err;
  }

  const claims = { ...(user.customClaims ?? {}) } as Record<string, unknown>;
  if (Array.isArray(claims.leagueAdminOf)) {
    const kept = (claims.leagueAdminOf as string[]).filter((r) => !refs.has(r));
    if (kept.length !== claims.leagueAdminOf.length) {
      claims.leagueAdminOf = kept;
      await adminAuth.setCustomUserClaims(uid, claims);
    }
  }

  if (!opts?.keepSessions) {
    await adminAuth.revokeRefreshTokens(uid);
  }
}
