// Leagues List Page (Superadmin Only)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import { DIVISIONS } from "@/lib/divisions";
import { getAdminDisplayName } from "@/lib/adminUserLookup";
import CreateLeagueClient from "../(superadmin)/superadmin/leagues/createLeagueClient";
import { createLeagueAction } from "../(superadmin)/superadmin/leagues/createLeagueAction";
import Collapsible from "@/components/collapsible";


/* ---------- tolerant helpers ---------- */
async function smembers(key: string): Promise<string[]> {
  const v = (await kv.smembers(key)) as unknown;
  return Array.isArray(v) ? (v as string[]) : [];
}
async function readDoc<T extends Record<string, any>>(key: string): Promise<T | null> {
  // try hash first
  try {
    const h = (await kv.hgetall(key)) as unknown;
    if (h && typeof h === "object" && Object.keys(h as object).length) return h as T;
  } catch {}
  // then fall back to get()
  const raw = (await kv.get(key)) as unknown;
  if (!raw) return null;
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  if (typeof raw === "object") return raw as T;
  return null;
}

const title = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const norm  = (v: unknown) => String(v ?? "").trim().toLowerCase();

/* ---------- canonical enums (union with discovered values) ---------- */
const CANONICAL_SPORTS    = ["basketball","volleyball"] as const;
const CANONICAL_GENDERS   = ["mens","womens","coed"] as const;
const CANONICAL_DIVISIONS = ["low_b","high_b","a"] as const;

/* ---------- types ---------- */
type LeagueRow = {
  leagueId: string;
  name: string;
  approved: boolean;
  sport?: string | null;
  gender?: string | null;
  division?: string | null;
  adminUserId?: string | null;
  adminName?: string | null; // computed only for UI
};

