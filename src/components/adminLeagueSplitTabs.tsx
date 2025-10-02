// src/components/adminLeagueSplitTabs.tsx
"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import PlayerInfoPopup from "@/components/playerInfoPopup";
import { DIVISIONS } from "@/lib/divisions";
import type { TeamLite, RosterRow, PlayerTeam, PlayerInfo } from "@/types/domain";

type Props = {
  leagueId: string;
  teams: TeamLite[];
  roster: RosterRow[];
  playerTeamsByUser?: Record<string, PlayerTeam[]>;
};

type TabKey = "teams" | "roster";

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
    dob: "05/21/1990",
    emergencyName: "Spouse",
    emergencyPhone: "(989) 888-9988",
  };
}

export default function AdminLeagueSplitTabs({
  leagueId,
  teams,
  roster,
  playerTeamsByUser,
}: Props) {
  const [tab, setTab] = useState<TabKey>("teams");

  // popup state
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
      const contact = fakeContact(row.displayName);
      const leagueName =
        (DIVISIONS.find((d) => d.id === (leagueId as any))?.name ?? leagueId) as string;

      const withLeague = (t: Partial<PlayerTeam>): PlayerTeam => ({
        teamId: t.teamId!,
        teamName: t.teamName!,
        isManager: Boolean(t.isManager),
        paid: Boolean(t.paid),
        leagueId: String(leagueId),
        leagueName,
      });

      const teamsForUser: PlayerTeam[] =
        playerTeamsByUser?.[row.userId]?.map(withLeague) ??
        [
          withLeague({
            teamId: row.teamId,
            teamName: row.teamName,
            isManager: row.isManager,
            paid: row.paid,
          }),
        ];

      setPlayer({
        userId: row.userId,
        displayName: row.displayName,
        contact,
        teams: teamsForUser,
      });

      setContextTeamId(row.teamId); // <- so modal can prioritize this membership
      setContextPaid(row.paid);     // <- and show the correct PAID/UNPAID chip
      setOpen(true);
    },
    [leagueId, playerTeamsByUser]
  );

  return (
    <section className="card">
      <div className="team-tabs">
        <button
          type="button"
          className={`team-tab ${tab === "teams" ? "is-active" : ""}`}
          onClick={() => setTab("teams")}
        >
          Teams
        </button>
        <button
          type="button"
          className={`team-tab ${tab === "roster" ? "is-active" : ""}`}
          onClick={() => setTab("roster")}
        >
          League Roster
        </button>
      </div>

      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        {tab === "teams" ? (
          <TeamsPane leagueId={leagueId} teams={teams} />
        ) : (
          <RosterPane roster={roster} onView={handleView} />
        )}
      </div>

      <PlayerInfoPopup
        open={open}
        player={player}
        onClose={handleClose}
        contextLeagueId={leagueId}
        contextTeamId={contextTeamId}
        contextPaidOverride={contextPaid}
      />
    </section>
  );
}

