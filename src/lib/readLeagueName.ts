// src/lib/readLeagueName.ts
import { DIVISIONS } from "@/lib/divisions";
import { readLeagueDocByRef } from "@/lib/repositories/leaguesRepo";

export async function readLeagueName(leagueId: string): Promise<string> {
  const doc = await readLeagueDocByRef(leagueId);
  if (doc?.name) return String(doc.name);
  return DIVISIONS.find((d) => d.id === leagueId)?.name ?? leagueId;
}
