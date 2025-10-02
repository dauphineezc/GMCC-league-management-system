// src/app/(admin)/admin/team/[teamId]/page.tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/serverUser";
import { kv } from "@vercel/kv";
import AdminTeamTabs from "@/components/adminTeamTabs";
import type { Team, RosterEntry, Game, PlayerTeam } from "@/types/domain";  
import DeleteTeamButton from "@/components/deleteResourceButton";


export default async function AdminTeamPage({
  params,
}: {
  params: { teamId: string };
}) {
  // --- auth guard ---
  const me = await getServerUser();
  if (!me) redirect("/login");
  if (!(me.superadmin || Array.isArray(me.leagueAdminOf))) redirect("/player");

  const teamId = params.teamId;

  // --- load team ---
  const team = (await kv.get<Team>(`team:${teamId}`)) || null;
  if (!team) notFound();

  // --- load roster ---
  const roster = (await kv.get<RosterEntry[]>(`team:${teamId}:roster`)) ?? [];

  // paid flags are stored as a simple map: userId -> boolean
  const paidMap =
    (await kv.get<Record<string, boolean>>(`team:${teamId}:payments`)) ?? {};
  const rosterWithPaid: RosterEntry[] = roster.map((r) => ({
    ...r,
    paid: Boolean(paidMap[r.userId]),
  }));

  type RosterRowLocal = RosterEntry & { teamId: string; teamName: string };
  const rosterRows: RosterRowLocal[] = rosterWithPaid.map((r) => ({
    ...r,
    teamId,            // current team page context
    teamName: team.name,
  }));

  // --- games (fill names if missing) ---
  let games = (await kv.get<Game[]>(`team:${teamId}:games`)) ?? [];
  if (!games.length) {
    const leagueGames =
      (await kv.get<Game[]>(`league:${team.leagueId}:games`)) ?? [];
    games = leagueGames.filter(
      (g) => g.homeTeamId === teamId || g.awayTeamId === teamId
    );
  }
  const teamIds = Array.from(
    new Set([teamId, ...games.flatMap((g) => [g.homeTeamId, g.awayTeamId])])
  );
  const idToName = new Map<string, string>();
  await Promise.all(
    teamIds.map(async (id) => {
      const t = await kv.get<Team>(`team:${id}`);
      if (t?.name) idToName.set(id ?? "", t.name); // only set when id & name exist
    })
  );

  // helpers to safely resolve names even if ids are undefined
  const resolveName = (explicit?: string, id?: string) =>
    explicit ?? (id ? idToName.get(id) ?? id : "—");
  const gamesWithNames = games.map((g) => ({
    ...g,
    homeTeamName: resolveName(g.homeTeamName, g.homeTeamId),
    awayTeamName: resolveName(g.awayTeamName, g.awayTeamId),
  }));

  // --- optional enrichment for the popup: all teams for each user ---
  const playerTeamsByUser: Record<string, PlayerTeam[]> = {};
  await Promise.all(
    roster.map(async (r) => {
      const memberships =
        (await kv.get<any[]>(`user:${r.userId}:memberships`)) ?? [];
      if (!memberships?.length) {
        playerTeamsByUser[r.userId] = [
          {
            teamId,
            teamName: team.name,
            leagueId: team.leagueId ?? undefined,
            isManager: r.isManager,
            paid: r.paid,
          },
        ];
        return;
      }
      const entries: PlayerTeam[] = [];
      await Promise.all(
        memberships.map(async (m) => {
          const tid = m.teamId ?? m?.id ?? m;
          const t = (await kv.get<Team>(`team:${tid}`)) || null;
          if (!t) return;
          entries.push({
            teamId: tid,
            teamName: t.name ?? tid,
            leagueId: t.leagueId ?? undefined,
            isManager: Boolean(m.isManager),
            paid:
              (await kv.get<Record<string, boolean>>(
                `team:${tid}:payments`
              ))?.[r.userId] ?? false,
          });
        })
      );
      playerTeamsByUser[r.userId] = entries;
    })
  );

  // ---------- server actions (wired into the UI below) ----------
  const toggleApproval = async () => {
    "use server";
    const t = (await kv.get<Team>(`team:${teamId}`)) || null;
    if (!t) return;
    await kv.set(`team:${teamId}`, { ...t, approved: !t.approved });
    await revalidatePath(`/admin/team/${teamId}`);
    if (t.leagueId) {
      await revalidatePath(`/admin/leagues/${t.leagueId}`); // <-- ensure league list updates
    }
  };

  const togglePaid = async (formData: FormData) => {
    "use server";
    const uid = String(formData.get("userId") || "");
    if (!uid) return;
    const map =
      (await kv.get<Record<string, boolean>>(`team:${teamId}:payments`)) ?? {};
    map[uid] = !Boolean(map[uid]);
    await kv.set(`team:${teamId}:payments`, map);
    await revalidatePath(`/admin/team/${teamId}`);
    if (team.leagueId) {
      await revalidatePath(`/admin/leagues/${team.leagueId}`); // optional but keeps league views fresh
    }
  };

  // ---------- Render ----------
  const recordChip =
    rosterWithPaid.length > 0 ? null : null; // (placeholder if you later add rank/record again)

  return (
    <main style={{ display: "grid", gap: 16 }}>
      {/* Header row: name left, approval toggle right */}
      <header className="team-header">
        <div className="team-title-wrap">
          <h1 className="page-title">{team.name}</h1>
          {recordChip}
        </div>

        <div className="chip-group" style={{ display: "flex", gap: 8 }}>
          <span className={team.approved ? "chip chip--ok" : "chip chip--pending"}>
            {team.approved ? "✅ Approved" : "⏳ Pending Approval"}
          </span>
          <form action={toggleApproval}>
            <button type="submit" className="btn btn--light btn--sm">
              {team.approved ? "Unapprove" : "Approve"}
            </button>
          </form>
        </div>
      </header>

      {/* Description (read-only for admin) */}
      {team.description ? (
        <section className="team-desc card--soft">{team.description}</section>
      ) : null}

    <nav className="mb-2">
        <Link href={`/admin/leagues/${team.leagueId}`} className="text-blue-600 hover:underline">
          ← Back to League
        </Link>
      </nav>

      {/* Tabs: admin roster + schedule + history */}
      <AdminTeamTabs
        teamId={teamId}
        teamName={team.name}
        leagueId={team.leagueId ?? ""}   // <- coerce null → ""
        roster={rosterRows}
        games={gamesWithNames}
        onTogglePaid={togglePaid}
        playerTeamsByUser={playerTeamsByUser}
      />
      <DeleteTeamButton
        kind="team"
        id={teamId}
        name={team.name}
        redirectTo={`/admin/leagues/${team.leagueId ?? ""}`}
        variant="link" // or "button"
      >
        Delete Team
      </DeleteTeamButton>
    </main>
  );
}
