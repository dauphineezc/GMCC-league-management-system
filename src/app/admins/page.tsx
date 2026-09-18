// Admins Page (Superadmin Only)
export const revalidate = 30;

import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import { buildAdminRosterLikeRows } from "@/lib/rosterAggregate";
import SuperAdminsList from "@/components/superAdminList";
import type { CSSProperties } from "react";
import { exportHref } from "@/lib/csv";
import { smembersSafe, readDoc } from "@/lib/kvHelpers";

const CANONICAL_SPORTS = ["basketball", "volleyball"] as const;
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

function normalizeSport(v: unknown) {
  const s = norm(v).replace(/\s+/g, "");
  if (!s) return null;
  if (/(basket|bball)/.test(s)) return "basketball";
  if (/(volley|vball)/.test(s)) return "volleyball";
  return s;
}

type LeagueOption = { leagueId: string; name: string; sport: string | null };

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: { displayName?: string; sport?: string; league?: string };
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) notFound();

  const [{ roster, playerTeamsByUser }, leagueIds] = await Promise.all([
    buildAdminRosterLikeRows(),
    smembersSafe("leagues:index"),
  ]);

  const leagues: LeagueOption[] = (
    await Promise.all(
      leagueIds.map(async (id) => {
        const L = await readDoc<Record<string, any>>(`league:${id}`);
        return {
          leagueId: id,
          name: String(L?.name ?? id),
          sport: normalizeSport(L?.sport),
        } as LeagueOption;
      })
    )
  ).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  const leagueSportById = new Map(leagues.map((l) => [l.leagueId, l.sport]));

  const q = (searchParams.displayName ?? "").trim().toLowerCase();
  const sportFilter = normalizeSport(searchParams.sport ?? "");
  const leagueFilter = String(searchParams.league ?? "");

  const filteredRows = roster.filter((r) => {
    if (q && !r.displayName.toLowerCase().includes(q)) return false;

    const memberships = playerTeamsByUser[r.userId] ?? [];
    const managesAll = memberships.some((m) => m.leagueId === "all");

    if (leagueFilter) {
      const matchesLeague =
        managesAll || memberships.some((m) => m.leagueId === leagueFilter);
      if (!matchesLeague) return false;
    }

    if (sportFilter) {
      const matchesSport =
        managesAll ||
        memberships.some((m) => {
          if (!m.leagueId || m.leagueId === "org") return false;
          return leagueSportById.get(m.leagueId) === sportFilter;
        });
      if (!matchesSport) return false;
    }

    return true;
  });

  const uniqByUser = Array.from(
    new Map(filteredRows.map((r) => [r.userId, r])).values()
  );

  const CONTROL: CSSProperties = { minWidth: 160 };
  const hasFilters = Boolean(q) || !!sportFilter || !!leagueFilter;
  const resultCount = uniqByUser.length;

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title" style={{ marginBottom: 0 }}>Admins</h1>

      <a
        className="btn btn--outline"
        href={exportHref("/export/admins.csv", {
          displayName: searchParams.displayName ?? "",
          sport: sportFilter ?? "",
          league: leagueFilter,
        })}
        style={{ justifySelf: "end" }}
      >
        Download CSV
      </a>

      <form method="GET" className="card--soft" style={{ display: "grid", gap: 8 }}>
        <input
          name="displayName"
          placeholder="Search by admin name…"
          defaultValue={searchParams.displayName ?? ""}
          className="input"
          style={{ minWidth: 160 }}
          aria-label="Search by admin name"
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 8,
            alignItems: "center",
          }}
        >
          <select
            name="sport"
            defaultValue={sportFilter ?? ""}
            className="input"
            style={CONTROL}
            aria-label="Filter by sport"
          >
            <option value="">All sports</option>
            {CANONICAL_SPORTS.map((s) => (
              <option key={s} value={s}>
                {title(s)}
              </option>
            ))}
          </select>

          <select
            name="league"
            defaultValue={leagueFilter}
            className="input"
            style={CONTROL}
            aria-label="Filter by league"
          >
            <option value="">Any league</option>
            {leagues.map((l) => (
              <option key={l.leagueId} value={l.leagueId}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <div className="subtle-text">
            {resultCount} {resultCount === 1 ? "result" : "results"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {hasFilters && (
              <a href="/admins" className="btn btn--light">
                Reset
              </a>
            )}
            <button className="btn btn--outline" type="submit">
              Apply
            </button>
          </div>
        </div>
      </form>

      <SuperAdminsList roster={uniqByUser} adminTeamsByUser={playerTeamsByUser} />
    </main>
  );
}
