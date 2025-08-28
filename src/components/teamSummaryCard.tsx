type Props = {
    name: string;
    approved: boolean;
    nextGameText?: string;
    href: string;
    isManager?: boolean;
  };
  
  export default function TeamSummaryCard({ name, approved, nextGameText, href, isManager }: Props) {
    return (
      <article className="gradient-card">
        <h3 className="card-title">{name}</h3>
  
        <div className="card-inner">
          <div>
            <span className={`status ${approved ? "status--ok" : "status--pending"}`}>
              {approved ? "Approved" : "Pending Approval"}
            </span>
          </div>
  
          <p style={{ margin: "10px 0 6px", color: "var(--text)" }}>
            {nextGameText ? (
              <>
                <strong>Next Game:</strong> {nextGameText}
              </>
            ) : (
              <em>No upcoming game scheduled</em>
            )}
          </p>
  
          {isManager && (
            <p style={{ margin: "6px 0 12px", color: "var(--navy)", fontWeight: 700 }}>You manage this team</p>
          )}
  
          <div style={{ textAlign: "right" }}>
            <a className="card-cta" href={href}>View Team →</a>
          </div>
        </div>
      </article>
    );
  }
  