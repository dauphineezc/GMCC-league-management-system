import { kv } from "@vercel/kv";

export type LeagueLite = { id: string; name: string; sport: string };

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

async function smembers(key: string): Promise<string[]> {
  const v = (await kv.smembers(key)) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
}
async function readDoc<T extends Record<string, any>>(key: string): Promise<T | null> {
  try {
    const h = (await kv.hgetall(key)) as unknown;
    if (h && typeof h === "object" && Object.keys(h as object).length) return h as T;
  } catch {}
  const raw = (await kv.get(key)) as unknown;
  if (!raw) return null;
  if (typeof raw === "string") { try { return JSON.parse(raw) as T; } catch {} }
  if (typeof raw === "object") return raw as T;
  return null;
}
function explodeMembers(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.flatMap(explodeMembers);
  const s = String(v).trim();
  if (!s) return [];
  try {
    if (s.startsWith("[") && s.endsWith("]")) {
      const arr = JSON.parse(s);
      if (Array.isArray(arr)) return arr.flatMap(explodeMembers);
    }
  } catch {}
  if (s.includes(",")) return s.split(",").map(x => x.trim()).filter(Boolean);
  return [s];
}
const truthy = (v: any) => v === true || v === "true" || v === 1 || v === "1";

/** Fetch light league rows from `leagues:index`. */
export async function getLeagues(
  opts: { onlyApproved?: boolean; sport?: "basketball" | "volleyball" } = {}
): Promise<LeagueLite[]> {
  const onlyApproved = opts.onlyApproved ?? true;
  const sportFilter = opts.sport ? norm(opts.sport) : "";

  const raw = await smembers("leagues:index");
  const ids = Array.from(new Set(raw.flatMap(explodeMembers))).filter(Boolean);

  const rows: LeagueLite[] = [];
  for (const id of ids) {
    const L = await readDoc<Record<string, any>>(`league:${id}`);
    if (!L) continue;
    const sport = norm(L.sport);
    if (!sport) continue;
    if (sportFilter && sport !== sportFilter) continue;
    if (onlyApproved && !truthy(L.approved)) continue;

    rows.push({ id, name: String(L.name ?? id), sport });
  }
  rows.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  return rows;
}