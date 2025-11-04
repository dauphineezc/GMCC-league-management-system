// /src/app/api/auth/me/route.ts
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic";

async function readUserProfile(uid: string): Promise<{ displayName?: string } | null> {
  const key = `user:${uid}`;

  // Try HASH first (HGETALL)
  try {
    const h = (await kv.hgetall(key)) as Record<string, unknown> | null;
    if (h && Object.keys(h).length) {
      return h as { displayName?: string };
    }
  } catch {
    // Not a hash, try GET
  }

  // Try GET (object or JSON string)
  try {
    const g = await kv.get(key);
    if (!g) return null;
    if (typeof g === "object") return g as { displayName?: string };
    if (typeof g === "string") {
      const s = g.trim();
      if (!s) return null;
      try {
        return JSON.parse(s) as { displayName?: string };
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function GET() {
  try {
    const user = await getServerUser();
    
    if (!user?.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Fetch displayName from user profile
    const userProfile = await readUserProfile(user.id);
    const displayName = userProfile?.displayName || user.email || "";

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName,
      superadmin: user.superadmin,
      leagueAdminOf: user.leagueAdminOf,
    });
  } catch (e: any) {
    console.error("Error fetching user:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to fetch user" },
      { status: 500 }
    );
  }
}

