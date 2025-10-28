// Unified Teams Page - Adapts based on user role
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import EditableLeagueAssignment from "../(superadmin)/superadmin/teams/editableLeagueAssignment";

/* ---------------- helpers ---------------- */

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
  if (typeof raw === "string") {
    try { return JSON.parse(raw) as T; } catch { return null; }
  }
  if (typeof raw === "object") return raw as T;
  return null;
}

const CANONICAL_SPORTS  = ["basketball","volleyball"] as const;
const CANONICAL_GENDERS = ["mens","womens","coed"] as const;
const CANONICAL_DIVISIONS = ["low_b","high_b","a"] as const;

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const norm  = (v: unknown) => String(v ?? "").trim().toLowerCase();

function normalizeSport(v: unknown) {
  const s = norm(v).replace(/\s+/g, "");
  if (!s) return null;
  if (/(basket|bball)/.test(s)) return "basketball";
  if (/(volley|vball)/.test(s)) return "volleyball";
  return s;
}

function normalizeGender(v: unknown) {
  const s = norm(v).replace(/\s+/g, "");
  if (!s) return null;
  if (/^(men|mens|male|m)$/.test(s)) return "mens";
  if (/^(women|womens|female|w|f)$/.test(s)) return "womens";
  if (/^(co[-\s]?ed|mixed|all)$/.test(s)) return "coed";
  return s;
}

function normalizeDivision(v: unknown) {
  let s = norm(v).replace(/\s+/g, "_").replace(/-/g, "_");
  if (!s) return null;
  if (s === "low_b" || s === "lowb" || s === "b_low") s = "low_b";
  if (s === "high_b" || s === "highb" || s === "b_high") s = "high_b";
  if (s === "a_division" || s === "div_a") s = "a";
  return s;
}

type League = { leagueId: string; name: string };
type TeamRow = {
  teamId: string;
  name: string;
  approved: boolean;
  leagueId?: string | null;
  sport?: string | null;
  gender?: string | null;
  division?: string | null;
  leagueName?: string | null;
};

/* ---------------- Page Component ---------------- */

