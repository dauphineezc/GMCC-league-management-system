"use client";

import { useMemo, useState } from "react";
import type { Game, RosterEntry } from "@/app/team/[teamId]/page";

type ServerAction = (formData: FormData) => Promise<void>;

type Actions = {
  updateMeta?: ServerAction;
  inviteByEmail?: ServerAction;
  setApproval?: ServerAction;
  markPaid?: ServerAction;
};

export default function TeamTabs(props: {
  teamId: string;
  leagueId: string;
  roster: RosterEntry[];
  games: Game[];
  isMember: boolean;
  isRosterManager: boolean; // roster manager (can edit meta & invite)
  isLeagueAdmin: boolean;   // league admin (can approve & mark paid)
  teamName: string;
  teamDescription: string;
  approved: boolean;
  actions?: Actions;
}) {
  const {
    roster,
    games,
    isMember,
    isRosterManager,
    isLeagueAdmin,
    teamName,
    teamDescription,
    approved,
    actions,
  } = props;

  const [tab, setTab] = useState<"roster" | "schedule" | "history">("roster");

  // segment schedule
  const now = Date.now();
  const { upcoming, history } = useMemo(() => {
    const u: Game[] = [];
    const h: Game[] = [];
    for (const g of games) {
      const when = Date.parse(g.startTime);
      if (isFinite(when) && when >= now) u.push(g);
      else h.push(g);
    }
    u.sort((a, b) => Date.parse(a.startTime) - Date.parse(b.startTime));
    h.sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime));
    return { upcoming: u, history: h };
  }, [games, now]);

  return (
    <section style={card}>
      {/* Tabs header */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid #eee", paddingBottom: 8 }}>
        <TabBtn current={tab} id="roster" setTab={setTab}>Roster</TabBtn>
        <TabBtn current={tab} id="schedule" setTab={setTab}>Schedule</TabBtn>
        <TabBtn current={tab} id="history" setTab={setTab}>Game History</TabBtn>
      </div>

      {/* Panels */}
      <div style={{ paddingTop: 12 }}>
        {tab === "roster" && (
          <>
            {/* ADMIN controls: approve/unapprove */}
            {isLeagueAdmin && actions?.setApproval && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className={approved ? "badge badge--ok" : "badge badge--pending"}>
                  {approved ? "Approved" : "Pending Approval"}
                </span>
                <form action={actions.setApproval} style={{ display: "inline-flex", gap: 8 }}>
                  <input type="hidden" name="approved" value={(!approved).toString()} />
                  <button className="btn btn--outline">
                    {approved ? "Unapprove Team" : "Approve Team"}
                  </button>
                </form>
              </div>
            )}

            {/* Roster list with admin "mark paid" */}
            {roster.length === 0 ? (
              <p>No players yet.</p>
            ) : (
              <ul style={{ paddingLeft: 16, listStyle: "disc" }}>
                {roster.map((p) => (
                  <li key={p.userId} style={{ margin: "10px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                      <div>
                        <strong>{p.displayName || p.userId}</strong>{" "}
                        {p.isManager ? "⭐ (Manager)" : ""}
                        {" "}
                        {typeof p.paid === "boolean" && (
                          <span className="badge" style={{ marginLeft: 6, background: p.paid ? "#EAF7EE" : "#FFF3E6", color: p.paid ? "#1B7D3E" : "#9B4B00" }}>
                            {p.paid ? "Paid" : "Unpaid"}
                          </span>
                        )}
                      </div>

                      {isLeagueAdmin && actions?.markPaid && (
                        <form action={actions.markPaid}>
                          <input type="hidden" name="userId" value={p.userId} />
                          <input type="hidden" name="paid" value={(!(p.paid ?? false)).toString()} />
                          <button className="btn btn--outline">
                            Mark {p.paid ? "Unpaid" : "Paid"}
                          </button>
                        </form>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Guest notice */}
            {!isMember && !isRosterManager && !isLeagueAdmin && (
              <p style={{ color: "#6b7280", marginTop: 8 }}>
                You’re viewing as a guest; payment and invites are hidden.
              </p>
            )}

            {/* MANAGER controls: team meta + invite */}
            {isRosterManager && (
              <>
                <hr style={{ border: 0, borderTop: "1px solid #eee", margin: "16px 0" }} />

                <details>
                  <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>
                    Team Settings
                  </summary>
                  <div style={{ marginTop: 12 }}>
                    <form action={actions?.updateMeta} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
                      <label style={lbl}>
                        <span>Team Name</span>
                        <input name="name" defaultValue={teamName} style={inp} />
                      </label>
                      <label style={lbl}>
                        <span>Description</span>
                        <textarea name="description" defaultValue={teamDescription} rows={3} style={ta} />
                      </label>
                      <div><button className="btn btn--primary">Save</button></div>
                    </form>
                  </div>
                </details>

                <details style={{ marginTop: 14 }}>
                  <summary style={{ cursor: "pointer", fontWeight: 800, color: "var(--navy)" }}>
                    Invite Player
                  </summary>
                  <div style={{ marginTop: 12 }}>
                    <form action={actions?.inviteByEmail} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <input name="email" type="email" required placeholder="player@email.com" style={inp} />
                      <button className="btn btn--outline">Send invite</button>
                    </form>
                  </div>
                </details>
              </>
            )}
          </>
        )}

        {tab === "schedule" && (
          <>
            {upcoming.length === 0 ? (
              <p>No upcoming games.</p>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Matchup</th>
                    <th style={th}>Location</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((g) => (
                    <tr key={g.id}>
                      <td style={td}>{fmtDate(g.startTime)}</td>
                      <td style={td}>{g.homeTeamName} vs {g.awayTeamName}</td>
                      <td style={td}>{g.location || "TBD"}</td>
                      <td style={td}>{g.status || "scheduled"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            {history.length === 0 ? (
              <p>No games played yet.</p>
            ) : (
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Date</th>
                    <th style={th}>Matchup</th>
                    <th style={th}>Result</th>
                    <th style={th}>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((g) => (
                    <tr key={g.id}>
                      <td style={td}>{fmtDate(g.startTime)}</td>
                      <td style={td}>{g.homeTeamName} vs {g.awayTeamName}</td>
                      <td style={td}>
                        {g.status === "final" && isFinite(g.homeScore ?? NaN) && isFinite(g.awayScore ?? NaN)
                          ? `${g.homeScore}-${g.awayScore}`
                          : "—"}
                      </td>
                      <td style={td}>{g.location || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/* ---------------- UI helpers ---------------- */

function TabBtn({
  current,
  id,
  setTab,
  children,
}: {
  current: string;
  id: "roster" | "schedule" | "history";
  setTab: (t: "roster" | "schedule" | "history") => void;
  children: React.ReactNode;
}) {
  const active = current === id;
  return (
    <button
      onClick={() => setTab(id)}
      className="btn"
      style={{
        padding: "6px 10px",
        borderRadius: 8,
        border: active ? "1px solid #111827" : "1px solid #e5e7eb",
        background: active ? "#111827" : "white",
        color: active ? "white" : "black",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

/* ---------------- styles ---------------- */
const card: React.CSSProperties = { border: "1px solid #eee", borderRadius: 12, padding: 16 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse" };
const th: React.CSSProperties = { textAlign: "left", fontWeight: 600, padding: "8px 6px", borderBottom: "1px solid #e5e7eb" };
const td: React.CSSProperties = { padding: "8px 6px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" };

const lbl: React.CSSProperties = { display: "grid", gap: 6 };
const inp: React.CSSProperties = { padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, minWidth: 260 };
const ta: React.CSSProperties = { padding: 10, border: "1px solid #e5e7eb", borderRadius: 8, minWidth: 260 };