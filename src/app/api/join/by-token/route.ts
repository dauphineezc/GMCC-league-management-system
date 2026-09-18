// POST join via invite link token
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { peekLinkInvite } from "@/server/invites";
import { acceptInviteForUser } from "@/server/acceptInvite";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(req: NextRequest) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) {
    return jsonError("UNAUTHENTICATED", "Please sign in first to join this team.", 401);
  }
  const user = auth.user;

  let token = "";
  try {
    const body = await req.json();
    token = typeof body?.token === "string" ? body.token : "";
  } catch {
    return jsonError("INVITE_INVALID", "This invite link is invalid or has expired.", 400);
  }

  try {
    const invite = await peekLinkInvite(token);
    const { teamId } = await acceptInviteForUser(user.id, invite);
    return NextResponse.json({ ok: true, teamId });
  } catch (e: any) {
    const status = typeof e?.status === "number" ? e.status : 500;
    const code = typeof e?.code === "string" ? e.code : "JOIN_FAILED";
    const message = typeof e?.message === "string" ? e.message : "Failed to join team.";
    return jsonError(code, message, status);
  }
}