export default async function TeamsPage({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await getServerUser();
  if (!user) redirect("/login");

  // Superadmin: Show all teams with management features
  if (user.superadmin) {
    const teamIds = await smembers("teams:index");

    const allTeams: TeamRow[] = (await Promise.all(
      teamIds.map(async (id) => {
        const t = await readDoc<Record<string, any>>(`team:${id}`);
        if (!t) {
          return { teamId: id, name: id, approved: false, leagueId: null } as TeamRow;
        }
        return {
          teamId: id,
          name: String(t.name ?? id).trim(),
          approved: Boolean(t.approved),
          leagueId: t.leagueId ?? null,
          sport: normalizeSport(t.sport),
          gender: normalizeGender(t.gender),
          division: normalizeDivision(t.estimatedDivision ?? t.division),
        } as TeamRow;
      })
    )).filter(Boolean) as TeamRow[];

    // Build league list
    const indexIds = await smembers("leagues:index");
    const teamLeagueIds = Array.from(new Set(allTeams.map(t => t.leagueId).filter(Boolean))) as string[];
    const allLeagueIds = Array.from(new Set([...indexIds, ...teamLeagueIds]));

    const leagueDocs = await Promise.all(
      allLeagueIds.map(async (id) => {
        const L = await readDoc<Record<string, any>>(`league:${id}`);
        if (!L) return null;
        return { leagueId: id, name: String(L.name ?? id) };
      })
    );
    const leagues: League[] = (leagueDocs.filter(Boolean) as League[])
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    const leagueNameById = new Map(leagues.map(l => [l.leagueId, l.name]));

    const rowsWithNames: TeamRow[] = allTeams.map(t => ({
      ...t,
      leagueName: t.leagueId ? (leagueNameById.get(t.leagueId) ?? null) : null,
    }));

    // Parse filters
    const q = norm(searchParams.q ?? "");
    const approvedFilter = String(searchParams.approved ?? "all");
    const leagueFilter = String(searchParams.league ?? "");
    const onlyUnassigned = String(searchParams.unassigned ?? "") === "1";
    const sportFilter = normalizeSport(searchParams.sport ?? "");
    const genderFilter = normalizeGender(searchParams.gender ?? "");
    const divisionFilter = normalizeDivision(searchParams.division ?? "");

    // Apply filters
    const rows = rowsWithNames
      .filter(t => {
        if (q && !t.name.toLowerCase().includes(q)) return false;
        if (approvedFilter === "yes" && !t.approved) return false;
        if (approvedFilter === "no" && t.approved) return false;
        if (onlyUnassigned && t.leagueId) return false;
        if (leagueFilter && t.leagueId !== leagueFilter) return false;
        if (sportFilter && t.sport !== sportFilter) return false;
        if (genderFilter && t.gender !== genderFilter) return false;
        if (divisionFilter && t.division !== divisionFilter) return false;
        return true;
      })
      .sort((a, b) =>
        (a.name || a.teamId).localeCompare(b.name || b.teamId, undefined, { sensitivity: "base" })
      );

    const CONTROL: React.CSSProperties = { minWidth: 160 };
    const hasFilters =
      (q && q.trim().length > 0) ||
      !!sportFilter ||
      !!genderFilter ||
      !!divisionFilter ||
      !!leagueFilter ||
      (approvedFilter && approvedFilter !== "all") ||
      !!onlyUnassigned;

    return (
      <main style={{ display: "grid", gap: 16 }}>
        <h1 className="page-title" style={{ marginBottom: 0 }}>Teams</h1>

        {/* Download CSV */}
        <div style={{ display: "flex", justifyContent: "end" }}>
          <a className="btn btn--outline" href="/export/teams.csv">
            Download CSV
          </a>
        </div>

        {/* Filters */}
        <form method="GET" className="card--soft">
          <input
            name="q"
            placeholder="Search by team name…"
            defaultValue={q}
            className="input"
            style={{ marginBottom: 12, minWidth: 160 }}
          />
          <div className="teams-filters-grid">
            <select name="sport" defaultValue={sportFilter ?? ""} className="input" style={CONTROL}>
              <option value="">All sports</option>
              {CANONICAL_SPORTS.map((s) => (
                <option key={s} value={s}>{title(s)}</option>
              ))}
            </select>

            <select name="gender" defaultValue={genderFilter ?? ""} className="input" style={CONTROL}>
              <option value="">All genders</option>
              {CANONICAL_GENDERS.map((g) => (
                <option key={g} value={g}>{title(g)}</option>
              ))}
            </select>

            <select name="division" defaultValue={divisionFilter ?? ""} className="input" style={CONTROL}>
              <option value="">All divisions</option>
              {CANONICAL_DIVISIONS.map((d) => (
                <option key={d} value={d}>{title(d)}</option>
              ))}
            </select>

            <select name="league" defaultValue={leagueFilter ?? ""} className="input" style={CONTROL}>
              <option value="">Any league</option>
              {leagues.map((l) => (
                <option key={l.leagueId} value={l.leagueId}>{title(l.name)}</option>
              ))}
            </select>

            <select name="approved" defaultValue={approvedFilter ?? ""} className="input" style={CONTROL}>
              <option value="all">All statuses</option>
              <option value="yes">Approved</option>
              <option value="no">Unapproved</option>
            </select>

            <label className="input" style={{ display: "inline-flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", cursor: "pointer", ...CONTROL }} title="Show only teams with no league assigned">
              <input type="checkbox" name="unassigned" value="1" defaultChecked={onlyUnassigned}/>
              <span className="form-label">Unassigned only</span>
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
            <div className="subtle-text">{rows.length} results</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {hasFilters && (
                <a href="/teams" className="btn btn--light">Reset</a>
              )}
              <button className="btn btn--outline" type="submit">Apply</button>
            </div>
          </div>
        </form>

        {/* Results list */}
        <div>
          {rows.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No teams found.</p>
          ) : (
            <div>
              {rows.map((t, idx) => {
                return (
                  <div key={t.teamId} className="teams-card-layout" style={{
                    padding: "12px 8px",
                    borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
                  }}>
                    {/* Top row: Team name and badge inline */}
                    <div style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      gap: "12px"
                    }}>
                      <span
                        style={{
                          fontFamily: "var(--font-body)",
                          fontWeight: 500,
                          letterSpacing: ".3px",
                          fontSize: 20,
                          lineHeight: 1.2,
                          color: "var(--navy)",
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {t.name}
                      </span>
                      
                      {/* Badge inline with team name */}
                      <span className={`badge ${t.approved ? "badge--ok" : "badge--pending"}`} style={{
                        fontSize: "12px",
                        padding: "4px 8px",
                        fontWeight: 700,
                        lineHeight: 1.2,
                        flexShrink: 0,
                      }}>
                        {t.approved ? "APPROVED" : "PENDING"}
                      </span>
                    </div>

                    <div className="teams-card-league">
                      <EditableLeagueAssignment teamId={t.teamId} current={t.leagueId ?? undefined} leagues={leagues} />
                    </div>

                    {/* Bottom row: View link aligned right */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "flex-end" 
                    }}>
                      <Link href={`/team/${t.teamId}`} className="card-cta">VIEW TEAM →</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Player: Redirect to home which has "My Teams" section
  redirect("/#teams");
}
