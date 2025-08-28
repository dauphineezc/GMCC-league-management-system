// Server Component — Demo seeder (idempotent)
import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Helper
const isoAt = (dOffsetDays: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dOffsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

// Helper
const ensure = async (key: string, fallback: any) => {
  const existing = await kv.get(key);
  if (existing === null || existing === undefined) await kv.set(key, fallback);
};


const LEAGUES = [
  { id: "4v4b", name: "4v4 low B",   description: "4v4 recreational (low B)."},
  { id: "4v4",  name: "4v4",         description: "4v4 open league."},
  { id: "4v4a", name: "4v4 high B/A",description: "Higher-level 4v4."},
  { id: "4v4w", name: "4v4 Women",   description: "4v4 recreational basketball league for women."},
  { id: "5v5",  name: "5v5",         description: "Full-court 5v5 league."},
] as const;
type DivisionId = typeof LEAGUES[number]["id"];
const leagueNameFor = (id: DivisionId) => LEAGUES.find(l => l.id === id)?.name ?? id;

export default function SeedPage() {
  async function seed() {
    "use server";
    const now = new Date().toISOString();

    // -----------------------------------------------------------------------
    // 1) Canonical leagues + indexes (idempotent overwrites)
    // -----------------------------------------------------------------------
    await kv.set("league:index", LEAGUES.map(({ id, name }) => ({ id, name })));
    for (const base of LEAGUES) {
      const prev = (await kv.get<any>(`league:${base.id}`)) || {};
      await kv.set(`league:${base.id}`, { ...prev, ...base, updatedAt: now, createdAt: prev.createdAt ?? now, });
      await ensure(`league:${base.id}:teams`, []);
      await ensure(`league:${base.id}:teamIds`, []);
      await ensure(`league:${base.id}:standings`, []);
      await ensure(`league:${base.id}:schedule`, []);
    }

    // Demo admin assignments:
    // - demo-admin manages only 5v5; others show read-only in /admin for demo-admin
    await kv.set(`admin:demo-admin:leagues`, ["5v5"]);
    // Example of multi-owner split (purely demo)
    await kv.set(`admin:owner-a:leagues`, ["4v4", "4v4a"]);
    await kv.set(`admin:owner-b:leagues`, ["4v4b", "4v4w"]);

    // -----------------------------------------------------------------------
    // 2) 5v5 teams, rosters, private dues
    // -----------------------------------------------------------------------
    type Team = {
      id: string; leagueId: DivisionId; name: string; description?: string;
      managerUserId: string; approved: boolean; rosterLimit: number;
      createdAt: string; updatedAt: string;
    };
    const mkTeam = (id: string, leagueId: DivisionId, name: string, mgr: string): Team => ({
      id, leagueId, name, description: `${name} description`,
      managerUserId: mgr, approved: false, rosterLimit: 8, createdAt: now, updatedAt: now,
    });

    const t1 = mkTeam("t-rockets", "5v5", "Rockets", "uid-a");
    const t2 = mkTeam("t-spurs",   "5v5", "Spurs",   "uid-b");
    const t3 = mkTeam("t-sonics",  "5v5", "Sonics",  "uid-c");

    for (const t of [t1, t2, t3]) await kv.set(`team:${t.id}`, t);

    await kv.set(`league:5v5:teams`, [
      { teamId: t1.id, name: t1.name, description: t1.description },
      { teamId: t2.id, name: t2.name, description: t2.description },
      { teamId: t3.id, name: t3.name, description: t3.description },
    ]);
    await kv.set(`league:5v5:teamIds`, [t1.id, t2.id, t3.id]);

    // Public roster + private dues stubs
    const rosterWithJoin = (entries: any[]) => entries.map(e => ({ ...e, joinedAt: now }));
    await kv.set(`team:${t1.id}:roster`, rosterWithJoin([
      { userId: "uid-a", displayName: "Aliyah S.", isManager: true  },
      { userId: "uid-d", displayName: "Devon K.",  isManager: false },
      { userId: "uid-e", displayName: "Emi T.",    isManager: false },
    ]));
    await kv.set(`team:${t2.id}:roster`, rosterWithJoin([
      { userId: "uid-b", displayName: "Beau M.",   isManager: true  },
      { userId: "uid-f", displayName: "Frank L.",  isManager: false },
    ]));
    await kv.set(`team:${t3.id}:roster`, rosterWithJoin([
      { userId: "uid-c", displayName: "Casey R.",  isManager: true  },
    ]));

    for (const uid of ["uid-a","uid-d","uid-e","uid-b","uid-f","uid-c"]) {
      await kv.set(`team:${t1.id}:roster:private:${uid}`, { paymentStatus: "UNPAID" });
      await kv.set(`team:${t2.id}:roster:private:${uid}`, { paymentStatus: "UNPAID" });
      await kv.set(`team:${t3.id}:roster:private:${uid}`, { paymentStatus: "UNPAID" });
    }
    // show some variety
    await kv.set(`team:${t1.id}:roster:private:uid-d`, { paymentStatus: "PAID" });
    await kv.set(`team:${t2.id}:roster:private:uid-b`, { paymentStatus: "PAID" });

    // -----------------------------------------------------------------------
    // 3) User memberships (denormalized names for fast "My Teams")
    // -----------------------------------------------------------------------
    type Membership = {
      leagueId: DivisionId; teamId: string; isManager: boolean;
      teamName?: string; leagueName?: string;
    };
    const m = (lid: DivisionId, tid: string, mgr: boolean, tname: string): Membership => ({
      leagueId: lid, teamId: tid, isManager: mgr, teamName: tname, leagueName: leagueNameFor(lid),
    });

    await kv.set(`user:uid-a:memberships`, [m("5v5", t1.id, true,  t1.name)]);
    await kv.set(`user:uid-b:memberships`, [m("5v5", t2.id, true,  t2.name)]);
    await kv.set(`user:uid-c:memberships`, [m("5v5", t3.id, true,  t3.name)]);
    await kv.set(`user:uid-d:memberships`, [m("5v5", t1.id, false, t1.name)]);
    await kv.set(`user:uid-e:memberships`, [m("5v5", t1.id, false, t1.name)]);
    await kv.set(`user:uid-f:memberships`, [m("5v5", t2.id, false, t2.name)]);

    // -----------------------------------------------------------------------
    // 4) Derived admin index for 5v5 (players table)
    // -----------------------------------------------------------------------
    const leaguePlayers = [
      { userId: "uid-a", displayName: "Aliyah S.", teamId: t1.id, teamName: t1.name, isManager: true,  paymentStatus: "UNPAID" },
      { userId: "uid-d", displayName: "Devon K.",  teamId: t1.id, teamName: t1.name, isManager: false, paymentStatus: "PAID"   },
      { userId: "uid-e", displayName: "Emi T.",    teamId: t1.id, teamName: t1.name, isManager: false, paymentStatus: "UNPAID" },
      { userId: "uid-b", displayName: "Beau M.",   teamId: t2.id, teamName: t2.name, isManager: true,  paymentStatus: "PAID"   },
      { userId: "uid-f", displayName: "Frank L.",  teamId: t2.id, teamName: t2.name, isManager: false, paymentStatus: "UNPAID" },
      { userId: "uid-c", displayName: "Casey R.",  teamId: t3.id, teamName: t3.name, isManager: true,  paymentStatus: "UNPAID" },
    ];
    await kv.set(`league:5v5:players`, leaguePlayers);

    // -----------------------------------------------------------------------
    // 5) 5v5 schedule + standings (sample)
    // -----------------------------------------------------------------------
    type Game = {
      id: string; leagueId: DivisionId; date: string; court?: string;
      homeTeamId: string; awayTeamId: string; homeName?: string; awayName?: string;
      status?: "SCHEDULED" | "FINAL" | "CANCELLED";
      score?: { home: number; away: number };
    };
    const nameOf = (id: string) => (id === t1.id ? t1.name : id === t2.id ? t2.name : id === t3.id ? t3.name : id);

    const g1: Game = {
      id: "g-5v5-001", leagueId: "5v5",
      date: isoAt(0, 18, 0), court: "Court A",
      homeTeamId: t1.id, awayTeamId: t2.id,
      homeName: nameOf(t1.id), awayName: nameOf(t2.id),
      status: "FINAL", score: { home: 72, away: 65 },
    };
    const g2: Game = {
      id: "g-5v5-002", leagueId: "5v5",
      date: isoAt(2, 19, 0), court: "Court A",
      homeTeamId: t2.id, awayTeamId: t3.id,
      homeName: nameOf(t2.id), awayName: nameOf(t3.id),
      status: "SCHEDULED",
    };
    const g3: Game = {
      id: "g-5v5-003", leagueId: "5v5",
      date: isoAt(7, 18, 0), court: "Court B",
      homeTeamId: t3.id, awayTeamId: t1.id,
      homeName: nameOf(t3.id), awayName: nameOf(t1.id),
      status: "SCHEDULED",
    };
    await kv.set(`league:5v5:schedule`, [g1, g2, g3]);

    type StandingRow = {
      teamId: string; name: string; wins: number; losses: number;
      pointsFor?: number; pointsAgainst?: number;
    };
    const standings: StandingRow[] = [
      { teamId: t1.id, name: t1.name, wins: 1, losses: 0, pointsFor: 72, pointsAgainst: 65 },
      { teamId: t2.id, name: t2.name, wins: 0, losses: 1, pointsFor: 65, pointsAgainst: 72 },
      { teamId: t3.id, name: t3.name, wins: 0, losses: 0, pointsFor: 0,  pointsAgainst: 0  },
    ];
    await kv.set(`league:5v5:standings`, standings);

    // Done
    revalidatePath("/admin");
    redirect("/admin?seeded=1");
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Seed Demo Data</h1>
      <p>This resets demo leagues, teams, rosters, memberships, and 5v5 schedule/standings.</p>
      <form action={seed}>
        <button style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8 }}>
          Seed Now
        </button>
      </form>
      <p style={{ marginTop: 12 }}>After seeding, you’ll be sent to <code>/admin</code>.</p>
    </div>
  );
}