/* ========= Teams tab ========= */
function TeamsPane({
  leagueId,
  teams,
}: {
  leagueId: string;
  teams: TeamLite[];
}) {
  const ACTIONS_WIDTH = 420;
  const ACTIONS_MIN_H = 260;
  const COL_GAP = 100;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `1fr ${ACTIONS_WIDTH}px`,
        columnGap: COL_GAP,
        alignItems: "start",
      }}
    >
      <div className="roster-gradient">
        {teams.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No teams yet.
          </p>
        ) : (
          <ul className="roster-list">
            {teams.map((t) => (
              <li key={t.teamId}>
                <div
                  className="player-card"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px,1fr) 140px max-content", // name | status | link
                    columnGap: 24,
                    alignItems: "center",
                  }}
                >
                  {/* Team name */}
                  <span
                    style={{
                      fontFamily: "var(--font-sport), var(--font-body), system-ui",
                      fontWeight: 500,
                      letterSpacing: ".3px",
                      fontSize: 24,
                      lineHeight: 1.1,
                      paddingLeft: 15,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {t.name}
                  </span>

                  {/* Status column — FORCE center */}
                  <div
                    style={{
                      width: "100%",                 // fill the grid cell
                      height: "100%",
                      justifySelf: "center",         // prevent any global justify-self:end
                      textAlign: "initial",          // neutralize text-align from ancestors
                      display: "flex",               // center the badge inside this cell
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span
                      className={`badge ${t.approved ? "badge--ok" : "badge--pending"}`}
                      style={{
                        marginLeft: 0,               // neutralize any global auto margins
                        marginRight: 0,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {t.approved ? "APPROVED" : "PENDING"}
                    </span>
                  </div>

                  {/* View link */}
                  <div style={{ justifySelf: "end" }}>
                    <Link href={`/admin/team/${t.teamId}`} className="card-cta">
                      VIEW TEAM →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside
        className="gradient-card"
        style={{
          width: ACTIONS_WIDTH,
          minHeight: ACTIONS_MIN_H,
          alignSelf: "start",
          justifySelf: "end",
        }}
      >
        <div className="card-inner" style={{ textAlign: "center" }}>
          <h3
            style={{
              margin: "0 0 12px",
              fontFamily: "var(--font-sport), var(--font-body), system-ui",
              fontSize: 32,
              fontWeight: 600,
              color: "var(--navy)",
            }}
          >
            League Actions
          </h3>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Link
              href={`/admin/leagues/${leagueId}/schedule`}
              className="btn btn--primary"
              style={{ width: "100%", maxWidth: 320, justifyContent: "center" }}
            >
              Manage Schedule
            </Link>
            <Link
              href={`/admin/leagues/${leagueId}/results`}
              className="btn btn--primary"
              style={{ width: "100%", maxWidth: 320, justifyContent: "center" }}
            >
              Enter Game Results
            </Link>
            <Link
              href={`/admin/leagues/${leagueId}/announce`}
              className="btn btn--primary"
              style={{ width: "100%", maxWidth: 320, justifyContent: "center" }}
            >
              Send Announcement
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ========= Roster tab ========= */
function RosterPane({
  roster,
  onView,
}: {
  roster: RosterRow[];
  onView: (row: RosterRow) => void;
}) {
  const COL_GAP = 70;

  const col = useMemo(() => {
    if (typeof document === "undefined") {
      return { namePx: 200, teamPx: 160, managerPx: 140, paidPx: 110 };
    }
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    const measure = (txt: string, font: string) => {
      ctx.font = font;
      return Math.ceil(ctx.measureText(txt).width);
    };

    const nameFont = "700 24px var(--font-sport), var(--font-body), system-ui";
    const teamFont = "800 16px var(--font-body), system-ui";
    const metaFont = "700 14px var(--font-body), system-ui";
    const badgeFont = "700 14px var(--font-body), system-ui";

    let namePx = 160;
    let teamPx = 140;

    for (const r of roster) {
      namePx = Math.max(namePx, measure(r.displayName || "", nameFont));
      teamPx = Math.max(teamPx, measure((r.teamName || "").toUpperCase(), teamFont));
    }

    const managerPx = measure("Team Manager", metaFont) + 24;
    const paidPx = Math.max(measure("PAID", badgeFont), measure("UNPAID", badgeFont)) + 28;

    return { namePx, teamPx, managerPx, paidPx };
  }, [roster]);

  return (
    <div className="roster-gradient" style={{ marginTop: 8 }}>
      {roster.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No players yet.
        </p>
      ) : (
        <ul className="roster-list">
          {roster.map((p) => (
            <li key={`${p.teamId}:${p.userId}`}>
              <div
                className="player-card player-card--aligned"
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(200px,1fr) 120px 120px 120px max-content",
                  alignItems: "center",
                  justifyItems: "center",
                }}
              >
                <div
                  style={{
                    justifySelf: "start",
                    fontFamily: "var(--font-sport), var(--font-body), system-ui",
                    fontSize: 24,
                    fontWeight: 500,
                    lineHeight: 1.1,
                    paddingLeft: 15
                  }}
                >
                  {p.displayName}
                </div>

                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 800,
                    color: "var(--navy)",
                    textTransform: "uppercase",
                  }}
                >
                  {p.teamName}
                </div>

                <div style={{ display: "flex", alignItems: "center", minHeight: "24px" }}>
                  {p.isManager ? (
                    <span className="player-meta" title="Team Manager" style={{ whiteSpace: "nowrap" }}>
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="navy" aria-hidden="true" style={{ marginRight: 4 }}>
                        <path d="M3 7l5 4 4-6 4 6 5-4v10H3z" />
                      </svg>
                      Team Manager
                    </span>
                  ) : (
                    <span className="player-meta" style={{ opacity: 0, whiteSpace: "nowrap" }}>
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
                  <button
                    type="button"
                    className="card-cta"
                    aria-label={`View ${p.displayName}`}
                    onClick={() => onView(p)}
                    title={`View ${p.displayName}`}
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
  );
}