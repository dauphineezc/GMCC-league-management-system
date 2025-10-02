// Server Component — Demo seeder (NON-DESTRUCTIVE)
// - Adds Panthers/Sharks/Bulls to 5v5
// - Updates league indexes
// - Backfills standings rows for new teams if missing
// - Does NOT overwrite existing schedule/games
import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

// Helpers
const ensure = async (key: string, fallback: any) => {
  const existing = await kv.get(key);
  if (existing === null || existing === undefined) await kv.set(key, fallback);
};
const parseArr = (raw: unknown): any[] => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try { return raw.trim() ? JSON.parse(raw) : []; } catch { return []; }
  }
  return [];
};

const LEAGUES = [
  { id: "4v4b", name: "4v4 low B",    description: "4v4 recreational (low B)." },
  { id: "4v4",  name: "4v4",          description: "4v4 open league." },
  { id: "4v4a", name: "4v4 high B/A", description: "Higher-level 4v4." },
  { id: "4v4w", name: "4v4 Women",    description: "4v4 recreational basketball league for women." },
  { id: "5v5",  name: "5v5",          description: "Full-court 5v5 league." },
] as const;
type DivisionId = typeof LEAGUES[number]["id"];

export default function SeedPage() {
  async function seed() {
    "use server";
    const now = new Date().toISOString();

    // -----------------------------------------------------------------------
    // 1) Leagues (non-destructive for schedule/standings/games)
    // -----------------------------------------------------------------------
    await kv.set("league:index", LEAGUES.map(({ id, name }) => ({ id, name })));
    for (const base of LEAGUES) {
      const prev = (await kv.get<any>(`league:${base.id}`)) || {};
      await kv.set(`league:${base.id}`, {
        ...prev, ...base,
        updatedAt: now,
        createdAt: prev.createdAt ?? now,
      });
      // teams is now a SET - no need to initialize empty sets
      await ensure(`league:${base.id}:standings`, []); // keep; we'll backfill, not reset
      await ensure(`league:${base.id}:schedule`, []);  // keep; DO NOT overwrite
      await ensure(`league:${base.id}:games`, []);     // keep; DO NOT overwrite
    }

    // Demo admin assignment (unchanged)
    await kv.set(`admin:demo-admin:leagues`, ["5v5"]);

    // -----------------------------------------------------------------------
    // 2) Teams (adds Panthers/Sharks/Bulls)
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

    // Existing demo teams (kept)
    const rockets = mkTeam("t-rockets",  "5v5", "Rockets",  "uid-a");
    const spurs   = mkTeam("t-spurs",    "5v5", "Spurs",    "uid-b");
    const sonics  = mkTeam("t-sonics",   "5v5", "Sonics",   "uid-c");

    // New sample teams
    const panthers = mkTeam("t-panthers","5v5", "Panthers", "uid-g");
    const sharks   = mkTeam("t-sharks",  "5v5", "Sharks",   "uid-h");
    const bulls    = mkTeam("t-bulls",   "5v5", "Bulls",    "uid-i");

    const teamsAll = [rockets, spurs, sonics, panthers, sharks, bulls];

    // Upsert teams (preserve existing flags if present)
    for (const t of teamsAll) {
      const prev = (await kv.get<any>(`team:${t.id}`)) || {};
      await kv.set(`team:${t.id}`, {
        ...prev,
        id: t.id,
        leagueId: "5v5",
        name: prev.name ?? t.name,
        description: prev.description ?? t.description,
        managerUserId: prev.managerUserId ?? t.managerUserId,
        approved: prev.approved ?? false,
        rosterLimit: prev.rosterLimit ?? 8,
        createdAt: prev.createdAt ?? now,
        updatedAt: now,
      });
    }

    // Update league team set (add all teams to the set)
    for (const t of teamsAll) {
      await kv.sadd(`league:5v5:teams`, t.id);
    }

    // Minimal rosters for new teams only (leave existing alone)
    const rosterWithJoin = (entries: any[]) => entries.map(e => ({ ...e, joinedAt: now }));
    const maybeInitRoster = async (teamId: string, entries: any[]) => {
      const key = `team:${teamId}:roster`;
      const current = await kv.get(key);
      if (current === null || current === undefined) {
        await kv.set(key, rosterWithJoin(entries));
      }
    };
    await maybeInitRoster(panthers.id, [{ userId: "uid-g", displayName: "Gwen P.", isManager: true }]);
    await maybeInitRoster(sharks.id,   [{ userId: "uid-h", displayName: "Hank D.", isManager: true }]);
    await maybeInitRoster(bulls.id,    [{ userId: "uid-i", displayName: "Iris Q.", isManager: true }]);

    // Helpful for typeahead
    await kv.sadd(`teams:names`, rockets.name, spurs.name, sonics.name, panthers.name, sharks.name, bulls.name);

    // -----------------------------------------------------------------------
    // 3) Backfill standings rows ONLY for missing teams (no reset)
    // -----------------------------------------------------------------------
    type StandingRow = { teamId: string; name: string; wins: number; losses: number; pointsFor?: number; pointsAgainst?: number; };
    const stKey = `league:5v5:standings`;
    const stArr = parseArr(await kv.get(stKey)) as StandingRow[];
    const stIds = new Set(stArr.map(r => r.teamId));
    const additions: StandingRow[] = [];
    for (const t of [panthers, sharks, bulls]) {
      if (!stIds.has(t.id)) additions.push({ teamId: t.id, name: t.name, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
    }
    if (additions.length) {
      const merged = [...stArr, ...additions];
      await kv.set(stKey, merged);
    }

    // -----------------------------------------------------------------------
    // 4) DO NOT touch schedule/games — keep your manually-entered data
    // -----------------------------------------------------------------------
    // Keys left intact: league:5v5:schedule, league:5v5:games

    revalidatePath("/admin");
    revalidatePath("/admin/leagues/[leagueId]", "page"); // or revalidatePath(`/admin/leagues/${leagueId}`)
    redirect("/admin?seeded=1&mode=augment");
  }

  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Seed / Augment Demo Data (Non-destructive)</h1>
      <p>
        Adds Panthers, Sharks, and Bulls to the 5v5 league and backfills standings rows if missing.
        Existing schedule, games, and standings data are preserved.
      </p>
      <form action={seed}>
        <button style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8 }}>
          Apply Augment
        </button>
      </form>
      <p style={{ marginTop: 12 }}>
        After running, you’ll be redirected to <code>/admin</code>.
      </p>
    </div>
  );
}