// /src/app/api/users/profile/route.ts
import { kv } from "@vercel/kv";
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser"; // your existing helper

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await getServerUser(); // must read uid from fb:session cookie
    if (!me?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { firstName, lastName, gender, dob } = body || {};
    if (!firstName || !lastName || !dob) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Normalize
    const now = new Date().toISOString();
    const profileKey = `user:${me.id}`;
    const membershipsKey = `user:${me.id}:memberships`;

    // Read old (if any) to preserve email, createdAt, etc.
    const prev = await kv.get<any>(profileKey);

    const updated = {
      id: me.id,
      email: prev?.email ?? me.email ?? null,
      displayName: `${firstName} ${lastName}`.trim(),
      gender,               // store as provided
      dob,                  // store yyyy-mm-dd; transform to ISO if you prefer
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
    };

    await kv.set(profileKey, updated);

    // Initialize memberships list if absent
    const currentMemberships = await kv.get(membershipsKey);
    if (!currentMemberships) {
      await kv.set(membershipsKey, []); // []
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}