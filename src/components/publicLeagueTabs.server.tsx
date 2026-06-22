// /src/components/publicLeagueTabs.server.tsx
export const runtime = "nodejs";
export const revalidate = 60;

import PublicLeagueTabs from "./publicLeagueTabs";
import { DIVISIONS } from "@/lib/divisions";
import type { Sport } from "@/types/domain";
import { readLeagueDoc, smembersSafe } from "@/lib/kvHelpers";

type LeagueRow = { id: string; name: string; sport: Sport };

function normSport(s: unknown): Sport {
  const v = String(s ?? "").toLowerCase();
  if (v === "volleyball") return "volleyball";
  return "basketball";
}

export default async function PublicLeagueTabsServer({
  defaultTab = "basketball",
}: {
  defaultTab?: "basketball" | "volleyball";
}) {
  const ids = await smembersSafe("leagues:index");

  const rows: LeagueRow[] = await Promise.all(
    ids.map(async (id) => {
      const doc = await readLeagueDoc(id);
      const sport = normSport(doc?.sport);
      const name =
        (doc?.name != null ? String(doc.name) : "") ||
        DIVISIONS.find((d) => d.id === id)?.name ||
        id;
      return { id, name, sport };
    })
  );

  return <PublicLeagueTabs leagues={rows} defaultTab={defaultTab} />;
}