/* ---------- safe member normalization (guards against bad set entries) ---------- */
function explodeIds(v: unknown): string[] {
  if (v == null) return [];

  if (Array.isArray(v)) return v.flatMap(explodeIds);

  const t = String(v).trim();
  if (!t) return [];

  try {
    if (t.startsWith("[") && t.endsWith("]")) {
      const arr = JSON.parse(t);
      if (Array.isArray(arr)) return arr.flatMap(explodeIds);
    }
  } catch {
    // ignore
  }

  if (t.includes(",")) {
    return t
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [t];
}

export default async function LeaguesListPage({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) notFound(); // Only superadmins can access

  // 1) load leagueIds from the index
  const rawSetMembers = await smembers("leagues:index");
  const leagueIds = Array.from(new Set(rawSetMembers.flatMap(explodeIds))).filter(Boolean);

  // 2) build rows
  const allLeagues: LeagueRow[] = (await Promise.all(
    leagueIds.map(async (id) => {
      const t = await readDoc<Record<string, any>>(`league:${id}`);
      if (!t) {
        return {
          leagueId: id,
          name: id,
          approved: false,
          sport: null,
          gender: null,
          division: null,
          adminUserId: null,
          adminName: null,
        } as LeagueRow;
      }

      const adminUserId = t.adminUserId ?? t.managerUserId ?? t.ownerUserId ?? null;
      const adminName = await getAdminDisplayName(adminUserId);

      return {
        leagueId: id,
        name: String(t.name ?? id),
        approved: Boolean(t.approved),
        sport: t.sport ?? null,
        gender: t.gender ?? null,
        division: t.estimatedDivision ?? t.division ?? null,
        adminUserId,
        adminName: adminName ?? null,
      } as LeagueRow;
    })
  )) as LeagueRow[];

  // 3) filter option lists: union canonical enums with discovered values
  const sports = Array.from(
    new Set([
      ...allLeagues.map((l) => norm(l.sport)).filter(Boolean),
      ...CANONICAL_SPORTS,
    ])
  ).sort((a, b) => a.localeCompare(b));

  const genders = Array.from(
    new Set([
      ...allLeagues.map((l) => norm(l.gender)).filter(Boolean),
      ...CANONICAL_GENDERS,
    ])
  ).sort((a, b) => a.localeCompare(b));

  const divisions = Array.from(
    new Set([
      ...allLeagues.map((l) => norm(l.division)).filter(Boolean),
      ...CANONICAL_DIVISIONS,
    ])
  ).sort((a, b) => a.localeCompare(b));

  // 4) parse filters (league page doesn't need "league" or "unassigned")
  const q              = String(searchParams.q ?? "").toLowerCase().trim();
  const sportFilter    = String(searchParams.sport ?? "");
  const genderFilter   = String(searchParams.gender ?? "");
  const divisionFilter = String(searchParams.division ?? "");

  // 5) apply filters
  const rows = allLeagues.filter((l) => {
    if (q && !l.name.toLowerCase().includes(q)) return false;
    if (sportFilter && norm(l.sport) !== sportFilter) return false;
    if (genderFilter && norm(l.gender) !== genderFilter) return false;
    if (divisionFilter && norm(l.division) !== divisionFilter) return false;
    return true;
  });

  rows.sort((a, b) =>
    (a.name || a.leagueId).localeCompare(b.name || b.leagueId, undefined, { sensitivity: "base" })
  );

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Leagues</h1>
        {/* optional: quick-create (if your createLeague action returns a Link or similar) */}
        {/* <form action={createLeague}><button className="btn btn--primary">New League</button></form> */}
      </div>

      {/* Download CSV */}
      <div style={{ display: "flex", justifyContent: "end" }}>
        <a className="btn btn--outline" href="/export/leagues.csv">
          Download CSV
        </a>
      </div>

      <Collapsible title="Create a new league">
        <CreateLeagueClient />
      </Collapsible>

      {/* Filters */}
      <form method="GET" className="card--soft">
        {(() => {
          const CONTROL: React.CSSProperties = {
            minWidth: 160,
          };

          const hasFilters =
            (q && q.trim().length > 0) ||
            !!sportFilter ||
            !!genderFilter ||
            !!divisionFilter;

          return (
            <>
              <input
                name="q"
                placeholder="Search by league name…"
                defaultValue={q}
                className="input"
                style={{ marginBottom: 12, minWidth: 160 }}
              />

              <div
                className="leagues-filters-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                  gap: 8,
                  alignItems: "center",
                }}
              >
                <select name="sport" defaultValue={sportFilter} className="input" style={CONTROL}>
                  <option value="">All sports</option>
                  {sports.map((s) => (
                    <option key={s} value={s}>
                      {title(s)}
                    </option>
                  ))}
                </select>

                <select name="gender" defaultValue={genderFilter} className="input" style={CONTROL}>
                  <option value="">All genders</option>
                  {genders.map((g) => (
                    <option key={g} value={g}>
                      {title(g)}
                    </option>
                  ))}
                </select>

                <select name="division" defaultValue={divisionFilter} className="input" style={CONTROL}>
                  <option value="">All divisions</option>
                  {divisions.map((d) => (
                    <option key={d} value={d}>
                      {title(d)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Results and buttons row */}
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                marginTop: 12 
              }}>
                <div className="subtle-text">{rows.length} results</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {hasFilters && (
                    <Link href="/leagues" className="btn btn--light">
                      Reset
                    </Link>
                  )}
                  <button className="btn btn--outline" type="submit">
                    Apply
                  </button>
                </div>
              </div>
            </>
          );
        })()}
      </form>

      {/* Results list */}
      <div className="roster-gradient">
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No leagues found.</p>
        ) : (
          <ul className="roster-list">
            {rows.map((l) => {
              return (
                <li key={l.leagueId}>
                  {/* Desktop Layout */}
                  <div
                    className="player-card league-card-desktop"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px,1fr) minmax(220px,1fr) minmax(220px,1fr) max-content",
                      alignItems: "center",
                      columnGap: 40,
                    }}
                  >
                    {/* 1) League name */}
                    <div
                      className="item-name"
                      title={l.name}
                      style={{
                        fontWeight: 500,
                        fontSize: 24,
                        lineHeight: 1.1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingLeft: 15,
                      }}
                    >
                      {l.name}
                    </div>

                    {/* 2) Sport */}
                    <div
                      className="body-text"
                      title={l.sport ?? ""}
                      style={{
                        justifySelf: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--navy)",
                        textTransform: "uppercase",
                      }}
                    >
                      {l.sport ?? "—"}
                    </div>

                    {/* 3) Managing admin name */}
                    <div
                      className="body-text"
                      title={l.adminName ?? ""}
                      style={{
                        justifySelf: "center",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--navy)",
                        textTransform: "uppercase",
                      }}
                    >
                      {l.adminName ?? "Unassigned"}
                    </div>

                    {/* 4) View link */}
                    <div className="col-view" style={{ justifySelf: "end", marginRight: 0, justifyContent: "flex-end" }}>
                      <Link href={`/leagues/${l.leagueId}`} className="card-cta">
                        VIEW LEAGUE →
                      </Link>
                    </div>
                  </div>

                  {/* Mobile Layout */}
                  <div
                    className="player-card league-card-mobile"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                      padding: "12px 16px",
                    }}
                  >
                    {/* Line 1: League name */}
                    <div
                      className="item-name"
                      title={l.name}
                      style={{
                        fontWeight: 500,
                        fontSize: 24,
                        lineHeight: 1.1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        paddingLeft: 0,
                        marginBottom: "0px",
                      }}
                    >
                      {l.name}
                    </div>

                    {/* Line 2: Sport and Admin on same line */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "60px",
                        fontSize: 16,
                        fontWeight: 600,
                        color: "var(--navy)",
                        textTransform: "uppercase",
                        marginBottom: "0px",
                      }}
                    >
                      <span title={l.sport ?? ""}>
                        {l.sport ?? "—"}
                      </span>
                      <span title={l.adminName ?? ""}>
                        {l.adminName ?? "Unassigned"}
                      </span>
                    </div>

                    {/* Line 3: View link */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "flex-end",
                      width: "100%"
                    }}>
                      <Link href={`/leagues/${l.leagueId}`} className="card-cta">
                        VIEW LEAGUE →
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}