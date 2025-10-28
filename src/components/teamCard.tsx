// components/teamCard.tsx
type Props = {
  name: string;
  approved?: boolean;
  nextGame?: string;
  isManager?: boolean;
  badge?: "Manager" | "Admin"; // << new: what to show in the chip
  href?: string;
};

export default function TeamCard({
  name,
  approved,
  nextGame,
  isManager,              // <- grab it
  href,
}: Props) {
  return (
    <article className="gradient-card">
      <h3 className="card-title">{name}</h3>
      {isManager && (
        <p style={{ margin: "-8px 0 10px", textAlign: "center", color: "var(--navy)", fontWeight: 700 }}>
          You manage this team
        </p>
      )}

      <div>
        <span className={`status ${approved ? "status--ok" : "status--pending"}`}>
          {approved ? "Approved" : "Pending"}
        </span>
      </div>

      <p style={{ margin: "10px 0 6px", color: "var(--text)" }}>
        {nextGame ? (
          <>
            <strong>Next Game:</strong> {nextGame}
          </>
        ) : (
          <em>No upcoming game.</em>
        )}
      </p>

      {href && (
        <div style={{ textAlign: "right" }}>
          <a className="card-cta" href={href}>View Team →</a>
        </div>
      )}
    </article>
  );
}