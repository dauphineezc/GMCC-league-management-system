import { db } from "@/db/index";
import { divisions, type DivisionRow, type Sport } from "@/db/schema";
import { and, asc, eq, max } from "drizzle-orm";

export type DivisionOption = {
  id: string;
  sport: Sport;
  slug: string;
  name: string;
  sortOrder: number;
};

const SPORTS = new Set<Sport>(["basketball", "volleyball"]);

export function normalizeSport(value: unknown): Sport | null {
  const s = String(value ?? "").trim().toLowerCase();
  if (s === "basketball" || s === "volleyball") return s;
  return null;
}

function toOption(row: DivisionRow): DivisionOption {
  return {
    id: row.id,
    sport: row.sport as Sport,
    slug: row.slug,
    name: row.name,
    sortOrder: row.sortOrder,
  };
}

/** Normalize a display/label value into a stable slug (e.g. "Low B" → "low_b"). */
export function slugifyDivisionName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");
}

export async function listDivisions(sport?: Sport | string | null): Promise<DivisionOption[]> {
  const sportFilter = normalizeSport(sport);
  const rows = sportFilter
    ? await db
        .select()
        .from(divisions)
        .where(eq(divisions.sport, sportFilter))
        .orderBy(asc(divisions.sortOrder), asc(divisions.name))
    : await db
        .select()
        .from(divisions)
        .orderBy(asc(divisions.sport), asc(divisions.sortOrder), asc(divisions.name));
  return rows.map(toOption);
}

export async function getDivisionBySlug(
  slug: string,
  sport?: Sport | string | null
): Promise<DivisionOption | null> {
  const normalized = slugifyDivisionName(slug);
  if (!normalized) return null;
  const sportFilter = normalizeSport(sport);
  const [row] = sportFilter
    ? await db
        .select()
        .from(divisions)
        .where(and(eq(divisions.slug, normalized), eq(divisions.sport, sportFilter)))
        .limit(1)
    : await db
        .select()
        .from(divisions)
        .where(eq(divisions.slug, normalized))
        .limit(1);
  return row ? toOption(row) : null;
}

export async function isKnownDivisionSlug(
  slug: string,
  sport?: Sport | string | null
): Promise<boolean> {
  return (await getDivisionBySlug(slug, sport)) != null;
}

export async function createDivision(
  name: string,
  sportInput: Sport | string
): Promise<DivisionOption> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Division name is required");

  const sport = normalizeSport(sportInput);
  if (!sport || !SPORTS.has(sport)) {
    throw new Error("Sport must be basketball or volleyball");
  }

  let slug = slugifyDivisionName(trimmed);
  if (!slug) throw new Error("Division name must contain letters or numbers");

  const existing = await listDivisions(sport);
  const used = new Set(existing.map((d) => d.slug));
  if (used.has(slug)) {
    let n = 2;
    while (used.has(`${slug}_${n}`)) n += 1;
    slug = `${slug}_${n}`;
  }

  const [{ value: maxSort } = { value: -1 }] = await db
    .select({ value: max(divisions.sortOrder) })
    .from(divisions)
    .where(eq(divisions.sport, sport));
  const sortOrder = (maxSort ?? -1) + 1;

  const [row] = await db
    .insert(divisions)
    .values({
      sport,
      slug,
      name: trimmed,
      sortOrder,
      updatedAt: new Date(),
    })
    .returning();

  return toOption(row);
}

export async function updateDivisionName(
  id: string,
  name: string
): Promise<DivisionOption | null> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Division name is required");

  const [row] = await db
    .update(divisions)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(divisions.id, id))
    .returning();

  return row ? toOption(row) : null;
}

export async function deleteDivision(id: string): Promise<boolean> {
  const deleted = await db
    .delete(divisions)
    .where(eq(divisions.id, id))
    .returning({ id: divisions.id });
  return deleted.length > 0;
}
