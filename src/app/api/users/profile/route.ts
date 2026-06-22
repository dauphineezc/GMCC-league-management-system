// /src/app/api/users/profile/route.ts
import { NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { upsertUserProfile } from "@/lib/repositories/usersRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await assertAuthenticated();
    if (isAuthFailure(auth)) return auth.response;
    const me = auth.user;

    const body = await req.json().catch(() => ({}));
    const { firstName, lastName } = body || {};
    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!me.email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    await upsertUserProfile({
      id: me.id,
      email: me.email,
      displayName: `${firstName} ${lastName}`.trim(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
