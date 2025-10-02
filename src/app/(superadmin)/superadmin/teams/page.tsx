// /src/app/(superadmin)/superadmin/teams/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { kv } from "@vercel/kv";
import { getServerUser } from "@/lib/serverUser";
import EditableLeagueAssignment from "./editableLeagueAssignment";
import { DIVISIONS } from "@/lib/divisions";

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

/* ---------- canonical enums (union with discovered values) ---------- */
const CANONICAL_SPORTS  = ["basketball","volleyball"] as const;
const CANONICAL_GENDERS = ["mens","womens","coed"] as const;
const CANONICAL_DIVISIONS = ["low_b","high_b","a"] as const;

const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const norm  = (v: unknown) => String(v ?? "").trim().toLowerCase();

/* ---------- tolerant field normalizers ---------- */
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

/* ---------- types ---------- */
type League = { leagueId: string; name: string };
type TeamRow = {
  teamId: string;
  name: string;
  approved: boolean;
  leagueId?: string | null;
  sport?: string | null;
  gender?: string | null;
  division?: string | null; // will carry estimatedDivision if present
  leagueName?: string | null;
};

export default async function SuperAdminTeamsPage({
  searchParams,
}: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) redirect("/");

  /* ---------- 1) team ids ---------- */
  const teamIds = await smembers("teams:index");

  /* ---------- 2) build teams (normalized once) ---------- */
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

  /* ---------- 3) build league list from UNION(index, teams) ---------- */
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

  /* ---------- 4) derive leagueName for rows ---------- */
  const rowsWithNames: TeamRow[] = allTeams.map(t => ({
    ...t,
    leagueName: t.leagueId ? (leagueNameById.get(t.leagueId) ?? null) : null,
  }));

  /* ---------- 5) parse + normalize filters ---------- */
  const q = norm(searchParams.q ?? "");
  const approvedFilter = String(searchParams.approved ?? "all");
  const leagueFilter = String(searchParams.league ?? "");
  const onlyUnassigned = String(searchParams.unassigned ?? "") === "1";

  const sportFilter = normalizeSport(searchParams.sport ?? "");
  const genderFilter = normalizeGender(searchParams.gender ?? "");
  const divisionFilter = normalizeDivision(searchParams.division ?? "");

  /* ---------- 6) apply filters ---------- */
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

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title">Teams</h1>

      {/* Filters */}
      <form method="GET" className="card--soft">
        {/*
          Shared control styling — subtle radius, consistent height/padding, light border.
          (These are inline so you don't need to touch global CSS.)
        */}
        {(() => {
          const CONTROL: React.CSSProperties = {
            minWidth: 160,
          };

          const hasFilters =
            (q && q.trim().length > 0) ||
            !!sportFilter ||
            !!genderFilter ||
            !!divisionFilter ||
            !!leagueFilter ||
            (approvedFilter && approvedFilter !== "all") ||
            !!onlyUnassigned;

          return (
            <>
              {/* Single-row search + filters */}

              <input
                  name="q"
                  placeholder="Search by team name…"
                  defaultValue={q}
                  className="input"
                  style={{ marginBottom: 12, ...CONTROL }}
                />
              <div
                style={{
                  display: "grid",
                  // Search grows, others stay tidy; last cell holds the checkbox
                  gridTemplateColumns:
                    "160px 160px 160px 160px 160px max-content",
                  gap: 8,
                  alignItems: "center",
                }}
              >

                <select name="sport" defaultValue={sportFilter ?? ""} className="input" style={CONTROL}>
                  <option value="">All sports</option>
                  {CANONICAL_SPORTS.map((s) => (
                    <option key={s} value={s}>
                      {title(s)}
                    </option>
                  ))}
                </select>

                <select name="gender" defaultValue={genderFilter ?? ""} className="input" style={CONTROL}>
                  <option value="">All genders</option>
                  {CANONICAL_GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {title(g)}
                    </option>
                  ))}
                </select>

                <select name="division" defaultValue={divisionFilter ?? ""} className="input" style={CONTROL}>
                  <option value="">All divisions</option>
                  {CANONICAL_DIVISIONS.map((d) => (
                    <option key={d} value={d}>
                      {title(d)}
                    </option>
                  ))}
                </select>

                <select name="league" defaultValue={leagueFilter ?? ""} className="input" style={CONTROL}>
                  <option value="">Any league</option>
                  {leagues.map((l) => (
                    <option key={l.leagueId} value={l.leagueId}>
                      {title(l.name)}
                    </option>
                  ))}
                </select>

                <select name="approved" defaultValue={approvedFilter ?? ""} className="input" style={CONTROL}>
                  <option value="all">All statuses</option>
                  <option value="yes">Approved</option>
                  <option value="no">Unapproved</option>
                </select>

                <label
                  className="input"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    ...CONTROL
                  }}
                  title="Show only teams with no league assigned"
                >
                  <input type="checkbox" name="unassigned" value="1" defaultChecked={onlyUnassigned}/>
                  <span className="form-label">Unassigned only</span>
                </label>
              </div>

              {/* Footer row: count + Reset/Apply */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: 12,
                }}
              >
                <div className="subtle-text">{rows.length} results</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {hasFilters && (
                    <a href="/superadmin/teams" className="btn btn--light">
                      Reset
                    </a>
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

      {/* Results list (4 columns, single row) */}
      <div className="roster-gradient">
        {rows.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No teams found.</p>
        ) : (
          <ul className="roster-list">
            {rows.map((t) => {
              return (
                <li key={t.teamId}>
                  <div
                    className="player-card"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "minmax(220px,1fr) 120px minmax(220px, 1fr) max-content",
                      columnGap: 32,
                      alignItems: "center",
                    }}
                  >
                    {/* 1) Team name */}
                    <div
                      className="item-name"
                      title={t.name}
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
                      {t.name}
                    </div>

                    {/* 2) Status */}
                    <span
                      className={`badge ${t.approved ? "badge--ok" : "badge--pending"}`}
                      style={{ whiteSpace: "nowrap", justifySelf: "center", marginLeft: "-90px" }}
                    >
                      {t.approved ? "APPROVED" : "PENDING"}
                    </span>

                    {/* 3) Assign control */}
                    <div className="col-league" style={{ minWidth: 180, maxWidth: 450, justifySelf: "start" }}>
                      <EditableLeagueAssignment
                        teamId={t.teamId}
                        current={t.leagueId ?? undefined}  // value is id
                        leagues={leagues}                  // options contain {leagueId, name}
                      />
                    </div>

                    {/* 4) View link */}
                    <div className="col-view" style={{ justifySelf: "end", marginRight: 0 }}>
                      <Link href={`/superadmin/team/${t.teamId}`} className="card-cta">
                        VIEW TEAM →
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