// API endpoint to update league description
// Only admins and superadmins can update

import { NextRequest, NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { revalidatePath } from "next/cache";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const user = await getServerUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const { leagueId } = await params;

  try {
    // Check permissions
    const permissions = await PermissionChecker.create(user, leagueId);

    // Only admins and superadmins can update league descriptions
    if (!permissions.isAdmin()) {
      return NextResponse.json(
        { error: 'Only admins can update the league description' },
        { status: 403 }
      );
    }

    // Get existing league data
    const league = await kv.get<any>(`league:${leagueId}`);
    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
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

    // Update league with new description
    const now = new Date().toISOString();
    await kv.set(`league:${leagueId}`, {
      ...league,
      description: description.trim(),
      updatedAt: now,
    });

    // Revalidate the league page
    revalidatePath(`/leagues/${leagueId}`);

    return NextResponse.json({ 
      success: true, 
      description: description.trim() 
    });
  } catch (error: any) {
    console.error('Error updating league description:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

