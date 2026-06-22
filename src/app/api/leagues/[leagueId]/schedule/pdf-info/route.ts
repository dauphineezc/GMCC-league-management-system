// src/app/api/leagues/[leagueId]/schedule/pdf-info/route.ts
import { assertAuthenticated, isAuthFailure } from "@/lib/authGuards";
import { getSchedulePdfInfo } from "@/lib/repositories/schedulePdfsRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  const { leagueId: lid } = await params;
  const info = await getSchedulePdfInfo(lid);

  if (!info) {
    return new Response(JSON.stringify({ error: "not-found", leagueId: lid }), {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(
    JSON.stringify({
      leagueId: lid,
      filename: info.filename,
      size: info.size,
      uploadedAt: info.uploadedAt,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}
