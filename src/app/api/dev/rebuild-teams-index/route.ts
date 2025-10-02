// /src/app/api/dev/rebuild-teams-index/route.ts
import { kv } from "@vercel/kv";

export async function GET() {
  const keys = (await (kv as any).keys?.("team:*")) as string[] | undefined;
  const ids = new Set<string>();
  if (keys) {
    for (const k of keys) {
      const base = k.slice(5).split(":")[0]; // team:<id>[:...]
      if (base) ids.add(base);
    }
  }
  if (ids.size) await kv.sadd("teams:index", ...Array.from(ids));
  return Response.json({ ok: true, added: ids.size });
}