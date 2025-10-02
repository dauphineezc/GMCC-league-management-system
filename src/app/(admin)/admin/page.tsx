// /src/app/admin/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { DIVISIONS } from "@/lib/divisions";
import AdminLeagueCard from "@/components/adminLeagueSummaryCard";
import PublicLeagueTabsServer from "@/components/publicLeagueTabs.server";
import { getServerUser } from "@/lib/serverUser";
import Link from "next/link";

/* ---------- tiny helpers ---------- */
async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers<string[]>(key)) ?? [];
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function readLeagueName(leagueId: string): Promise<string> {
  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, unknown> | null;
    if (h && typeof h === "object" && "name" in h && h.name) return String(h.name);
  } catch {}
  const g = (await kv.get(`league:${leagueId}`)) as any;
  if (g && typeof g === "object" && g?.name) return String(g.name);
  return DIVISIONS.find(d => d.id === leagueId)?.name ?? leagueId;
}

/* ---------- Teams for a league (SET only) ---------- */
type TeamCard = { teamId: string; name: string; approved?: boolean };

async function getMergedTeams(leagueId: string): Promise<TeamCard[]> {
  // Read the SET of teamIds
  const teamIds = await smembersSafe(`league:${leagueId}:teams`);

  // Hydrate team docs
  const rows = await Promise.all(
    teamIds.map(async (id) => {
      const t = (await kv.get<Record<string, any>>(`team:${id}`)) || null;
      return {
        teamId: id,
        name: t?.name ?? id,
        approved: Boolean(t?.approved),
      } as TeamCard;
    })
  );

  rows.sort((a, b) =>
    (a.name || a.teamId).localeCompare(b.name || b.teamId, undefined, { sensitivity: "base" })
  );
  return rows;
}

/* ------------------------- page ------------------------- */
export default async function AdminHome() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (user.superadmin) redirect("/superadmin");

  const adminKey = `admin:${user.id}:leagues`;

  // 1) Start with the normalized UID set
  let managed = await smembersSafe(adminKey);

  // 2) Legacy email set → copy forward if needed
  if (!managed.length && user.email) {
    const legacy = await smembersSafe(`admin:${user.email}:leagues`);
    if (legacy.length) {
      await kv.sadd(adminKey, ...legacy);
      managed = legacy;
    }
  }

  // 3) Inferred from leagues:index where the league doc has adminUserId/ownerUserId/managerUserId === uid
  const idx = await smembersSafe("leagues:index");
  const inferred: string[] = [];
  await Promise.all(
    idx.map(async (id) => {
      let L: Record<string, any> | null = null;
      try {
        const h = (await kv.hgetall(`league:${id}`)) as Record<string, any> | null;
        if (h && typeof h === "object" && Object.keys(h).length) L = h;
      } catch {}
      if (!L) {
        const g = (await kv.get(`league:${id}`)) as any;
        if (g && typeof g === "object") L = g;
      }
      const adminUserId = L ? (L.adminUserId ?? L.ownerUserId ?? L.managerUserId ?? null) : null;
      if (adminUserId && String(adminUserId) === user.id) inferred.push(id);
    })
  );

  // 4) Claims
  const claims = Array.isArray(user.leagueAdminOf) ? user.leagueAdminOf : [];

  // Merge & dedupe everything
  managed = Array.from(new Set([...managed, ...inferred, ...claims])).filter(Boolean);

  // 5) Normalize back to a set
  await kv.del(adminKey);
  if (managed.length) await kv.sadd(adminKey, ...managed);

  // Build league cards
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

  const leagueCards = (await Promise.all(
    managed.map(async (leagueId) => {
      const leagueName = await readLeagueName(leagueId);
      const teams = await getMergedTeams(leagueId);
      return { leagueId, leagueName, teams };
    })
  )).sort((a, b) => {
    // primary: by leagueName; tiebreaker: by id for stability
    const byName = collator.compare(a.leagueName || a.leagueId, b.leagueName || b.leagueId);
    return byName !== 0 ? byName : collator.compare(a.leagueId, b.leagueId);
  });

  return (
    <main style={{ padding: 20, display: "grid", gap: 20 }}>
      <section>
        <h1 className="page-title">Welcome</h1>
        <p>You’re signed in as <code>{user.email ?? user.id}</code>.</p>
        <Link className="btn btn--outline" href="/logout">Sign out</Link>
      </section>

      <section id="leagues">
        <h2 className="section-title">My Leagues</h2>
        <div
          className="cards-grid-fixed"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(320px, 1fr))",
            gap: 20,
            alignItems: "start",
          }}
        >
          {leagueCards.length ? (
            leagueCards.map((lg) => (
              <div className="card-scale-90" key={lg.leagueId}>
                <AdminLeagueCard
                  leagueId={lg.leagueId}
                  leagueName={lg.leagueName}
                  teams={lg.teams}
                />
              </div>
            ))
          ) : (
            <p className="muted">No managed leagues yet.</p>
          )}
        </div>
      </section>

      <section id="public-leagues">
        <h2 className="section-title">Leagues</h2>
        <PublicLeagueTabsServer defaultTab="basketball" />
      </section>
    </main>
  );
}