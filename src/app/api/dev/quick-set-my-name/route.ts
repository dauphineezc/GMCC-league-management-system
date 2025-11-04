// Quick dev endpoint to set your own displayName
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

export async function POST(req: NextRequest) {
  const user = await getServerUser();
  if (!user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { displayName } = await req.json();
  if (!displayName?.trim()) {
    return Response.json({ error: "displayName required" }, { status: 400 });
  }

  const profileKey = `user:${user.id}`;
  const existing = await kv.get<any>(profileKey) || {};
  
  await kv.set(profileKey, {
    ...existing,
    id: user.id,
    email: user.email,
    displayName: displayName.trim(),
    updatedAt: new Date().toISOString(),
  });

  return Response.json({ 
    ok: true, 
    message: "Display name updated",
    displayName: displayName.trim(),
  });
}

