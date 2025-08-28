// app/team/[teamId]/page.tsx
import { notFound, redirect } from "next/navigation";
import { kv } from "@vercel/kv";
import TeamTabs from "@/components/teamTabs";
import TeamCard from "@/components/teamCard";
import { getSession, hasRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/* ------------ Types ------------- */
type Team = {
  id: string;
  leagueId: string;
  name: string;
  description?: string;
  managerUserId: string;
  approved: boolean;
  rosterLimit: number;
  createdAt: string;
  updatedAt: string;
};

export type RosterEntry = {
  userId: string;
  displayName: string;
  isTeamManager: boolean;
  joinedAt: string;
  paid?: boolean; // optional; admins can toggle
};

type StandingRow = {
  teamId: string;
  rank?: number;
  wins?: number;
  losses?: number;
  ties?: number;
};

export type Game = {
  id: string;
  startTime: string; // ISO
  location?: string;
  status?: "scheduled" | "final";
  homeTeamId: string;
  awayTeamId: string;
  homeScore?: number;
  awayScore?: number;
  homeTeamName?: string;
  awayTeamName?: string;
};

export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const teamId = params.teamId;

  // session
  const { userId, roles } = await getSession();

  // data
  const team = (await kv.get<Team>(`team:${teamId}`)) || null;
  if (!team) notFound();

  const roster = (await kv.get<RosterEntry[]>(`team:${teamId}:roster`)) ?? [];

  const standings = (await kv.get<StandingRow[]>(`league:${team.leagueId}:standings`)) ?? [];
  const standing = standings.find((s) => s.teamId === teamId) || null;

  // games: prefer team key, else derive from league games
  let games = (await kv.get<Game[]>(`team:${teamId}:games`)) ?? [];
  if (!games.length) {
    const leagueGames = (await kv.get<Game[]>(`league:${team.leagueId}:games`)) ?? [];
    games = leagueGames.filter((g) => g.homeTeamId === teamId || g.awayTeamId === teamId);
  }

  // fill names for schedule
  const teamIds = Array.from(new Set([teamId, ...games.flatMap((g) => [g.homeTeamId, g.awayTeamId])]));
  const idToName = new Map<string, string>();
  await Promise.all(
    teamIds.map(async (id) => {
      const t = await kv.get<Team>(`team:${id}`);
      if (t?.name) idToName.set(id, t.name);
    })
  );
  const gamesWithNames = games.map((g) => ({
    ...g,
    homeTeamName: g.homeTeamName || idToName.get(g.homeTeamId) || g.homeTeamId,
    awayTeamName: g.awayTeamName || idToName.get(g.awayTeamId) || g.awayTeamId,
  }));

  /* ------------ permissions ------------- */
  // membership
  const memberships = userId ? ((await kv.get<any[]>(`user:${userId}:memberships`)) ?? []) : [];
  const meOnThisTeam = memberships.find((m) => m.teamId === teamId);
  const isMember = Boolean(meOnThisTeam);
  const isTeamManager = Boolean(meOnThisTeam?.isTeamManager);

  // league admin for THIS league
  const managedLeagues = userId ? ((await kv.get<string[]>(`admin:${userId}:leagues`)) ?? []) : [];
  const isLeagueAdmin = hasRole(roles, "admin") && managedLeagues.includes(team.leagueId);

  // capability and chip label
  const canManage = isTeamManager || isLeagueAdmin;
  const chip: "Manager" | "Admin" | undefined = isTeamManager ? "Manager" : (isLeagueAdmin ? "Admin" : undefined);

  const rankText =
    standing?.rank != null
      ? `Rank #${standing.rank}`
      : standing
      ? `${standing.wins ?? 0}-${standing.losses ?? 0}${standing.ties ? `-${standing.ties}` : ""}`
      : "—";

  /* ------------ server actions (bound to this team) ------------- */

  async function updateMeta(formData: FormData) {
    "use server";
    if (!userId) redirect("/home");
    // Only the roster manager can edit meta
    // (admins should NOT be able to rename/invite)
    const myMemberships = (await kv.get<any[]>(`user:${userId}:memberships`)) ?? [];
    const onThisTeam = myMemberships.find((m) => m.teamId === teamId);
    if (!onThisTeam?.isTeamManager) redirect(`/team/${teamId}`);

    const name = (formData.get("name") as string) ?? "";
    const description = (formData.get("description") as string) ?? "";

    const current = (await kv.get<Team>(`team:${teamId}`)) || { id: teamId, leagueId: team.leagueId, name: "" };
    await kv.set(`team:${teamId}`, { ...current, name: name.trim() || current.name, description: description.trim() });
    revalidatePath(`/team/${teamId}`);
  }

  async function inviteByEmail(formData: FormData) {
    "use server";
    if (!userId) redirect("/home");
    const myMemberships = (await kv.get<any[]>(`user:${userId}:memberships`)) ?? [];
    const onThisTeam = myMemberships.find((m) => m.teamId === teamId);
    if (!onThisTeam?.isTeamManager) redirect(`/team/${teamId}`);

    const email = String(formData.get("email") || "").trim().toLowerCase();
    if (email) {
      // store a simple pending invite list for now
      const key = `team:${teamId}:invites`;
      const invites = (await kv.get<string[]>(key)) ?? [];
      if (!invites.includes(email)) {
        invites.push(email);
        await kv.set(key, invites);
      }
    }
    revalidatePath(`/team/${teamId}`);
  }

  async function setApproval(formData: FormData) {
    "use server";
    if (!userId) redirect("/home");
    // Only league admins can approve/unapprove
    if (!team) redirect(`/team/${teamId}`);
    const leagues = (await kv.get<string[]>(`admin:${userId}:leagues`)) ?? [];
    if (!leagues.includes(team.leagueId)) redirect(`/team/${teamId}`);

    const approved = formData.get("approved") === "true";
    const current = (await kv.get<Team>(`team:${teamId}`)) || { id: teamId, leagueId: team.leagueId, name: "" };
    await kv.set(`team:${teamId}`, { ...current, approved });
    revalidatePath(`/team/${teamId}`);
  }

  async function markPaid(formData: FormData) {
    "use server";
    if (!userId) redirect("/home");
    const leagues = (await kv.get<string[]>(`admin:${userId}:leagues`)) ?? [];
    if (!leagues.includes(team.leagueId)) redirect(`/team/${teamId}`);

    const playerId = String(formData.get("userId") || "");
    const paid = formData.get("paid") === "true";

    const list = (await kv.get<RosterEntry[]>(`team:${teamId}:roster`)) ?? [];
    const idx = list.findIndex((r) => r.userId === playerId);
    if (idx >= 0) {
      list[idx] = { ...list[idx], paid };
      await kv.set(`team:${teamId}:roster`, list);
    }
    revalidatePath(`/team/${teamId}`);
  }

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <TeamCard
        name={team.name}
        approved={team.approved}
        badge={chip}
        nextGame={
          gamesWithNames[0]
            ? `${new Date(gamesWithNames[0].startTime).toLocaleString()} – vs ${
                gamesWithNames[0].homeTeamId === teamId
                  ? gamesWithNames[0].awayTeamName
                  : gamesWithNames[0].homeTeamName
              }`
            : undefined
        }
      />

      <section className="card" style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ margin: 0 }}>Team Overview</h2>
          <span style={{ color: "var(--muted)" }}>{rankText}</span>
        </div>
        {team.description && <p style={{ marginTop: 8 }}>{team.description}</p>}
        {!team.approved && <p style={{ marginTop: 8, color: "#b45309" }}>Pending admin approval.</p>}
      </section>

      <TeamTabs
        teamId={teamId}
        leagueId={team.leagueId}
        roster={roster}
        games={gamesWithNames}
        isMember={isMember}
        isTeamManager={isTeamManager}
        isLeagueAdmin={isLeagueAdmin}
        teamName={team.name}
        teamDescription={team.description || ""}
        approved={team.approved}
        actions={{
          updateMeta,
          inviteByEmail,
          setApproval,
          markPaid,
        }}
      />
    </main>
  );
}