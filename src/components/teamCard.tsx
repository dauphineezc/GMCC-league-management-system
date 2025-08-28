// components/teamCard.tsx
type Props = {
  name: string;
  approved?: boolean;
  nextGame?: string;
  badge?: "Manager" | "Admin"; // << new: what to show in the chip
};

export default function TeamCard({ name, approved, nextGame, badge }: Props) {
  return (
    <article className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ margin: 0, color: "var(--navy)", fontWeight: 900, fontSize: 22 }}>{name}</h3>
        {badge && <span style={{ fontWeight: 700 }}>⭐ {badge}</span>}
      </div>

      <div style={{ marginTop: 10 }}>
        {approved ? (
          <span className="badge badge--ok">✅ Approved</span>
        ) : (
          <span className="badge badge--pending">⏳ Pending Approval</span>
        )}
      </div>

      {nextGame && (
        <p style={{ marginTop: 10, color: "var(--muted)" }}>
          <strong>Next Game:</strong> {nextGame}
        </p>
      )}
    </article>
  );
}