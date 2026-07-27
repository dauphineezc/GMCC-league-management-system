// src/app/api/team-names/route.ts
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { listTeamNames } from "@/lib/repositories/teamsRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  try {
    const url = new URL(req.url);
    const leagueId = url.searchParams.get("leagueId")?.trim() || undefined;
    const names = await listTeamNames(leagueId);
    return new Response(JSON.stringify(names), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return new Response(JSON.stringify([]), { status: 200 });
  }
}
