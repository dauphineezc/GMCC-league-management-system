import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { readLeagueName } from "@/lib/readLeagueName";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  const { leagueId } = await params;
  const name = await readLeagueName(leagueId);

  return new Response(JSON.stringify({ id: leagueId, name }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
