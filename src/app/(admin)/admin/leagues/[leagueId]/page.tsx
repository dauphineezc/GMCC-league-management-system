// /src/app/(admin)/admin/leagues/[leagueId]/page.tsx
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import AdminLeagueSplitTabs from "@/components/adminLeagueSplitTabs";
import { DIVISIONS } from "@/lib/divisions";
import { getServerUser, isLeagueAdmin } from "@/lib/serverUser";
import type { RosterEntry } from "@/types/domain";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { isLeagueAdminAsync } from "@/lib/serverUser";

/* ---------------- tolerant helpers ---------------- */

// Safe SMEMBERS → string[]
async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers(key)) as unknown;
    if (Array.isArray(v)) return (v as unknown[]).map(String).filter(Boolean);
  } catch {
    /* ignore WRONGTYPE */
  }
  return [];
}

// Read an array-like key (GET) that may be an array JSON string or a real array
async function readArr<T = any>(key: string): Promise<T[]> {
  let raw: unknown;
  try {
    raw = await kv.get(key);
  } catch {
    return [];
  }
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s) return [];
    try {
      const arr = JSON.parse(s);
      return Array.isArray(arr) ? (arr as T[]) : [];
    } catch {
      return [];
    }
  }
  if (raw && typeof raw === "object") {
    // some older data might be an object { ... } — not an array
    return [];
  }
  return [];
}

// Prefer hash for league doc; fallback to GET object
async function readLeagueDoc(leagueId: string): Promise<Record<string, any> | null> {
  try {
    const h = (await kv.hgetall(`league:${leagueId}`)) as Record<string, any> | null;
    if (h && typeof h === "object" && Object.keys(h).length) return h;
  } catch {}
  try {
    const g = (await kv.get(`league:${leagueId}`)) as any;
    if (g && typeof g === "object") return g as Record<string, any>;
  } catch {}
  return null;
}

/* ---------------- page helpers ---------------- */

type TeamCard = { teamId: string; name: string; description?: string; approved?: boolean };

async function getTeamsForLeague(leagueId: string): Promise<TeamCard[]> {
  // Teams are a SET at league:{leagueId}:teams
  const teamIds = await smembersSafe(`league:${leagueId}:teams`);

  // If none, optionally infer from players (legacy)
  const seeds = new Set<string>(teamIds);
  if (seeds.size === 0) {
    const players = await readArr<any>(`league:${leagueId}:players`);
    for (const tid of players.map((p) => String(p?.teamId ?? "")).filter(Boolean)) {
      seeds.add(tid);
    }
  }

  const ids = Array.from(seeds);
  const rows = await Promise.all(
    ids.map(async (id) => {
      const t = (await kv.get<any>(`team:${id}`)) || null;
      return {
        teamId: id,
        name: t?.name ?? id,
        description: t?.description ?? "",
        approved: Boolean(t?.approved),
      } as TeamCard;
    })
  );

  return rows.sort((a, b) => (a.name || a.teamId).localeCompare(b.name || b.teamId, undefined, { sensitivity: "base" }));
}

/* ---------------- page ---------------- */

export default async function AdminLeaguePage({ params }: { params: { leagueId: string } }) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!(await isLeagueAdminAsync(user, params.leagueId))) notFound();

  const leagueId = params.leagueId;

  const [leagueDoc, teams] = await Promise.all([
    readLeagueDoc(leagueId),
    getTeamsForLeague(leagueId),
  ]);

  // League name: doc.name → DIVISIONS map → id
  const leagueName =
    (leagueDoc?.name && String(leagueDoc.name)) ||
    DIVISIONS.find((d) => d.id === leagueId)?.name ||
    leagueId;

  const description = leagueDoc?.description ?? "";

  // Build master roster (union across teams) and mark paid from team payments
  const masterRoster: Array<RosterEntry & { teamId: string; teamName: string; paid?: boolean }> = [];

  await Promise.all(
    teams.map(async (t) => {
      const [r, payMap] = await Promise.all([
        readArr<RosterEntry>(`team:${t.teamId}:roster`),
        kv.get<Record<string, boolean>>(`team:${t.teamId}:payments`).catch(() => null),
      ]);

      for (const entry of r) {
        masterRoster.push({
          ...entry,
          teamId: t.teamId,
          teamName: t.name,
          paid: Boolean(payMap?.[entry.userId]),
        });
      }
    })
  );

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{leagueName}</h1>
        </div>
        <div className="mt-2">
          <a className="btn btn--outline" href={`/admin/leagues/${encodeURIComponent(leagueId)}/export.csv`}>
            Download Roster CSV
          </a>
        </div>
      </header>

      {description && (
        <section className="card--soft" style={{ maxWidth: 720 }}>
          {description}
        </section>
      )}

      <AdminLeagueSplitTabs leagueId={leagueId} teams={teams} roster={masterRoster} />
    </main>
  );
}