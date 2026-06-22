// src/app/api/leagues/[leagueId]/schedule/pdf/route.ts
import { assertAuthenticated, assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import {
  deleteSchedulePdf,
  getSchedulePdfBytes,
} from "@/lib/repositories/schedulePdfsRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const auth = await assertAuthenticated();
  if (isAuthFailure(auth)) return auth.response;

  const { leagueId } = await params;
  const pdf = await getSchedulePdfBytes(leagueId);

  if (!pdf) {
    return new Response(JSON.stringify({ error: "not-found", leagueId }), {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(new Uint8Array(pdf.bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${pdf.filename.replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) return auth.response;

  const deleted = await deleteSchedulePdf(leagueId);
  if (!deleted) {
    return new Response(JSON.stringify({ error: "not-found", leagueId }), {
      status: 404,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }

  return new Response(JSON.stringify({ ok: true, leagueId }), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
