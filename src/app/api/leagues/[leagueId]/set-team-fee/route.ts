import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { Team } from "@/types/domain";

/* ---------------- helpers ---------------- */

async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers(key)) as unknown;
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  } catch {
    /* ignore WRONGTYPE */
  }
  return [];
}

async function readArr<T = any>(key: string): Promise<T[]> {
  let raw: unknown;
  try {
    raw = await kv.get(key);
  } catch {
    return [];
  }
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? (arr as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/* ---------------- API Route ---------------- */

export async function POST(
  req: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const leagueId = params.leagueId;
    
    // 1. Authenticate user
    const user = await getServerUser();
    if (!user) {
      return NextResponse.json(
        { error: { message: "Unauthorized" } },
        { status: 401 }
      );
    }

    // 2. Check permissions (must be admin or superadmin)
    const permissions = await PermissionChecker.create(user, leagueId);
    if (!permissions.isAdmin()) {
      return NextResponse.json(
        { error: { message: "Forbidden: Admin access required" } },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body = await req.json();
    const { amountCents } = body;

    if (typeof amountCents !== "number" || amountCents < 0) {
      return NextResponse.json(
        { error: { message: "Invalid amount" } },
        { status: 400 }
      );
    }

    // 4. Get all teams in the league
    const teamIds = await smembersSafe(`league:${leagueId}:teams`);
    
    // If no teams in the index, try to get from players list
    if (teamIds.length === 0) {
      const players = await readArr<any>(`league:${leagueId}:players`);
      const teamIdsFromPlayers = new Set<string>();
      for (const p of players) {
        const tid = p?.teamId ?? p?.id ?? p;
        if (tid && typeof tid === "string") {
          teamIdsFromPlayers.add(tid);
        }
      }
      teamIds.push(...Array.from(teamIdsFromPlayers));
    }

    if (teamIds.length === 0) {
      return NextResponse.json(
        { error: { message: "No teams found in this league" } },
        { status: 404 }
      );
    }

    // 5. Update each team's teamFee field
    const now = new Date().toISOString();
    const updatePromises = teamIds.map(async (teamId) => {
      const team = await kv.get<Team>(`team:${teamId}`);
      if (!team) return;

      const updatedTeam: Team = {
        ...team,
        teamFee: {
          required: true,
          amountCents,
          paid: team.teamFee?.paid ?? false,
          paidAt: team.teamFee?.paidAt,
          payerNote: team.teamFee?.payerNote,
        },
        updatedAt: now,
      };

      await kv.set(`team:${teamId}`, updatedTeam);
    });

    await Promise.all(updatePromises);

    // 6. Revalidate pages
    revalidatePath(`/leagues/${leagueId}`);
    for (const teamId of teamIds) {
      revalidatePath(`/team/${teamId}`);
    }

    return NextResponse.json({
      success: true,
      message: `Team fee of $${(amountCents / 100).toFixed(2)} set for ${teamIds.length} team(s)`,
      teamsUpdated: teamIds.length,
    });
  } catch (error: any) {
    console.error("Error setting team fee:", error);
    return NextResponse.json(
      { error: { message: error.message || "Internal server error" } },
      { status: 500 }
    );
  }
}

