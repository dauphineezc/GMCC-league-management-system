"use client";

import { useCallback, useMemo, useState } from "react";
import PlayerInfoPopup from "@/components/playerInfoPopup";
import type { RosterRow, PlayerTeam, PlayerInfo } from "@/types/domain";

type Props = {
  roster: RosterRow[];
  /** userId -> leagues/“teams” this admin manages (from buildAdminRosterLikeRows) */
  adminTeamsByUser: Record<string, PlayerTeam[]>;
};

/**
 * Super Admin → Admins list
 * - One row per admin (deduped by userId)
 * - No team/manager columns
 * - Name column left-aligned; font size auto-reduces for long names
 * - Shows a small "SUPER ADMIN" badge when applicable
 * - Reuses PlayerInfoPopup to show the leagues they manage
 */
export default function SuperAdminsList({ roster, adminTeamsByUser }: Props) {
  const admins = useMemo(() => {
    const m = new Map<
      string,
      { userId: string; displayName: string; isSuper: boolean }
    >();

    for (const r of roster) {
      const prev = m.get(r.userId);
      const teams = adminTeamsByUser[r.userId] ?? [];
      const isSuper =
        teams.some(
          (t) => t.teamId === "all-leagues" || t.leagueId === "all"
        ) || prev?.isSuper === true;

      if (!prev) {
        m.set(r.userId, { userId: r.userId, displayName: r.displayName, isSuper });
      } else {
        // prefer a longer non-empty displayName
        const betterName =
          (r.displayName || "").length > (prev.displayName || "").length
            ? r.displayName
            : prev.displayName;
        m.set(r.userId, { userId: r.userId, displayName: betterName, isSuper });
      }
    }
    return Array.from(m.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [roster, adminTeamsByUser]);

  // popup state
  const [open, setOpen] = useState(false);
  const [admin, setAdmin] = useState<PlayerInfo | null>(null);

  const handleClose = useCallback(() => {
    setOpen(false);
    setAdmin(null);
  }, []);

  const handleView = useCallback(
    (row: { userId: string; displayName: string }) => {
      const teams = adminTeamsByUser[row.userId] ?? [];
      setAdmin({
        userId: row.userId,
        displayName: row.displayName,
        contact: {
          email: "",
          phone: "",
          dob: "",
          emergencyName: "",
          emergencyPhone: "",
        },
        teams, // leagues they manage
      });
      setOpen(true);
    },
    [adminTeamsByUser]
  );

  return (
    <section>
      {admins.length === 0 ? (
        <p className="muted" style={{ margin: 0 }}>
          No admins yet.
        </p>
      ) : (
        <div className="roster-gradient" style={{ marginTop: 8 }}>
          {admins.map((p, idx) => {
            const len = (p.displayName || "").length;
            const fontSize = len > 30 ? 18 : len > 22 ? 20 : 24;

            return (
              <div
                key={p.userId}
                className="player-card--aligned"
                style={{
                  // force left alignment regardless of the base card CSS
                  display: "grid",
                  gridTemplateColumns: "minmax(240px,1fr) max-content",
                  alignItems: "center",
                  justifyItems: "start",     // ← keeps the first cell left
                  textAlign: "left",         // ← belt + suspenders
                  gap: 24,
                  padding: "12px 8px",
                  borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
                }}
              >
                {/* NAME (flexible, left aligned, single line with ellipsis) */}
                <div
                  style={{
                    fontFamily: "var(--font-body), system-ui",
                    fontWeight: 500,
                    fontSize: 20,
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    justifySelf: "start",
                    marginLeft: 15,
                  }}
                  title={p.displayName}
                >
                  {p.displayName}
                </div>

                {/* ACTION (right side) */}
                <div className="col-view" style={{ justifySelf: "end", marginRight: 5 }}>
                  <button className="card-cta" onClick={() => handleView(p)}>
                    VIEW ADMIN →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reuse popup with leagues-as-teams */}
      <PlayerInfoPopup
        open={open}
        player={admin}
        onClose={handleClose}
        itemsLabel="Leagues"   // <<< change title
        showPaid={false}       // <<< hide PAID/UNPAID
        columns={1}            // <<< single column
      />
    </section>
  );
}