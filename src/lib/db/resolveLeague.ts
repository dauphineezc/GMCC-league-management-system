import { db } from "@/db/index";
import { leagues } from "@/db/schema";
import { eq, or } from "drizzle-orm";

export type LeagueRow = typeof leagues.$inferSelect;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Resolve a URL ref (slug or uuid) to a league row. */
export async function resolveLeagueByRef(ref: string): Promise<LeagueRow | null> {
  const r = ref?.trim();
  if (!r) return null;

  if (UUID_RE.test(r)) {
    const rows = await db
      .select()
      .from(leagues)
      .where(or(eq(leagues.id, r), eq(leagues.slug, r)))
      .limit(1);
    return rows[0] ?? null;
  }

  const rows = await db.select().from(leagues).where(eq(leagues.slug, r)).limit(1);
  return rows[0] ?? null;
}

/** Public URL segment for a league (slug). */
export function leaguePublicRef(league: LeagueRow): string {
  return league.slug;
}
