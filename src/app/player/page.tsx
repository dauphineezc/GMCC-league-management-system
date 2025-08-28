export const dynamic = "force-dynamic";  // ensure no static caching

import Link from "next/link";
import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";
import TeamSummaryCard from "@/components/teamSummaryCard";
import LeaguesListCard from "@/components/leaguesListCard";
import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth";

/* ---------- server actions: dev sign-in/out ---------- */
async function devLogin(formData: FormData) {
  "use server";
  const uid = String(formData.get("uid") || "").trim() || "demo-user";
  const c = cookies();
  c.set("dev-user-id", uid, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  c.set("auth_user", uid, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/");
}
/* server action: dev logout */
export async function devLogout() {
  "use server";
  const c = cookies();
  c.delete("dev-user-id");
  c.delete("auth_user");
  c.delete("dev-role");           // important for role switching
  revalidatePath("/home");
  redirect("/home");
}

/* ---------- types ---------- */
type Team = {
  id: string; leagueId: string; name: string; approved: boolean;
};
type Game = {
  id: string; startTime: string; status?: "scheduled"|"final";
  homeTeamId: string; awayTeamId: string;
  homeTeamName?: string; awayTeamName?: string;
};
type Membership = { leagueId: string; leagueName?: string; teamId: string; teamName?: string; isManager: boolean };

/* ---------- helpers ---------- */
function formatNextGame(g: Game | undefined, teamId: string | null) {
  if (!g) return undefined;
  const opp = g.homeTeamId === teamId ? (g.awayTeamName ?? g.awayTeamId) : (g.homeTeamName ?? g.homeTeamId);
  const dt = new Date(g.startTime);
  const when = new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
  }).format(dt);
  return `${when} • vs ${opp}`;
}

/* ---------- page ---------- */
export default async function PlayerHome() {
  const { userId, roles } = await getSession();
  if (!userId) redirect("/home");
  if (hasRole(roles, "admin")) redirect("/admin");  // admins never see /player

  const memberships: Membership[] = userId ? (await kv.get<any[]>(`user:${userId}:memberships`)) ?? [] : [];

  // Resolve team names, approval, and next game for each membership
  const enrichedTeams = await Promise.all(
    memberships.map(async (m) => {
      // team data
      const team = (await kv.get<Team>(`team:${m.teamId}`)) ?? { id: m.teamId, leagueId: m.leagueId, name: m.teamName ?? m.teamId, approved: false };
      // games (team or league)
      let games = (await kv.get<Game[]>(`team:${m.teamId}:games`)) ?? [];
      if (!games.length) {
        const leagueGames = (await kv.get<Game[]>(`league:${m.leagueId}:games`)) ?? [];
        games = leagueGames.filter((g) => g.homeTeamId === m.teamId || g.awayTeamId === m.teamId);
      }
      // fill names for opponent
      const ids = Array.from(new Set([m.teamId, ...games.flatMap(g => [g.homeTeamId, g.awayTeamId])]));
      const nameMap = new Map<string, string>();
      await Promise.all(ids.map(async (id) => {
        const t = await kv.get<Team>(`team:${id}`);
        if (t?.name) nameMap.set(id, t.name);
      }));
      const withNames = games.map(g => ({
        ...g,
        homeTeamName: g.homeTeamName ?? nameMap.get(g.homeTeamId),
        awayTeamName: g.awayTeamName ?? nameMap.get(g.awayTeamId),
      }));
      const now = Date.now();
      const next = withNames
        .filter(g => new Date(g.startTime).getTime() >= now)
        .sort((a,b) => +new Date(a.startTime) - +new Date(b.startTime))[0];

      return {
        id: team.id,
        name: team.name ?? m.teamName ?? m.teamId,
        approved: !!team.approved,
        leagueId: m.leagueId,
        leagueName: m.leagueName ?? DIVISIONS.find(d => d.id === m.leagueId)?.name ?? m.leagueId,
        isManager: m.isManager,
        nextGameText: formatNextGame(next, m.teamId),
      };
    })
  );

  return (
    <main style={{ padding: 20, display: "grid", gap: 30 }}>
      {!userId ? (
        <section className="card" style={{ padding:16 }}>
          <h2 className="section-title">Sign in</h2>
          <p style={{ marginTop: 0 }}>Use a <strong>dev sign-in</strong> for now.</p>
          <form action={devLogin} style={{ display: "flex", gap: 8 }}>
            <input name="uid" placeholder="enter a user id (e.g., demo-admin)" style={input} />
            <button style={btn}>Sign in</button>
          </form>
        </section>
      ) : (
        <>
        {/* Welcome section */}
            <section>
            <h2 className="section-title">Welcome</h2>
            <p style={{ marginTop: 0 }}>
                <strong>You are signed in as</strong> <code>{userId}</code>
            </p>
            <form action={devLogout}>
                <button className="btn btn--outline">Sign out</button>
            </form>
            </section>

            {/* My Teams */}
            <section>
            <h2 className="section-title">My Teams</h2>
            <div className="cards-grid">
                {enrichedTeams.length ? (
                enrichedTeams.map(t => (
                    <TeamSummaryCard
                    key={t.id}
                    name={t.name}
                    approved={t.approved}
                    nextGameText={t.nextGameText}
                    href={`/team/${t.id}`}
                    isManager={t.isManager}
                    />
                ))
                ) : (
                <p style={{ color: "var(--muted)" }}>No teams yet.</p>
                )}
            </div>
            <div className="btn-row" style={{ marginTop: 12 }}>
                <Link href="/create-team" className="btn btn--outline">Create Team</Link>
                <Link href="/join" className="btn btn--outline">Join with Code</Link>
            </div>
            </section>

            {/* Leagues list, styled like teams section */}
            <section>
            <h2 className="section-title">Leagues</h2>
            <LeaguesListCard />
            </section>
        </>
        )}
    </main>
  );
}

/* small inline styles reused */
const btn: React.CSSProperties = { padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8, background: "white", cursor: "pointer" };
const input: React.CSSProperties = { padding: 8, border: "1px solid #ccc", borderRadius: 8, minWidth: 260 };