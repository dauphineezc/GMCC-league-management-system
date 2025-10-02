// src/app/api/leagues/[leagueId]/schedule/pdf-info/route.ts
import { kvGetRaw, parseDoc, SCHEDULE_KEY } from "@/lib/scheduleKv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { leagueId: string } }) {
  const lid = params.leagueId;
  const key = SCHEDULE_KEY(lid);

  const raw = await kvGetRaw(key);
  const doc = parseDoc(raw);

  if (!doc) {
    return new Response(JSON.stringify({ error: "not-found", key }), {
      status: 404,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }

  return new Response(JSON.stringify({
    key,
    filename: doc.filename ?? "",
    size: doc.size ?? null,
    uploadedAt: doc.uploadedAt ?? null,
  }), {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}