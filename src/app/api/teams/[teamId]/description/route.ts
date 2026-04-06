// API endpoint to update team description
// Only team managers and admins can update

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import type { Team } from "@/types/domain";

async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { teamId } = await params;

  try {
    // Get team
    const team = await kv.get<Team>(`team:${teamId}`);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const leagueId = team.leagueId || '';

    // Check permissions
    const permissions = await PermissionChecker.create(user, leagueId);
    
    // Get roster to check if user is team manager
    const roster = await readArr<any>(`team:${teamId}:roster`);
    const requestingUserInRoster = roster.find(r => r.userId === user.id);
    const isTeamManager = requestingUserInRoster?.isManager === true;

    // Allow if user is admin/superadmin OR team manager
    if (!permissions.isAdmin() && !isTeamManager) {
      return NextResponse.json(
        { error: 'Only team managers or admins can update the team description' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { description } = body;

    if (typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Description must be a string' },
        { status: 400 }
      );
    }

    // Update team with new description
    const now = new Date().toISOString();
    await kv.set(`team:${teamId}`, {
      ...team,
      description: description.trim(),
      updatedAt: now,
    });

    // Revalidate relevant paths
    revalidatePath(`/team/${teamId}`);
    if (team.leagueId) {
      revalidatePath(`/leagues/${team.leagueId}`);
    }

    return NextResponse.json({ 
      success: true, 
      description: description.trim() 
    });
  } catch (error: any) {
    console.error('Error updating team description:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

