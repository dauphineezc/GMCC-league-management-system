import { kv } from "@vercel/kv";
import type { NextRequest } from "next/server";

const CANON_SPORTS  = new Set(["basketball","volleyball"]);
const CANON_GENDERS = new Set(["mens","womens","coed"]);
const CANON_DIVS    = new Set(["low_b","high_b","a"]);

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

async function smembers(key: string): Promise<string[]> {
  const v = (await kv.smembers(key)) as unknown;
  return Array.isArray(v) ? v as string[] : [];
}

export async function GET(req: NextRequest) {
  // safeguard: only allow local/dev
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok:false, error:"Disabled in production" }, { status:403 });
  }

  // discover team ids
  const setIds = await smembers("teams:index");
  const ids = new Set<string>(setIds);
  try {
    const maybeKeys = (await (kv as any).keys?.("team:*")) as string[] | undefined;
    for (const k of maybeKeys || []) {
      const rest = k.slice(5);
      const base = rest.split(":")[0];
      if (base) ids.add(base);
    }
  } catch {}

  let updated = 0;
  for (const id of ids) {
    const key = `team:${id}`;
    let t = (await kv.get<any>(key)) ?? null;
    if (!t) continue;

    // handle stringified docs
    if (typeof t === "string") {
      try { t = JSON.parse(t); } catch { continue; }
    }

    const before = JSON.stringify({ sport:t.sport, gender:t.gender, division:t.division, estimatedDivision:t.estimatedDivision });

    const sport = norm(t.sport);
    const gender = norm(t.gender);
    const div = norm(t.division ?? t.estimatedDivision);

    if (sport && !CANON_SPORTS.has(sport)) t.sport = sport;          // still normalize even if non-canon
    else if (sport) t.sport = sport;

    if (gender && CANON_GENDERS.has(gender)) t.gender = gender;
    else if (gender) t.gender = gender;

    if (div && CANON_DIVS.has(div)) {
      t.division = div;
      t.estimatedDivision ??= div;
    } else if (div) {
      t.division = div;
      t.estimatedDivision ??= div;
    }

    // persist if changed
    const after = JSON.stringify({ sport:t.sport, gender:t.gender, division:t.division, estimatedDivision:t.estimatedDivision });
    if (after !== before) {
      t.updatedAt = new Date().toISOString();
      await kv.set(key, t);
      updated++;
    }
  }

  return Response.json({ ok:true, teamsScanned: ids.size, updated });
}