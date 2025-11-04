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
    <div className="gradient-card">
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
                  className="player-card admin-team-card"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    padding: "12px 16px",
                    minHeight: "auto",
                    height: "auto",
                  }}
                >
                  {/* Top row: Team name and badge inline */}
                  <div style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    justifyContent: "space-between",
                    gap: "12px"
                  }}>
                    <span
                      className="summary-card-team-name"
                      title={t.name}
                      style={{
                        fontFamily: "var(--font-body), system-ui",
                        fontWeight: 500,
                        fontSize: 22,
                        lineHeight: 1.2,
                        letterSpacing: ".3px",
                        color: "var(--navy)",
                        flex: 1,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.name}
                    </span>
                    
                    {/* Badge inline with team name */}
                    <span className={`badge ${t.approved ? "badge--ok" : "badge--pending"}`} style={{
                      fontSize: "12px",
                      padding: "4px 8px",
                      fontWeight: 700,
                      lineHeight: 1.2,
                      flexShrink: 0,
                    }}>
                      {t.approved ? "APPROVED" : "PENDING"}
                    </span>
                  </div>
                  
                  {/* Bottom row: View link aligned right */}
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "flex-end" 
                  }}>
                    <Link className="card-cta" href={`/admin/team/${safeId}`} prefetch={false} style={{
                      fontSize: "12px",
                    }}>
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
        <Link className="card-cta" href={`/leagues/${encodeURIComponent(leagueId)}`} prefetch={false} style={{ fontSize: "12px" }}>
          VIEW LEAGUE →
        </Link>
      </div>
    </div>
  );
}