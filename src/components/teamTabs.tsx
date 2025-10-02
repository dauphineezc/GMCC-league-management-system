// src/components/teamTabs.tsx
"use client";

import { useMemo, useState } from "react";
import ScheduleViewer from "@/components/scheduleViewer";
import GameHistory from "@/components/gameHistory";
import type { RosterEntry, Game } from "@/types/domain";

export default function TeamTabs(props: {
  teamId: string;
  teamName: string;
  leagueId: string;
  roster: RosterEntry[];
  games: Game[];
  isMember: boolean;    // team member
  isManager: boolean;   // team manager
}) {
  const { teamId, teamName, leagueId, roster, games, isMember, isManager } = props;
  const [tab, setTab] = useState<"roster" | "schedule" | "history">("roster");

  const now = Date.now();
  const { upcoming, history } = useMemo(() => {
    const u: Game[] = [];
    const h: Game[] = [];
    for (const g of games) {
      const when = Date.parse(g.dateTimeISO);
      if (isFinite(when) && when >= now) u.push(g);
      else h.push(g);
    }
    u.sort((a, b) => Date.parse(a.dateTimeISO) - Date.parse(b.dateTimeISO));
    h.sort((a, b) => Date.parse(b.dateTimeISO) - Date.parse(a.dateTimeISO));
    return { upcoming: u, history: h };
  }, [games, now]);

  return (
    <section className="card">
      {/* Sub-nav tabs */}
      <div className="team-tabs">
        <Tab id="roster"   current={tab} setTab={setTab}>Roster</Tab>
        <Tab id="schedule" current={tab} setTab={setTab}>Schedule</Tab>
        <Tab id="history"  current={tab} setTab={setTab}>Game History</Tab>
      </div>

      {/* Everything below the tabs sits in a padded panel so bullets/tables don’t hug the edge */}
      <div className="team-panel" style={{ paddingTop: 20, paddingLeft: 20, paddingRight: 20, paddingBottom: 20 }}>
        {tab === "roster" && (
          <>
            {roster.length === 0 ? (
              <p>No players yet.</p>
            ) : (
              <div className="roster-gradient">
                <ul className="roster-list">
                  {roster.map((p) => (
                    <li key={p.userId} className="player-card">
                      <span style={{
                          fontFamily:
                            "var(--font-sport), var(--font-body), system-ui",
                          fontSize: 24,
                          fontWeight: 400,
                        }}
                      >{p.displayName || p.userId}</span>
                      {p.isManager && (
                        <span className="player-meta" title="Team Manager">
                          <svg
                            viewBox="0 0 24 24"
                            width="16"
                            height="16"
                            fill="navy"
                            aria-hidden="true"
                          >
                            <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                          </svg>
                          Team Manager
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                <div className="roster-actions">
                  <button type="button" className="btn btn--outline btn--sm">Invite via Link</button>
                  <button type="button" className="btn btn--outline btn--sm">Invite via Code</button>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "schedule" && (
          <ScheduleViewer leagueId={leagueId} teamId={teamId} teamName={teamName} />
        )}

        {tab === "history" && (
          <GameHistory leagueId={leagueId} teamId={teamId} teamName={teamName} />
        )}
      </div>
    </section>
  );
}

function Tab({
  id,
  current,
  setTab,
  children,
}: {
  id: "roster" | "schedule" | "history";
  current: "roster" | "schedule" | "history";
  setTab: (t: "roster" | "schedule" | "history") => void;
  children: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      className={`team-tab ${active ? "is-active" : ""}`}
      onClick={() => setTab(id)}
      type="button"
    >
      {children}
    </button>
  );
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}