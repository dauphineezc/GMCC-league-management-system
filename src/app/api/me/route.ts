import type { NextRequest } from "next/server";
import { kv } from "@vercel/kv";

// Minimal type used in this handler
type Membership = {
  leagueId: string;
  leagueName?: string;
  teamId: string;
  teamName?: string;
  isManager: boolean;
};

export async function GET(req: NextRequest) {
  // Middleware injects this header for /api routes. We also accept dev cookie fallback.
  const userId =
    req.headers.get("x-user-id") ||
    req.headers.get("cookie")?.match(/(?:^|;\s*)auth_user=([^;]+)/)?.[1] ||
    "";

  if (!userId) {
    return Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  }

  // profile is optional and can be whatever you decide later
  const profile =
    (await kv.get<any>(`user:${userId}`)) ?? { id: userId, createdAt: new Date().toISOString() };

  const memberships: Membership[] =
    (await kv.get<any[]>(`user:${userId}:memberships`)) ?? [];

  // choose the “primary” membership (manager first, else first)
  const primary =
    memberships.find((m) => m.isManager) ??
    memberships[0] ??
    null;

  // Light extras the dashboard expects
  let team = null;
  if (primary?.teamId) {
    team = (await kv.get<any>(`team:${primary.teamId}`)) ?? null;
  }

  return Response.json({
    userId,
    profile,
    membership: primary,
    memberships,
    team,
  });
}