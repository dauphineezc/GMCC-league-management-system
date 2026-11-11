import { NextRequest, NextResponse } from "next/server";
import {
  assertAuthenticated,
  assertLeagueAdminForUser,
  isAuthFailure,
} from "@/lib/authGuards";
import { resolveLeagueByRef } from "@/lib/db/resolveLeague";
import { parseDob, parsePhone } from "@/lib/profileValidation";
import type { ServerUser } from "@/lib/serverUser";
import { getUserDoc, readMembershipsForUid, upsertUserProfile } from "@/lib/repositories/usersRepo";

export const dynamic = "force-dynamic";

async function canViewContact(
  me: ServerUser,
  uid: string,
  leagueId?: string
): Promise<boolean> {
  if (me.superadmin || me.id === uid) return true;
  if (!leagueId) return false;

  const leagueAuth = await assertLeagueAdminForUser(me, leagueId);
  if (isAuthFailure(leagueAuth)) return false;

  const league = await resolveLeagueByRef(leagueId);
  if (!league) return false;
  const memberships = await readMembershipsForUid(uid);
  return memberships.some((m) => m.leagueId === league.slug);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    const auth = await assertAuthenticated();
    if (isAuthFailure(auth)) return auth.response;
    const me = auth.user;

    const { uid } = await params;
    const leagueId = new URL(req.url).searchParams.get("leagueId") || undefined;

    const allowed = await canViewContact(me, uid, leagueId);
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const profile = await getUserDoc(uid);
    return NextResponse.json({
      phone: profile?.phone ? String(profile.phone) : "",
      dob: profile?.dob ? String(profile.dob) : "",
    });
  } catch (e: any) {
    console.error("Error reading contact:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to load contact info" },
      { status: 500 }
    );
  }
}

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
    const hasPhone = Object.prototype.hasOwnProperty.call(body, "phone");
    const hasDob = Object.prototype.hasOwnProperty.call(body, "dob");

    if (!hasPhone && !hasDob) {
      return NextResponse.json(
        { error: "Provide phone and/or dob to update" },
        { status: 400 }
      );
    }

    let phone: string | null | undefined;
    let dob: string | null | undefined;

    if (hasPhone) {
      const parsed = parsePhone(body.phone);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      phone = parsed.value;
    }
    if (hasDob) {
      const parsed = parseDob(body.dob);
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      dob = parsed.value;
    }

    const existing = await getUserDoc(uid);
    const email = (existing?.email as string | undefined) ?? me.email;

    if (!email) {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    await upsertUserProfile({
      id: uid,
      email,
      ...(hasPhone ? { phone } : {}),
      ...(hasDob ? { dob } : {}),
    });

    return NextResponse.json({
      ok: true,
      phone: hasPhone ? phone ?? "" : String(existing?.phone ?? ""),
      dob: hasDob ? dob ?? "" : String(existing?.dob ?? ""),
    });
  } catch (e: any) {
    console.error("Error updating contact:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to update contact info" },
      { status: 500 }
    );
  }
}
