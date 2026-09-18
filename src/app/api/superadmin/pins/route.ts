import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import {
  isLeaguePinned,
  listPinnedLeagueRefs,
  pinLeague,
  unpinLeague,
} from "@/lib/repositories/pinnedLeaguesRepo";

/** List pinned league refs for the current superadmin. */
export async function GET() {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const pinned = await listPinnedLeagueRefs(auth.user.id);
  return Response.json({ ok: true, pinned });
}

/** Pin or unpin a league for the current superadmin homepage. */
export async function POST(req: Request) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    leagueId?: string;
    pinned?: boolean;
  };
  const leagueId = String(body.leagueId ?? "").trim();
  if (!leagueId) {
    return Response.json({ ok: false, error: "LEAGUE_REQUIRED" }, { status: 400 });
  }

  const wantPinned = body.pinned !== false;
  const ok = wantPinned
    ? await pinLeague(auth.user.id, leagueId)
    : await unpinLeague(auth.user.id, leagueId);

  if (!ok && wantPinned) {
    return Response.json({ ok: false, error: "LEAGUE_NOT_FOUND" }, { status: 404 });
  }

  const pinned = await isLeaguePinned(auth.user.id, leagueId);
  return Response.json({ ok: true, pinned, leagueId });
}
