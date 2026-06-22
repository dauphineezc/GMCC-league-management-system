// src/app/api/leagues/[leagueId]/schedule/upload/route.ts
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { upsertSchedulePdf } from "@/lib/repositories/schedulePdfsRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId: lid } = await params;
  const auth = await assertLeagueAdmin(lid);
  if (isAuthFailure(auth)) return auth.response;

  const form = await req.formData();
  const picked = (form.get("pdf") || form.get("file")) as File | null;
  if (!picked) {
    return new Response(
      JSON.stringify({ error: "Missing file (field 'pdf' or 'file')" }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store",
        },
      }
    );
  }

  const buf = Buffer.from(await picked.arrayBuffer());
  const info = await upsertSchedulePdf(lid, {
    filename: picked.name,
    bytes: buf,
  });

  return new Response(
    JSON.stringify({
      ok: true,
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
