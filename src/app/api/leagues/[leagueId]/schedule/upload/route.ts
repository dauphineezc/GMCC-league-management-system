// src/app/api/leagues/[leagueId]/schedule/upload/route.ts
import { kvSetRaw, SCHEDULE_KEY } from "@/lib/scheduleKv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { leagueId: string } }) {
  const lid = params.leagueId;
  const key = SCHEDULE_KEY(lid);

  const form = await req.formData();
  const picked = (form.get("pdf") || form.get("file")) as File | null;
  if (!picked) {
    return new Response(JSON.stringify({ error: "Missing file (field 'pdf' or 'file')" }), {
      status: 400, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  const buf = Buffer.from(await picked.arrayBuffer());
  const doc = {
    filename: picked.name,
    size: buf.length,
    uploadedAt: new Date().toISOString(),
    data: buf.toString("base64"),
  };

  // Overwrite in one shot (no multiple keys)
  await kvSetRaw(key, doc);

  return new Response(JSON.stringify({ ok: true, key, filename: picked.name, size: buf.length }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}