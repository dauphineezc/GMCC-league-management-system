// /src/app/api/users/[uid]/name/route.ts
import { NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { getUserDoc, upsertUserProfile } from "@/lib/repositories/usersRepo";

export const dynamic = "force-dynamic";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const auth = await assertAuthenticated();
    if (isAuthFailure(auth)) return auth.response;
    const me = auth.user;

    const { uid } = await params;

    if (me.id !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { firstName, lastName } = body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return NextResponse.json(
        { error: "First and last name are required" },
        { status: 400 }
      );
    }

    const newDisplayName = `${firstName.trim()} ${lastName.trim()}`;
    const existing = await getUserDoc(uid);
    const email = (existing?.email as string | undefined) ?? me.email;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    await upsertUserProfile({
      id: uid,
      email,
      displayName: newDisplayName,
    });

    return NextResponse.json({
      ok: true,
      displayName: newDisplayName,
    });
  } catch (e: any) {
    console.error("Error updating name:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to update name" },
      { status: 500 }
    );
  }
}
