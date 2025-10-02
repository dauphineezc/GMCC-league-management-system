// /src/components/publicLeagueTabs.server.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import PublicLeagueTabs from "./publicLeagueTabs";
import { DIVISIONS } from "@/lib/divisions";
import type { Sport } from "@/types/domain";

type LeagueRow = { id: string; name: string; sport: Sport };

/* safe SMEMBERS */
async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers<string[]>(key)) ?? [];
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

/* tolerant reader for league docs that may be HASH or STRING(JSON) */
async function readLeagueDoc(leagueId: string): Promise<Record<string, any> | null> {
  // 1) try HASH
  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, any> | null;
    if (h && typeof h === "object" && Object.keys(h).length) return h;
  } catch {
    /* ignore */
  }

  // 2) fallback GET (could be object or JSON string)
  try {
    const g = (await kv.get(`league:${leagueId}`)) as unknown;
    if (!g) return null;
    if (typeof g === "object") return g as Record<string, any>;
    if (typeof g === "string") {
      const s = g.trim();
      if (!s) return null;
      try {
        const obj = JSON.parse(s);
        if (obj && typeof obj === "object") return obj as Record<string, any>;
      } catch {
        /* not JSON */
      }
    }
  } catch {
    /* ignore WRONGTYPE/other */
  }

  return null;
}

function normSport(s: unknown): Sport {
  const v = String(s ?? "").toLowerCase();
  if (v === "volleyball") return "volleyball";
  return "basketball"; // default if missing/unknown
}

export default async function PublicLeagueTabsServer({
  defaultTab = "basketball",
}: {
  defaultTab?: "basketball" | "volleyball";
}) {
  // read all league ids
  const ids = await smembersSafe("leagues:index");

  // build rows with tolerant reads
  const rows: LeagueRow[] = await Promise.all(
    ids.map(async (id) => {
      const doc = await readLeagueDoc(id);
      const sport = normSport(doc?.sport);
      const name =
        (doc?.name && String(doc.name)) ||
        DIVISIONS.find((d) => d.id === id)?.name ||
        id;
      return { id, name, sport };
    })
  );

  // pass to client; the client already groups/sorts per tab
  return <PublicLeagueTabs leagues={rows} defaultTab={defaultTab} />;
}