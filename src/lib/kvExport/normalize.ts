import type { Division, Gender, Sport } from "@/db/schema";

const GENDER_MAP: Record<string, Gender> = {
  mens: "mens",
  men: "mens",
  male: "mens",
  m: "mens",
  womens: "womens",
  women: "womens",
  female: "womens",
  w: "womens",
  coed: "coed",
  mixed: "coed",
};

const SPORT_MAP: Record<string, Sport> = {
  basketball: "basketball",
  bb: "basketball",
  bball: "basketball",
  volleyball: "volleyball",
  vb: "volleyball",
};

const DIVISION_MAP: Record<string, Division> = {
  low_b: "low_b",
  lowb: "low_b",
  "low b": "low_b",
  "low-b": "low_b",
  b: "low_b",
  high_b: "high_b",
  highb: "high_b",
  "high b": "high_b",
  "high-b": "high_b",
  a: "a",
  "a division": "a",
};

function normKey(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function normalizeGender(raw: unknown): Gender | null {
  const key = normKey(raw);
  if (!key) return null;
  return GENDER_MAP[key] ?? null;
}

export function normalizeSport(raw: unknown): Sport | null {
  const key = normKey(raw);
  if (!key) return null;
  return SPORT_MAP[key] ?? null;
}

export function normalizeDivision(raw: unknown): Division | null {
  const key = normKey(raw);
  if (!key) return null;
  return DIVISION_MAP[key] ?? null;
}

export function normalizeGameStatus(
  raw: unknown,
  hasScores: boolean
): "scheduled" | "final" | "canceled" {
  const s = String(raw ?? "").toLowerCase();
  if (/cancel/.test(s)) return "canceled";
  if (/final/.test(s) || hasScores) return "final";
  return "scheduled";
}

/** Legacy KV league id becomes the Postgres slug (URL-safe). */
export function leagueSlugFromLegacyId(legacyId: string): string {
  const slug = legacyId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "league";
}

export function parseIsoTimestamp(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (typeof raw === "number") {
    const d = new Date(raw);
    return Number.isFinite(d.getTime()) ? d.toISOString() : null;
  }
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function parseIntOrNull(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function truthy(raw: unknown): boolean {
  return raw === true || raw === "true" || raw === 1 || raw === "1";
}

export function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.map(String).filter(Boolean)));
}
