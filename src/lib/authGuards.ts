import {
  getServerUser,
  isLeagueAdminAsync,
  type ServerUser,
} from "@/lib/serverUser";

export type AuthFailure = { ok: false; response: Response };
export type AuthSuccess = { ok: true; user: ServerUser };
export type AuthResult = AuthSuccess | AuthFailure;
export type CronAuthSuccess = { ok: true; cron: true };
export type CronAuthResult = AuthResult | CronAuthSuccess;

function unauthorized(message = "Unauthorized"): AuthFailure {
  return { ok: false, response: Response.json({ error: message }, { status: 401 }) };
}

function forbidden(message = "Forbidden"): AuthFailure {
  return { ok: false, response: Response.json({ error: message }, { status: 403 }) };
}

export function isAuthFailure(r: AuthResult | CronAuthResult): r is AuthFailure {
  return !r.ok;
}

export function isCronAuth(r: CronAuthResult): r is CronAuthSuccess {
  return r.ok && "cron" in r;
}

/** Require a valid session. Returns the user or a 401 response. */
export async function assertAuthenticated(): Promise<AuthResult> {
  const user = await getServerUser();
  if (!user) return unauthorized();
  return { ok: true, user };
}

/** Require superadmin. */
export async function assertSuperAdmin(): Promise<AuthResult> {
  const result = await assertAuthenticated();
  if (isAuthFailure(result)) return result;
  if (!result.user.superadmin) return forbidden();
  return result;
}

/** Require league admin (or superadmin) for the given league. */
export async function assertLeagueAdmin(leagueId: string): Promise<AuthResult> {
  const result = await assertAuthenticated();
  if (isAuthFailure(result)) return result;
  return assertLeagueAdminForUser(result.user, leagueId);
}

/** League-admin check when the user is already loaded. */
export async function assertLeagueAdminForUser(
  user: ServerUser,
  leagueId: string
): Promise<AuthResult> {
  if (user.superadmin) return { ok: true, user };
  const isAdmin = await isLeagueAdminAsync(user, leagueId);
  if (!isAdmin) return forbidden();
  return { ok: true, user };
}

/** True when the request carries a valid CRON_SECRET bearer token. */
export function hasValidCronBearer(req: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  return req.headers.get("authorization") === `Bearer ${cronSecret}`;
}

/** Accept CRON_SECRET bearer token or superadmin session. */
export async function assertCronOrSuperAdmin(req: Request): Promise<CronAuthResult> {
  if (hasValidCronBearer(req)) {
    return { ok: true, cron: true };
  }
  return assertSuperAdmin();
}

/**
 * Cron-only auth for internal jobs. In production CRON_SECRET must be set
 * and the bearer token must match.
 */
export async function assertCronJob(req: Request): Promise<CronAuthResult> {
  if (hasValidCronBearer(req)) {
    return { ok: true, cron: true };
  }
  if (process.env.NODE_ENV === "production") {
    return process.env.CRON_SECRET
      ? forbidden("Invalid cron credentials")
      : forbidden("CRON_SECRET is not configured");
  }
  // Local dev: allow manual trigger without secret
  return { ok: true, cron: true };
}

/** Cron secret, superadmin session, or league admin for the given league. */
export async function assertCronOrSuperAdminOrLeagueAdmin(
  req: Request,
  leagueId: string
): Promise<CronAuthResult | AuthResult> {
  const cronOrSuper = await assertCronOrSuperAdmin(req);
  if (isCronAuth(cronOrSuper) || !isAuthFailure(cronOrSuper)) {
    return cronOrSuper;
  }
  return assertLeagueAdmin(leagueId);
}

/** Headers for trusted server-to-server calls (e.g. standings recalc). */
export function internalServiceHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const secret = process.env.CRON_SECRET;
  if (secret) {
    headers.Authorization = `Bearer ${secret}`;
  }
  return headers;
}
