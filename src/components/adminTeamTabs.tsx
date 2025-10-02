// src/components/adminTeamTabs.tsx
"use client";

import { useMemo, useState, useCallback } from "react";
import PlayerInfoPopup from "@/components/playerInfoPopup";
import ScheduleViewer from "@/components/scheduleViewer";
import GameHistory from "@/components/gameHistory";
import type { PlayerInfo, PlayerTeam, RosterRow, Game } from "@/types/domain";

type Props = {
  teamId: string;
  teamName: string;
  leagueId: string;
  roster: RosterRow[];
  games: Game[];
  onTogglePaid: (formData: FormData) => void;
  playerTeamsByUser: Record<string, PlayerTeam[]>;
};

type TabKey = "roster" | "schedule" | "history";

function slugify(s: string) {
  return (s || "").toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
}
function hashCode(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
  return h;
}
function fakeContact(displayName: string) {
  const slug = slugify(displayName || "player");
  return {
    email: `${slug}@example.com`,
    phone: "(989) 555-" + String(Math.abs(hashCode(slug)) % 9000 + 1000),
    dob: "1990-05-21",
    emergencyName: "Spouse",
    emergencyPhone: "(989) 888-9988",
  };
}

export default function AdminTeamTabs({
  teamId,
  teamName,
  leagueId,
  roster,
  games,
  onTogglePaid,
  playerTeamsByUser,
}: Props) {
  const [tab, setTab] = useState<TabKey>("roster");

  // popup state
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);
  const [contextPaid, setContextPaid] = useState<boolean | undefined>(undefined);

  const closePopup = useCallback(() => {
    setOpen(false);
    setPlayer(null);
    setContextPaid(undefined);
  }, []);

  const openPopupFor = useCallback(
    (row: RosterRow) => {
      const contact = fakeContact(row.displayName);
      const teams =
        playerTeamsByUser?.[row.userId] ??
        [
          {
            teamId,
            leagueId,
            teamName: teamName,
            isManager: row.isManager,
            paid: row.paid,
          },
        ];
      setPlayer({ userId: row.userId, displayName: row.displayName, contact, teams });
      setContextPaid(row.paid);
      setOpen(true);
    },
    [playerTeamsByUser, teamId, leagueId]
  );

  const now = Date.now();
  const { upcoming, history } = useMemo(() => {
    const u: Game[] = [], h: Game[] = [];
    for (const g of games) {
      const when = Date.parse(g.dateTimeISO);
      (isFinite(when) && when >= now ? u : h).push(g);
    }
    u.sort((a, b) => Date.parse(a.dateTimeISO) - Date.parse(b.dateTimeISO));
    h.sort((a, b) => Date.parse(b.dateTimeISO) - Date.parse(a.dateTimeISO));
    return { upcoming: u, history: h };
  }, [games, now]);

  const COL_GAP = 80;
  const PAYGROUP_GAP = 14;

  return (
    <section className="card">
      <div className="team-tabs">
        <button type="button" className={`team-tab ${tab === "roster" ? "is-active" : ""}`} onClick={() => setTab("roster")}>Roster</button>
        <button type="button" className={`team-tab ${tab === "schedule" ? "is-active" : ""}`} onClick={() => setTab("schedule")}>Schedule</button>
        <button type="button" className={`team-tab ${tab === "history" ? "is-active" : ""}`} onClick={() => setTab("history")}>Game History</button>
      </div>

      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        {tab === "roster" && (
          <div className="roster-gradient">
            {roster.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No players yet.</p>
            ) : (
              <ul className="roster-list">
                {roster.map((p) => (
                  <li key={p.userId}>
                    <div
                        className="player-card"
                        style={{
                          display: "grid",
                          alignItems: "center",
                          columnGap: COL_GAP,
                          gridTemplateColumns: "minmax(240px,1fr) max-content max-content max-content",
                          justifyItems: "start",
                          paddingRight: 10,
                        }}
                      >
                      <div style={{ 
                        fontFamily: "var(--font-sport), var(--font-body), system-ui", 
                        fontSize: 24, 
                        fontWeight: 500,
                        paddingLeft: 15,
                        letterSpacing: ".3px",
                        lineHeight: 1.1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {p.displayName}
                      </div>

                      <div>
                        {p.isManager ? (
                          <span className="player-meta" title="Team Manager">
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="navy" aria-hidden="true" style={{ marginRight: 4, alignSelf: "center" }}>
                              <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                            </svg>
                            Team Manager
                          </span>
                        ) : (
                          <span className="player-meta" style={{ opacity: 0 }}>
                            <svg viewBox="0 0 24 24" width="16" height="16" fill="navy" aria-hidden="true" style={{ marginRight: 4, alignSelf: "center" }}>
                              <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                            </svg>
                            Team Manager
                          </span>
                        )}
                      </div>

                      <div className="paygroup" style={{ display: "inline-flex", alignItems: "center", gap: PAYGROUP_GAP, alignSelf: "center" }}>
                        <span className={`badge ${p.paid ? "badge--ok" : "badge--pending"}`}>{p.paid ? "PAID" : "UNPAID"}</span>
                        <form action={onTogglePaid}>
                          <input type="hidden" name="userId" value={p.userId} />
                          <button className="btn btn--light btn--sm" type="submit">
                            {p.paid ? "MARK AS UNPAID" : "MARK AS PAID"}
                          </button>
                        </form>
                      </div>

                      <div
                        className="col-view"  
                        style={{
                          justifySelf: "end",
                        }}
                      >
                      <button
                        type="button"
                        className="card-cta"
                        aria-label={`View ${p.displayName}`}
                        onClick={() => openPopupFor(p)}
                        title={`View ${p.displayName}`}
                        style={{
                          whiteSpace: "nowrap",
                          overflowWrap: "normal",
                          wordBreak: "normal",
                          display: "inline-block"
                        }}
                      >
                        VIEW PLAYER →
                      </button>
                    </div>
                  </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {tab === "schedule" && (
          <ScheduleViewer leagueId={leagueId} teamId={teamId} teamName={teamName} />
        )}

        {tab === "history" && (
          <GameHistory leagueId={leagueId} teamId={teamId} teamName={teamName} />
        )}
      </div>

      <PlayerInfoPopup
        open={open}
        player={player}
        onClose={closePopup}
        contextLeagueId={leagueId}
        contextTeamId={teamId}
        contextPaidOverride={contextPaid}
      />
    </section>
  );
}