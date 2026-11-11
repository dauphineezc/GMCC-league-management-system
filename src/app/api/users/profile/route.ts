// /src/app/api/users/profile/route.ts
import { NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { parseDob, parsePersonName, parsePhone } from "@/lib/profileValidation";
import { upsertUserProfile } from "@/lib/repositories/usersRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await assertAuthenticated();
    if (isAuthFailure(auth)) return auth.response;
    const me = auth.user;

    const body = await req.json().catch(() => ({}));
    const first = parsePersonName(body?.firstName, "First name");
    if (!first.ok) {
      return NextResponse.json({ error: first.error }, { status: 400 });
    }
    const last = parsePersonName(body?.lastName, "Last name");
    if (!last.ok) {
      return NextResponse.json({ error: last.error }, { status: 400 });
    }

    const dobParsed = parseDob(body?.dob);
    if (!dobParsed.ok) {
      return NextResponse.json({ error: dobParsed.error }, { status: 400 });
    }
    if (!dobParsed.value) {
      return NextResponse.json(
        { error: "Date of birth is required" },
        { status: 400 }
      );
    }

    const phoneParsed = parsePhone(body?.phone);
    if (!phoneParsed.ok) {
      return NextResponse.json({ error: phoneParsed.error }, { status: 400 });
    }

    if (!me.email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    await upsertUserProfile({
      id: me.id,
      email: me.email,
      displayName: `${first.value} ${last.value}`,
      dob: dobParsed.value,
      ...(phoneParsed.value ? { phone: phoneParsed.value } : {}),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed" }, { status: 500 });
  }
}
