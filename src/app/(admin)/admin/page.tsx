export const dynamic = "force-dynamic";

import Link from "next/link";
import { headers, cookies } from "next/headers";
import { kv } from "@vercel/kv";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, hasRole } from "@/lib/auth";
import { DIVISIONS } from "@/lib/divisions";
import AdminLeagueCard from "@/components/adminLeagueCard";
import LeaguesListCard from "@/components/leaguesListCard";

/* server action: dev logout */
export async function devLogout() {
  "use server";
  const c = cookies();
  c.delete("dev-user-id");
  c.delete("auth_user");
  c.delete("dev-role");
  revalidatePath("/home");
  redirect("/home");
}

type TeamKV = { id: string; name?: string; approved?: boolean; leagueId: string };

/* ---- page ---- */
export default async function AdminHome() {
  const { userId, roles } = await getSession();
  if (!userId) redirect("/home");
  if (!hasRole(roles, "admin")) redirect("/player");  // only admins here

  const managed = (await kv.get<string[]>(`admin:${userId}:leagues`)) ?? [];

  // Build league cards: league name + teams inside each league
  const leagueCards = await Promise.all(
    managed.map(async (leagueId) => {
      // league display name
      const leagueName = DIVISIONS.find((d) => d.id === leagueId)?.name ?? leagueId;

      // robust read: array OR object map; supports ids, {id}, or "team:ID"
      const raw =
        (await kv.get<any>(`league:${leagueId}:teams`)) ??
        (await kv.get<any>(`division:${leagueId}:teams`)) ?? // fallback if seeded under division
        [];

      const list = Array.isArray(raw) ? raw : Object.values(raw);
      const teamIds = (list as any[])
        .map((t) => {
          if (typeof t === "string") return t.startsWith("team:") ? t.slice(5) : t;
          return t?.id || t?.teamId || null;
        })
        .filter(Boolean) as string[];

      const teams = await Promise.all(
        teamIds.map(async (tid) => {
          const t = (await kv.get<{ id: string; name?: string; approved?: boolean }>(`team:${tid}`)) ?? { id: tid };
          return { id: tid, name: t.name ?? tid, approved: Boolean(t.approved) };
        })
      );

      return { leagueId, leagueName, teams };
    })
  );

  return (
    <main style={{ padding: 20, display: "grid", gap: 30 }}>
      {/* Welcome / who you are */}
      <section>
        <h2 className="section-title">Welcome</h2>
        <p style={{ marginTop: 0 }}>
          <strong>You are signed in as</strong> <code>{userId}</code>.
        </p>
        <form action={devLogout}><button className="btn btn--outline">Sign out</button></form>
      </section>

      {/* My Leagues (admin-managed) */}
      <section>
        <h2 className="section-title">My Leagues</h2>
        <div className="cards-grid-fixed">
          {leagueCards.map((lg) => (
            <AdminLeagueCard
              key={lg.leagueId}
              leagueId={lg.leagueId}
              leagueName={lg.leagueName}
              teams={lg.teams}
            />
          ))}
        </div>
      </section>

      {/* Public leagues list – keep the same section you used on the player page if you want */}
      <section>
        <h2 className="section-title">Leagues</h2>
        <LeaguesListCard />
      </section>
    </main>
  );
}