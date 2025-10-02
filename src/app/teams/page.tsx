// app/teams/page.tsx
import { headers, cookies } from "next/headers";
import { kv } from "@vercel/kv";
import TeamCard from "@/components/teamCard";
import type { Membership } from "@/types/domain";

export default async function MyTeamsPage() {
  const h = headers();
  const c = cookies();
  const userId = h.get("x-user-id") || c.get("dev-user-id")?.value || null;

  const memberships: Membership[] =
    userId ? (await kv.get<Membership[]>(`user:${userId}:memberships`)) ?? [] : [];

  const teams = await Promise.all(
    memberships.map(async (m) => {
      const team = await kv.get<any>(`team:${m.teamId}`);
      return team ? { ...team, isManager: m.isManager } : null;
    })
  ).then((xs) => xs.filter(Boolean) as any[]);

  return (
    <>
      <h1 className="text-4xl font-black mb-5">My Teams</h1>

      <div className="flex gap-3 mb-6">
        <a className="btn btn--primary" href="/teams/create">+ Create Team</a>
        <a className="btn" href="/teams/join">+ Join Team</a>
      </div>

      <div style={{ display:"grid", gap:20, gridTemplateColumns:"repeat(auto-fit, minmax(280px, 1fr))" }}>
        {teams.length ? (
          teams.map((t) => (
            <a key={t.id} href={`/team/${t.id}`} style={{ display:"block" }}>
              <TeamCard
                name={t.name}
                isManager={t.isManager}
                approved={t.approved}
                nextGame={undefined}
              />
            </a>
          ))
        ) : (
          <p style={{ color:"var(--muted)" }}>You’re not on any teams yet.</p>
        )}
      </div>
    </>
  );
}