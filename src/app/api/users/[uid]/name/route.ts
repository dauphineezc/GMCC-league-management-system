// /src/app/api/users/[uid]/name/route.ts
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { kv } from "@vercel/kv";

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

export async function PUT(
  req: Request,
  { params }: { params: { uid: string } }
) {
  try {
    const me = await getServerUser();
    if (!me?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Users can only update their own name
    if (me.id !== params.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { firstName, lastName } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: "First and last name are required" },
        { status: 400 }
      );
    }

    const newDisplayName = `${firstName.trim()} ${lastName.trim()}`;
    const uid = params.uid;

    // 1. Update user profile (handle both Hash and GET formats)
    const userKey = `user:${uid}`;
    let userProfile: any = null;
    
    // Try reading as Hash first
    try {
      const h = await kv.hgetall(userKey);
      if (h && Object.keys(h).length) {
        userProfile = h;
      }
    } catch {
      // Try as GET
      try {
        userProfile = await kv.get<any>(userKey);
      } catch {}
    }
    
    if (userProfile) {
      // Update the profile with new display name
      const updatedProfile = {
        ...userProfile,
        displayName: newDisplayName,
        updatedAt: new Date().toISOString(),
      };
      
      // Write back using SET (converts Hash to GET format for consistency)
      await kv.set(userKey, updatedProfile);
    }

    // 2. Get all leagues
    const leagueIds = await smembers("leagues:index");

    // 3. Update displayName in all team rosters and league player lists
    for (const leagueId of leagueIds) {
      // Get teams in this league
      const teamIds = await smembers(`league:${leagueId}:teams`);

      // Update league players list
      const leaguePlayersKey = `league:${leagueId}:players`;
      const leaguePlayers = await readArr<any>(leaguePlayersKey);
      let leaguePlayersUpdated = false;

      for (const player of leaguePlayers) {
        if (player.userId === uid) {
          player.displayName = newDisplayName;
          leaguePlayersUpdated = true;
        }
      }

      if (leaguePlayersUpdated) {
        await kv.set(leaguePlayersKey, leaguePlayers);
      }

      // Update team rosters
      for (const teamId of teamIds) {
        const rosterKey = `team:${teamId}:roster`;
        const roster = await readArr<any>(rosterKey);
        let rosterUpdated = false;

        for (const member of roster) {
          if (member.userId === uid) {
            member.displayName = newDisplayName;
            rosterUpdated = true;
          }
        }

        if (rosterUpdated) {
          await kv.set(rosterKey, roster);
        }
      }
    }

    // 4. Also check teams that might not be in leagues (unassigned teams)
    const allTeamIds = await smembers("teams:index");
    for (const teamId of allTeamIds) {
      const rosterKey = `team:${teamId}:roster`;
      const roster = await readArr<any>(rosterKey);
      let rosterUpdated = false;

      for (const member of roster) {
        if (member.userId === uid) {
          member.displayName = newDisplayName;
          rosterUpdated = true;
        }
      }

      if (rosterUpdated) {
        await kv.set(rosterKey, roster);
      }
    }

    return NextResponse.json({ 
      ok: true, 
      displayName: newDisplayName 
    });
  } catch (e: any) {
    console.error("Error updating name:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to update name" },
      { status: 500 }
    );
  }
}

