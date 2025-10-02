// src/app/api/leagues/[leagueId]/schedule/pdf/route.ts
import { kvGetRaw, kvDelRaw, parseDoc, SCHEDULE_KEY } from "@/lib/scheduleKv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { leagueId: string } }) {
  const key = SCHEDULE_KEY(params.leagueId);
  const doc = parseDoc(await kvGetRaw(key));
  if (!doc?.data) {
    return new Response(JSON.stringify({ error: "not-found", key }), {
      status: 404, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
    });
  }
  const bytes = Buffer.from(doc.data, "base64");
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename="${(doc.filename || "schedule.pdf").replace(/"/g, "")}"`,
      "cache-control": "no-store",
    },
  });
}

export async function DELETE(_req: Request, { params }: { params: { leagueId: string } }) {
  const key = SCHEDULE_KEY(params.leagueId);
  await kvDelRaw(key);
  return new Response(JSON.stringify({ ok: true, key }), {
    status: 200, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}