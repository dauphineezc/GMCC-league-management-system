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

// Read a document that could be stored as HASH or JSON
async function readDoc<T extends Record<string, any>>(key: string): Promise<T | null> {
  try {
    const h = (await kv.hgetall(key)) as unknown;
    if (h && typeof h === "object" && Object.keys(h as object).length) return h as T;
  } catch {}
  const raw = (await kv.get(key)) as unknown;
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  if (typeof raw === "object") return raw as T;
  return null;
}

export async function DELETE(
  _req: Request,
  context: { params: { leagueId: string } | Promise<{ leagueId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return Response.json({ ok: false, error: "UNAUTHENTICATED" }, { status: 401 });
  }

  // Only superadmins can delete leagues
  if (!user.superadmin) {
    return Response.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Handle params as Promise (Next.js 15+) or direct object
  const params = await Promise.resolve(context.params);
  const leagueId = params.leagueId;
  console.log(`[DELETE LEAGUE] Received request to delete league: ${leagueId}`);

  // Check if league exists (handle both HASH and JSON formats)
  const leagueDoc = await readDoc<any>(`league:${leagueId}`);
  if (!leagueDoc) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  try {
    console.log(`[DELETE LEAGUE] Starting deletion of league ${leagueId}`);
    
    // 1) Remove league from global index
    console.log(`[DELETE LEAGUE] Removing league from global index`);
    await kv.srem("leagues:index", leagueId);

    // 2) Get all teams in this league
    console.log(`[DELETE LEAGUE] Fetching teams for league`);
    const teamIds = await smembers(`league:${leagueId}:teams`);
    console.log(`[DELETE LEAGUE] Found ${teamIds.length} teams:`, teamIds);

    // 3) Unassign all teams from this league (set leagueId to null)
    console.log(`[DELETE LEAGUE] Unassigning teams from league`);
    await Promise.all(
      teamIds.map(async (teamId) => {
        const team = await readDoc<any>(`team:${teamId}`);
        if (team) {
          console.log(`[DELETE LEAGUE] Unassigning team ${teamId}`);
          // Set leagueId to null to unassign the team
          // Use hset if it's a hash, or set if it's JSON
          try {
            await kv.hset(`team:${teamId}`, { leagueId: null } as any);
          } catch {
            await kv.set(`team:${teamId}`, { ...team, leagueId: null });
          }
        }
      })
    );

    // 4) Remove league from all admins' managed leagues lists
    // We need to check all possible admin storage locations

    // First, get the league's assigned admin from the league doc
    const adminUserId = leagueDoc?.adminUserId ?? null;
    console.log(`[DELETE LEAGUE] Admin user ID:`, adminUserId);
    if (adminUserId) {
      // Remove from admin's KV set
      console.log(`[DELETE LEAGUE] Removing league from admin's KV set`);
      await kv.srem(`admin:${adminUserId}:leagues`, leagueId);
      
      // Also check for legacy array format
      try {
        const val = await kv.get<any>(`admin:${adminUserId}:leagues`);
        if (Array.isArray(val)) {
          console.log(`[DELETE LEAGUE] Found legacy array format, filtering`);
          const filtered = val.filter((id) => id !== leagueId);
          await writeArr(`admin:${adminUserId}:leagues`, filtered);
        }
      } catch (legacyError) {
        console.log(`[DELETE LEAGUE] Error handling legacy format:`, legacyError);
      }
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

    console.log(`[DELETE LEAGUE] Deleting ${leagueKeys.length} league-specific keys`);
    await Promise.all(leagueKeys.map((key) => kv.del(key)));

    console.log(`[DELETE LEAGUE] Successfully deleted league ${leagueId}`);
    return Response.json({ ok: true, deleted: leagueId });
  } catch (error: any) {
    console.error("[DELETE LEAGUE] Error deleting league:", error);
    console.error("[DELETE LEAGUE] Error stack:", error?.stack);
    console.error("[DELETE LEAGUE] Error details:", {
      message: error?.message,
      name: error?.name,
      cause: error?.cause,
    });
    return Response.json(
      { ok: false, error: error?.message ?? "Failed to delete league" },
      { status: 500 }
    );
  }
}

