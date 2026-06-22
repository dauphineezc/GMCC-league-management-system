// /src/app/api/users/[uid]/route.ts
import { NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { adminAuth } from "@/lib/firebaseAdmin";
import { deleteUserAccount } from "@/lib/repositories/usersRepo";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
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

    const stats = await deleteUserAccount(uid);

    try {
      await adminAuth.deleteUser(uid);
    } catch (authErr) {
      console.error("Error deleting Firebase user:", authErr);
    }

    return NextResponse.json({
      ok: true,
      message: "Account deleted successfully",
      stats: {
        rostersUpdated: stats.rostersUpdated,
        teamsDeleted: stats.teamsDeleted,
        leaguePlayersUpdated: stats.rostersUpdated,
        paymentsDeleted: stats.rostersUpdated,
        privateRosterDeleted: 0,
      },
    });
  } catch (e: any) {
    console.error("Error deleting account:", e);
    return NextResponse.json(
      { error: e?.message ?? "Failed to delete account" },
      { status: 500 }
    );
  }
}
