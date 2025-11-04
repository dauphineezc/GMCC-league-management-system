// Debug endpoint to check user profile
import { NextRequest } from "next/server";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";

export async function GET(_req: NextRequest) {
  const user = await getServerUser();
  if (!user?.id) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userProfile = await kv.get<any>(`user:${user.id}`);
  
  return Response.json({
    userId: user.id,
    email: user.email,
    userProfile,
    hasDisplayName: !!userProfile?.displayName,
    displayNameValue: userProfile?.displayName || null,
  });
}

