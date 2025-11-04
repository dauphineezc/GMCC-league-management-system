// DELETE remove player from team
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getServerUser } from '@/lib/serverUser';
import { PermissionChecker } from '@/lib/permissions';
import { removePlayerFromTeam } from '@/server/memberships';
import { kv } from '@vercel/kv';

// Helper to read array from KV (handles both array and stringified JSON)
async function readArr<T = any>(key: string): Promise<T[]> {
  const raw = await kv.get(key);
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") return raw.trim() ? (JSON.parse(raw) as T[]) : [];
  return [];
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { teamId } = params;
  const body = await req.json();
  let { userId } = body;
  const { newManagerId } = body;

  // Handle 'self' marker for when user removes themselves
  if (userId === 'self') {
    userId = user.id;
  }

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    // Get team to check league
    const team = await kv.get<any>(`team:${teamId}`);
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const leagueId = team.leagueId || '';

    // Check permissions
    const permissions = await PermissionChecker.create(user, leagueId);
    
    // Get roster to check if user is manager
    const roster = await kv.get<any[]>(`team:${teamId}:roster`) || [];
    const requestingUserInRoster = roster.find(r => r.userId === user.id);
    const isTeamManager = requestingUserInRoster?.isManager === true;
    const isSelfRemoval = userId === user.id;

    // Allow if:
    // 1. User is removing themselves (leaving team)
    // 2. User is an admin/superadmin
    // 3. User is the team manager
    if (!isSelfRemoval && !permissions.isAdmin() && !isTeamManager) {
      return NextResponse.json(
        { error: 'Only admins, team managers, or the player themselves can remove a player' },
        { status: 403 }
      );
    }

    // Prevent manager from removing themselves if they're the only manager (unless assigning a new one)
    if (isSelfRemoval && isTeamManager) {
      const managerCount = roster.filter(r => r.isManager).length;
      if (managerCount === 1 && !newManagerId) {
        return NextResponse.json(
          { error: 'Cannot leave team: You are the only manager. Please assign another manager first.' },
          { status: 400 }
        );
      }
    }

    // If assigning a new manager, do that first
    if (newManagerId) {
      // Verify the new manager is on the roster
      const newManager = roster.find(r => r.userId === newManagerId);
      if (!newManager) {
        return NextResponse.json(
          { error: 'New manager not found on roster' },
          { status: 400 }
        );
      }

      // 1. Update the team document's managerUserId field
      await kv.set(`team:${teamId}`, {
        ...team,
        managerUserId: newManagerId,
      });

      // 2. Update the new manager's status in the roster
      const updatedRoster = roster.map(r => 
        r.userId === newManagerId ? { ...r, isManager: true } : r
      );
      await kv.set(`team:${teamId}:roster`, updatedRoster);

      // 3. Update the new manager's membership
      const newManagerMemberships = await readArr<any>(`user:${newManagerId}:memberships`);
      const updatedMemberships = newManagerMemberships.map((m: any) =>
        m.teamId === teamId ? { ...m, isManager: true } : m
      );
      await kv.set(`user:${newManagerId}:memberships`, updatedMemberships);
    }

    // Remove the player
    await removePlayerFromTeam(userId, teamId);

    return NextResponse.json({ 
      success: true,
      message: isSelfRemoval ? 'Successfully left the team' : 'Player removed successfully'
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to remove player' },
      { status: 500 }
    );
  }
}

