// /src/components/DirectoryRosterClient.tsx
"use client";

import { useCallback, useMemo, useState } from "react";
import PlayerInfoPopup from "@/components/playerInfoPopup";
import type { RosterRow, PlayerTeam, PlayerInfo } from "@/types/domain";

export default function DirectoryRosterClient({
  roster,
  playerTeamsByUser,
  contextLeagueId = "all",
}: {
  roster: RosterRow[];
  playerTeamsByUser: Record<string, PlayerTeam[]>;
  contextLeagueId?: string; // used by popup to highlight the clicked membership
}) {
  // popup state (same as AdminLeagueSplitTabs)
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [contextTeamId, setContextTeamId] = useState<string | undefined>(undefined);
  const [contextPaid, setContextPaid] = useState<boolean | undefined>(undefined);

  const handleClose = useCallback(() => {
    setOpen(false);
    setPlayer(null);
    setContextTeamId(undefined);
    setContextPaid(undefined);
  }, []);

  const handleView = useCallback(
    (row: RosterRow) => {
      // Build teams list for the popup
      const teamsForUser: PlayerTeam[] = (playerTeamsByUser?.[row.userId] ?? []).map(t => ({
        teamId: t.teamId,
        teamName: t.teamName,
        isManager: Boolean(t.isManager),
        paid: Boolean(t.paid),
        leagueId: String(t.leagueId),
        leagueName: t.leagueName,
      }));

      // If no global map entry was found, at least include the clicked membership
      if (teamsForUser.length === 0) {
        teamsForUser.push({
          teamId: row.teamId,
          teamName: row.teamName,
          isManager: row.isManager,
          paid: row.paid,
          leagueId: contextLeagueId,
          leagueName: contextLeagueId,
        });
      }

      // IMPORTANT: do NOT provide a fake placeholder email here.
      // Leave email blank so the popup fetch can show the canonical Firebase/KV email without flicker.
      const emptyContact = {
        email: "",           // ← blank (falsy) so popup won’t render @example.com first
        phone: "",
        dob: "",
        emergencyName: "",
        emergencyPhone: "",
      };

      setPlayer({
        userId: row.userId,
        displayName: row.displayName,
        contact: emptyContact,
        teams: teamsForUser,
      });
      setContextTeamId(row.teamId);
      setContextPaid(row.paid);
      setOpen(true);
    },
    [playerTeamsByUser, contextLeagueId]
  );

  // === Same layout calc as your RosterPane ===
  const COL_GAP = 70;
  const col = useMemo(() => {
    if (typeof document === "undefined") {
      return { namePx: 200, teamPx: 160, managerPx: 140, paidPx: 110 };
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;
    const measure = (txt: string, font: string) => { ctx.font = font; return Math.ceil(ctx.measureText(txt).width); };
    const nameFont = "700 24px var(--font-body), system-ui";
    const teamFont = "800 16px var(--font-body), system-ui";
    const metaFont = "700 14px var(--font-body), system-ui";
    const badgeFont = "700 14px var(--font-body), system-ui";
    let namePx = 160, teamPx = 140;
    for (const r of roster) {
      namePx = Math.max(namePx, measure(r.displayName || "", nameFont));
      teamPx = Math.max(teamPx, measure((r.teamName || "").toUpperCase(), teamFont));
    }
    const managerPx = measure("Team Manager", metaFont) + 24;
    const paidPx = Math.max(measure("PAID", badgeFont), measure("UNPAID", badgeFont)) + 28;
    return { namePx, teamPx, managerPx, paidPx };
  }, [roster]);

  return (
    <section className="card">
      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        <div className="roster-gradient" style={{ marginTop: 8 }}>
          {roster.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No players yet.</p>
          ) : (
            <ul className="roster-list">
              {roster.map((p) => (
                <li key={`${p.teamId}:${p.userId}`}>
                  <div
                    className="player-card player-card--aligned"
                    style={{
                      gridTemplateColumns: `${col.namePx}px ${col.teamPx}px ${col.managerPx}px ${col.paidPx}px max-content`,
                      ["--col-gap" as any]: `${COL_GAP}px`,
                    }}
                  >
                    <div className="directory-roster-player-name" style={{ fontFamily: "var(--font-body), system-ui", fontSize: 24, fontWeight: 500 }}>
                      {p.displayName}
                    </div>
                    <div className="directory-roster-team-name" style={{ fontSize: 16, fontWeight: 800, color: "var(--navy)", textTransform: "uppercase" }}>
                      {p.teamName}
                    </div>
                    <div>
                      {p.isManager ? (
                        <span className="player-meta" title="Team Manager" style={{ whiteSpace: "nowrap" }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="navy" aria-hidden="true" style={{ marginRight: 4 }}>
                            <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                          </svg>
                          Team Manager
                        </span>
                      ) : (
                        <span className="player-meta" style={{ opacity: 0 }}>
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="navy" aria-hidden="true" style={{ marginRight: 4 }}>
                            <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                          </svg>
                          Team Manager
                        </span>
                      )}
                    </div>
                    <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`} style={{ whiteSpace: "nowrap" }}>
                      {p.paid ? "PAID" : "UNPAID"}
                    </span>
                    <div className="col-view">
                      <button type="button" className="card-cta" onClick={() => handleView(p)}>
                        VIEW PLAYER →
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <PlayerInfoPopup
        open={open}
        player={player}
        onClose={handleClose}
        contextLeagueId={contextLeagueId}
        contextTeamId={contextTeamId}
        contextPaidOverride={contextPaid}
      />
    </section>
  );
}