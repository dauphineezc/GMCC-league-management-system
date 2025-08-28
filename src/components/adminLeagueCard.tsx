type TeamLite = { id: string; name: string; approved: boolean };
type Props = { leagueId: string; leagueName: string; teams: TeamLite[] };

export default function AdminLeagueCard({ leagueId, leagueName, teams }: Props) {
  return (
    <article className="gradient-card">
      <h3 className="card-title">{leagueName}</h3>

      <div className="card-inner">
        {teams.length === 0 ? (
          <p style={{ margin: 0, color: "var(--muted)" }}>No teams yet.</p>
        ) : (
          teams.map((t) => (
            <div className="league-row" key={t.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="league-name">{t.name}</div>
                <span className={`status ${t.approved ? "status--ok" : "status--pending"}`}>
                  {t.approved ? "Approved" : "Pending"}
                </span>
              </div>
              <a className="card-cta" href={`/team/${t.id}`}>View Team →</a>
            </div>
          ))
        )}

        <div style={{ textAlign: "right", marginTop: 10 }}>
          <a className="card-cta" href={`/leagues/${leagueId}`}>View League →</a>
        </div>
      </div>
    </article>
  );
}
