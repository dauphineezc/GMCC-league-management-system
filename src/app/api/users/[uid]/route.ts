// /src/app/api/users/[uid]/route.ts
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { kv } from "@vercel/kv";
import { adminAuth } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key).catch(() => null);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    try {
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function smembers(key: string): Promise<string[]> {
  try {
    const result = await kv.smembers(key);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

async function readMap<T = Record<string, any>>(key: string): Promise<T> {
  const raw = await kv.get(key).catch(() => null);
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as T;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") return parsed as T;
    } catch {}
  }
  return {} as T;
}

export async function DELETE(
  req: Request,
  { params }: { params: { uid: string } }
) {
  try {
    const me = await getServerUser();
    if (!me?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Users can only delete their own account
    if (me.id !== params.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const uid = params.uid;
    const userEmail = me.email;

    let teamsDeleted = 0;
    let rostersUpdated = 0;
    let leaguePlayersUpdated = 0;
    let paymentsDeleted = 0;
    let privateRosterDeleted = 0;

    // 1. Get all leagues
    const leagueIds = await smembers("leagues:index");

    // 2. Process each league
    for (const leagueId of leagueIds) {
      // Get teams in this league
      const teamIds = await smembers(`league:${leagueId}:teams`);

      // Update league players list - remove this user
      const leaguePlayersKey = `league:${leagueId}:players`;
      const leaguePlayers = await readArr<any>(leaguePlayersKey);
      const filteredLeaguePlayers = leaguePlayers.filter(
        (p: any) => p.userId !== uid
      );

      if (filteredLeaguePlayers.length !== leaguePlayers.length) {
        await kv.set(leaguePlayersKey, filteredLeaguePlayers);
        leaguePlayersUpdated++;
      }

      // Process teams in league
      for (const teamId of teamIds) {
        await processTeam(teamId, uid);
      }
    }

    // 3. Process all teams (including unassigned ones)
    const allTeamIds = await smembers("teams:index");
    for (const teamId of allTeamIds) {
      const result = await processTeam(teamId, uid);
      rostersUpdated += result.rosterUpdated ? 1 : 0;
      paymentsDeleted += result.paymentDeleted ? 1 : 0;
      privateRosterDeleted += result.privateDeleted ? 1 : 0;
      teamsDeleted += result.teamDeleted ? 1 : 0;
    }

    // 4. Remove from admin leagues
    const adminKey = `admin:${uid}:leagues`;
    await kv.del(adminKey).catch(() => {});

    // Also check email-based admin key
    if (userEmail) {
      await kv.del(`admin:${userEmail}:leagues`).catch(() => {});
    }

    // 5. Delete user memberships
    await kv.del(`user:${uid}:memberships`).catch(() => {});
    if (userEmail) {
      await kv.del(`user:${userEmail}:memberships`).catch(() => {});
    }

    // 6. Delete user profile
    await kv.del(`user:${uid}`).catch(() => {});
    await kv.del(`user:${uid}:profile`).catch(() => {});

    // Delete email index
    if (userEmail) {
      const emailKey = `user:email:${userEmail.toLowerCase().trim()}`;
      await kv.del(emailKey).catch(() => {});
    }

    // 7. Delete Firebase Auth user
    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr) {
      console.error("Error deleting Firebase user:", authErr);
      // Continue even if auth deletion fails
    }

    return NextResponse.json({
      ok: true,
      message: "Account deleted successfully",
      stats: {
        rostersUpdated,
        leaguePlayersUpdated,
        paymentsDeleted,
        privateRosterDeleted,
        teamsDeleted,
      },
    });
  } catch (e: any) {
    console.error("Error deleting account:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to delete account" },
      { status: 500 }
    );
  }
}

async function processTeam(
  teamId: string,
  uid: string
): Promise<{
  rosterUpdated: boolean;
  paymentDeleted: boolean;
  privateDeleted: boolean;
  teamDeleted: boolean;
}> {
  let rosterUpdated = false;
  let paymentDeleted = false;
  let privateDeleted = false;
  let teamDeleted = false;

  // Get team info
  const team = await kv.get<any>(`team:${teamId}`);

  // If user is the manager and the ONLY member, delete the entire team
  if (team && team.managerUserId === uid) {
    const roster = await readArr<any>(`team:${teamId}:roster`);
    
    if (roster.length === 1 && roster[0].userId === uid) {
      // Delete the entire team
      await deleteTeam(teamId, team.leagueId);
      teamDeleted = true;
      return { rosterUpdated: true, paymentDeleted: true, privateDeleted: true, teamDeleted: true };
    }
    
    // If there are other members, transfer manager to another member
    if (roster.length > 1) {
      const newManager = roster.find((m: any) => m.userId !== uid);
      if (newManager) {
        await kv.set(`team:${teamId}`, {
          ...team,
          managerUserId: newManager.userId,
          updatedAt: new Date().toISOString(),
        });

        // Update roster to mark new manager
        const updatedRoster = roster
          .filter((m: any) => m.userId !== uid)
          .map((m: any) => ({
            ...m,
            isManager: m.userId === newManager.userId ? true : m.isManager,
          }));
        await kv.set(`team:${teamId}:roster`, updatedRoster);
        rosterUpdated = true;
      }
    }
  } else {
    // User is not manager, just remove from roster
    const roster = await readArr<any>(`team:${teamId}:roster`);
    const filteredRoster = roster.filter((m: any) => m.userId !== uid);

    if (filteredRoster.length !== roster.length) {
      await kv.set(`team:${teamId}:roster`, filteredRoster);
      rosterUpdated = true;
    }
  }

  // Remove from payments
  const paymentsKey = `team:${teamId}:payments`;
  const payments = await readMap<Record<string, boolean>>(paymentsKey);
  if (uid in payments) {
    delete payments[uid];
    await kv.set(paymentsKey, payments);
    paymentDeleted = true;
  }

  // Remove private roster data
  const privateKey = `team:${teamId}:roster:private:${uid}`;
  const privateData = await kv.get(privateKey);
  if (privateData !== null) {
    await kv.del(privateKey);
    privateDeleted = true;
  }

  return { rosterUpdated, paymentDeleted, privateDeleted, teamDeleted };
}

async function deleteTeam(teamId: string, leagueId: string | null) {
  // Remove team from league if assigned
  if (leagueId) {
    await kv.srem(`league:${leagueId}:teams`, teamId).catch(() => {});
  }

  // Remove from teams index
  await kv.srem("teams:index", teamId).catch(() => {});

  // Delete team data
  await kv.del(`team:${teamId}`).catch(() => {});
  await kv.del(`team:${teamId}:roster`).catch(() => {});
  await kv.del(`team:${teamId}:payments`).catch(() => {});
  await kv.del(`team:${teamId}:games`).catch(() => {});

  // Delete all private roster entries (we can't enumerate them easily, but they'll be orphaned)
  // This is acceptable as they won't be accessible anymore
}

