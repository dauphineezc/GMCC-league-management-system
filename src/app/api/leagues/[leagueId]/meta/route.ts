import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";

export async function GET(
  _req: Request,
  { params }: { params: { leagueId: string } }
) {
  const { leagueId } = params;

  // Try hash then JSON doc, then static DIVISIONS, then id
  let name: string | null = null;

  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, unknown> | null;
    if (h && typeof h === "object" && h.name) name = String(h.name);
  } catch {}

  if (!name) {
    try {
      const g = (await kv.get(`league:${leagueId}`)) as any;
      if (g && typeof g === "object" && g.name) name = String(g.name);
    } catch {}
  }

  if (!name) {
    name = DIVISIONS.find(d => d.id === leagueId)?.name ?? leagueId;
  }

  return new Response(JSON.stringify({ id: leagueId, name }), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}