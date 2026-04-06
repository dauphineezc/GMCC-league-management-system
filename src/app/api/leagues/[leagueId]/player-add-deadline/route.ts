// API route for managing player add deadline for a league
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { readLeagueDocJSON } from "@/lib/leagueDoc";

// GET - Fetch the current player add deadline settings
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const user = await getServerUser();
  
  if (!user) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const permissions = await PermissionChecker.create(user, leagueId);
  
  if (!permissions.isAdmin()) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const league = await readLeagueDocJSON(leagueId);
  
  if (!league) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return Response.json({
    playerAddDeadline: league.playerAddDeadline ?? null,
    playerAddDeadlineOverride: league.playerAddDeadlineOverride ?? false,
  });
}

// PUT - Update the player add deadline settings
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const user = await getServerUser();
  
  if (!user) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const permissions = await PermissionChecker.create(user, leagueId);
  
  if (!permissions.isAdmin()) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const body = await req.json();
  const { playerAddDeadline, playerAddDeadlineOverride } = body;

  // Validate date if provided
  if (playerAddDeadline !== null && playerAddDeadline !== undefined) {
    const date = new Date(playerAddDeadline);
    if (isNaN(date.getTime())) {
      return Response.json({ error: "INVALID_DATE" }, { status: 400 });
    }
  }

  const league = await readLeagueDocJSON(leagueId);
  
  if (!league) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const key = `league:${leagueId}`;
  const updatedAt = new Date().toISOString();

  // Try writing as hash first (if league was created with writePatch)
  try {
    const updates: Record<string, any> = { updatedAt };
    
    // Handle playerAddDeadline
    if (playerAddDeadline !== undefined) {
      if (playerAddDeadline === null) {
        // If explicitly null, remove the field
        await kv.hdel(key, "playerAddDeadline");
      } else {
        updates.playerAddDeadline = playerAddDeadline;
      }
    }
    
    // Handle playerAddDeadlineOverride
    if (playerAddDeadlineOverride !== undefined) {
      updates.playerAddDeadlineOverride = playerAddDeadlineOverride;
    }
    
    // Only hset if we have updates (other than updatedAt)
    if (Object.keys(updates).length > 1 || (playerAddDeadline !== undefined && playerAddDeadline !== null)) {
      await kv.hset(key, updates as any);
    } else if (playerAddDeadline === null) {
      // If we only deleted the deadline, still update the timestamp
      await kv.hset(key, { updatedAt } as any);
    }
    
    return Response.json({
      ok: true,
      playerAddDeadline: playerAddDeadline !== undefined ? playerAddDeadline : (league.playerAddDeadline ?? null),
      playerAddDeadlineOverride: playerAddDeadlineOverride !== undefined ? playerAddDeadlineOverride : (league.playerAddDeadlineOverride ?? false),
    });
  } catch (err: any) {
    // If the failure is WRONGTYPE, fall through to JSON write
    const msg = String(err?.message || err);
    const wrongType = msg.includes("WRONGTYPE");
    if (!wrongType) {
      console.error("Error updating league deadline:", err);
      return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  // Fall back to JSON format
  const updatedLeague: any = {
    ...league,
    updatedAt,
  };
  
  if (playerAddDeadline !== undefined) {
    if (playerAddDeadline === null) {
      delete updatedLeague.playerAddDeadline;
    } else {
      updatedLeague.playerAddDeadline = playerAddDeadline;
    }
  }
  
  if (playerAddDeadlineOverride !== undefined) {
    updatedLeague.playerAddDeadlineOverride = playerAddDeadlineOverride;
  }

  await kv.set(key, updatedLeague);

  return Response.json({
    ok: true,
    playerAddDeadline: updatedLeague.playerAddDeadline ?? null,
    playerAddDeadlineOverride: updatedLeague.playerAddDeadlineOverride ?? false,
  });
}

// DELETE - Clear the player add deadline
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const user = await getServerUser();
  
  if (!user) {
    return Response.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }

  const permissions = await PermissionChecker.create(user, leagueId);
  
  if (!permissions.isAdmin()) {
    return Response.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const league = await readLeagueDocJSON(leagueId);
  
  if (!league) {
    return Response.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const key = `league:${leagueId}`;
  const updatedAt = new Date().toISOString();

  // Try writing as hash first (if league was created with writePatch)
  try {
    await kv.hdel(key, "playerAddDeadline");
    await kv.hset(key, { playerAddDeadlineOverride: false, updatedAt } as any);
    return Response.json({ ok: true });
  } catch (err: any) {
    // If the failure is WRONGTYPE, fall through to JSON write
    const msg = String(err?.message || err);
    const wrongType = msg.includes("WRONGTYPE");
    if (!wrongType) {
      console.error("Error clearing league deadline:", err);
      return Response.json({ error: "INTERNAL_ERROR" }, { status: 500 });
    }
  }

  // Fall back to JSON format
  const updatedLeague = {
    ...league,
    playerAddDeadline: undefined,
    playerAddDeadlineOverride: false,
    updatedAt,
  };

  await kv.set(key, updatedLeague);

  return Response.json({ ok: true });
}

