// components/LeaguesListCard.tsx
import { kv } from "@vercel/kv";
import { DIVISIONS } from "@/lib/divisions";

export default async function LeaguesListCard() {
  // fetch counts (optional, but keeps your existing numbers)
  const leagues = await Promise.all(
    DIVISIONS.map(async (d) => {
      const teams = (await kv.get<any[]>(`league:${d.id}:teams`)) ?? [];
      return { id: d.id, name: d.name, teamsCount: teams.length };
    })
  );

  return (
    <div className="gradient-card">
      <div className="card-inner">
        {leagues.map((lg) => (
          <div className="league-row" key={lg.id}>
            <div>
              <div className="league-name">{lg.name}</div>
              {typeof lg.teamsCount === "number" && (
                <div style={{ color: "var(--muted)", fontSize: ".9rem" }}>
                  {lg.teamsCount} {lg.teamsCount === 1 ? "team" : "teams"}
                </div>
              )}
            </div>
            <a className="card-cta" href={`/leagues/${lg.id}`}>View League →</a>
          </div>
        ))}
      </div>
    </div>
  );
}
