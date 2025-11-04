// src/app/api/leagues/[leagueId]/route.ts
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

async function smembers(key: string): Promise<string[]> {
  const val = (await kv.smembers(key)) as unknown;
  return Array.isArray(val) ? (val as string[]) : [];
}

async function writeArr<T>(key: string, arr: T[]) {
  await kv.set(key, arr);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { leagueId: string } }
) {
  const user = await getServerUser();
  if (!user) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  // Only superadmins can delete leagues
  if (!user.superadmin) {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const leagueId = params.leagueId;

  // Check if league exists
  const leagueDoc = await kv.get<any>(`league:${leagueId}`);
  if (!leagueDoc) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    // 1) Remove league from global index
    await kv.srem("leagues:index", leagueId);

    // 2) Get all teams in this league
    const teamIds = await smembers(`league:${leagueId}:teams`);

    // 3) Unassign all teams from this league (set leagueId to null)
    await Promise.all(
      teamIds.map(async (teamId) => {
        const team = await kv.get<any>(`team:${teamId}`);
        if (team) {
          // Set leagueId to null to unassign the team
          await kv.set(`team:${teamId}`, { ...team, leagueId: null });
        }
      })
    );

    // 4) Remove league from all admins' managed leagues lists
    // We need to check all possible admin storage locations

    // First, get the league's assigned admin from the league doc
    const adminUserId = leagueDoc?.adminUserId ?? null;
    if (adminUserId) {
      // Remove from admin's KV set
      await kv.srem(`admin:${adminUserId}:leagues`, leagueId);
      
      // Also check for legacy array format
      try {
        const val = await kv.get<any>(`admin:${adminUserId}:leagues`);
        if (Array.isArray(val)) {
          const filtered = val.filter((id) => id !== leagueId);
          await writeArr(`admin:${adminUserId}:leagues`, filtered);
        }
      } catch {}
    }

    // Also scan for email-based admin keys (legacy support)
    // This is best-effort; we can't efficiently enumerate all possible email keys
    // But the primary cleanup above should handle most cases

    // 5) Delete all league-specific keys
    const leagueKeys = [
      `league:${leagueId}`,
      `league:${leagueId}:teams`,
      `league:${leagueId}:players`,
      `league:${leagueId}:games`,
      `league:${leagueId}:schedule`,
      `league:${leagueId}:standings`,
      `league:${leagueId}:admins`,
    ];

    await Promise.all(leagueKeys.map((key) => kv.del(key)));

    return Response.json({ ok: true, deleted: leagueId });
  } catch (error: any) {
    console.error("Error deleting league:", error);
    return Response.json(
      { ok: false, error: error?.message ?? "Failed to delete league" },
      { status: 500 }
    );
  }
}

