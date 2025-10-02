type Props = {
  name: string;
  league: string;
  approved: boolean;
  nextGameText?: string; // e.g. "Oct 8 • 7:00 PM • vs Sharks"
  href: string;
  isManager?: boolean;
};

export default function TeamSummaryCard({
  name,
  league,
  approved,
  nextGameText,
  href,
  isManager,
}: Props) {
  const headingId = `${name.replace(/\s+/g, "-").toLowerCase()}-heading`;

  return (
    <article className="gradient-card" aria-labelledby={headingId} style={{ maxWidth: 420 }}>
      {/* Heading */}
      <h3 id={headingId} className="card-title">{name}</h3>
      <div className="card-subtitle">{league}</div>

      <div className="card-inner" style={{ display: "grid", gap: 10 }}>
        {/* Status */}
        <div>
          <span className={`status ${approved ? "status--ok" : "status--pending"}`}>
            {approved ? "Approved" : "Pending Approval"}
          </span>
        </div>

        {isManager && (
            <div style={{ color: "var(--navy)", fontWeight: 700 }}>
              You manage this team
            </div>
          )}

        {/* Next game */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "20px 1fr",
            alignItems: "center",
            gap: 10,
            color: "var(--text)",
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7 3v2M17 3v2M4 8h16M5 6h14a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>

          {nextGameText ? (
            <div style={{ lineHeight: 1.35 }}>
              <div style={{ fontWeight: 700, color: "var(--navy)" }}>Next Game</div>
              <div>{nextGameText}</div>
            </div>
          ) : (
            <em>No upcoming game.</em>
          )}
        </div>

        {/* Manager note + CTA */}
        <div
          style={{
            display: "grid",
            gap: 6,
            marginTop: 4,
          }}
        >
          <div style={{ textAlign: "right" }}>
              <a className="card-cta" href={href} style={{ whiteSpace: "nowrap" }}>
                View Team →
              </a>
            </div>
        </div>
      </div>
    </article>
  );
}