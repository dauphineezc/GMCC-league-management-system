// src/components/adminLeagueSummaryCard.tsx
"use client";

import Link from "next/link";
import type { TeamLite } from "@/types/domain";

export default function AdminLeagueCard({ leagueId, leagueName, teams }: {
  leagueId: string;
  leagueName: string;
  teams: TeamLite[];
}) {
  // Clean up anything weird that slipped through
  const cleanTeams = (Array.isArray(teams) ? teams : [])
    .map((t: any) => {
      const teamId = typeof t?.teamId === "string" ? t.teamId : (typeof t?.id === "string" ? t.id : "");
      if (!teamId) return null;
      const name = typeof t?.name === "string" && t.name.trim() ? t.name.trim() : teamId;
      return { teamId, name, approved: !!t?.approved };
    })
    .filter(Boolean) as Array<{ teamId: string; name: string; approved: boolean }>;

    return (
    <div className="gradient-card" style={{ padding: 14 }}>
      <h3 className="card-title" style={{ margin: "4px 0 14px" }}>{leagueName}</h3>

      {cleanTeams.length === 0 ? (
          <p className="muted" style={{ margin:0 }}>No teams yet.</p>
      ) : (
        <ul className="roster-list">
          {cleanTeams.map((t) => {
            const safeId = encodeURIComponent(t.teamId);
            return (
              <li key={safeId}>
                <div
                  className="player-card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(170px,1fr) 120px max-content",
                    columnGap: 30,
                    alignItems: "center",
                  }}
                >
                  {/* name */}
                  <span
                    title={t.name}
                    style={{
                      fontFamily: "var(--font-sport), var(--font-body), system-ui",
                      fontWeight: 500,
                      fontSize: 24,
                      lineHeight: 1.1,
                      letterSpacing: ".3px",
                      paddingLeft: 15,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.name}
                  </span>

                  {/* centered badge */}
                  <div style={{ display: "grid", placeItems: "center" }}>
                    <span className={`badge ${t.approved ? "badge--ok" : "badge--pending"}`}>
                      {t.approved ? "APPROVED" : "PENDING"}
                    </span>
                  </div>

                  {/* view link */}
                  <div style={{ justifySelf: "end" }}>
                    <Link className="card-cta" href={`/admin/team/${safeId}`} prefetch={false}>
                      VIEW TEAM →
                    </Link>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div style={{ textAlign: "right", marginTop: 12 }}>
        <Link href={`/leagues/${encodeURIComponent(leagueId)}`} prefetch={false}>
          <span className="card-cta">VIEW LEAGUE →</span>
        </Link>
      </div>
    </div>
  );
}