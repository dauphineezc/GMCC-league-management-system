// src/components/superPlayerList.tsx

"use client";

import { useCallback, useMemo, useState } from "react";
import PlayerInfoPopup from "@/components/playerInfoPopup";
import type { RosterRow, PlayerTeam, PlayerInfo } from "@/types/domain";

type Props = {
  roster: RosterRow[];
  /** mapping of userId -> all teams they’re on (so the popup can show all) */
  playerTeamsByUser: Record<string, PlayerTeam[]>;
};

/**
 * Super admin roster list:
 * - One row per *player* (deduped by userId)
 * - No team or manager columns
 * - Name column left-aligned and font-size auto-reduced for long names
 */
export default function SuperPlayerList({ roster, playerTeamsByUser }: Props) {
  // collapse to unique players, keep "paid" if true for any membership
  const players = useMemo(() => {
    const m = new Map<string, { userId: string; displayName: string; paid: boolean }>();
    for (const r of roster) { 
      const prev = m.get(r.userId);
      const paid = Boolean(r.paid) || Boolean(prev?.paid);
      if (!prev) {
        m.set(r.userId, { userId: r.userId, displayName: r.displayName, paid });
      } else {
        // prefer a longer non-empty displayName, but keep paid=true if ever true
        const betterName =
          (r.displayName || "").length > (prev.displayName || "").length
            ? r.displayName
            : prev.displayName;
        m.set(r.userId, { userId: r.userId, displayName: betterName, paid });
      }
    }
    return Array.from(m.values()).sort((a, b) =>
      a.displayName.localeCompare(b.displayName)
    );
  }, [roster]);

  // popup state
  const [open, setOpen] = useState(false);
  const [player, setPlayer] = useState<PlayerInfo | null>(null);

  const handleClose = useCallback(() => {
    setOpen(false);
    setPlayer(null);
  }, []);

  const handleView = useCallback(
    (row: { userId: string; displayName: string }) => {
      const teams = playerTeamsByUser[row.userId] ?? [];
      setPlayer({
        userId: row.userId,
        displayName: row.displayName,
        // keep using placeholder contact; if you have real contact, plug it here
        contact: {
          email: "",
          phone: "",
          dob: "",
          emergencyName: "",
          emergencyPhone: "",
        },
        teams,
      });
      setOpen(true);
    },
    [playerTeamsByUser]
  );

  return (
    <section className="card">
      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        <div className="roster-gradient" style={{ marginTop: 8 }}>
          {players.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No players yet.
            </p>
          ) : (
            <ul className="roster-list">
              {players.map((p) => {
                // shrink font for long names to avoid multi-line wrapping
                const len = (p.displayName || "").length;
                const fontSize =
                  len > 30 ? 18 : len > 22 ? 20 : 24; // tweak thresholds if you like

                return (
                  <li key={p.userId}>
                    <div
                        className="player-card player-card--aligned"
                        style={{
                        // force left alignment regardless of the base card CSS
                        display: "grid",
                        gridTemplateColumns: "minmax(200px,1fr) max-content",
                        alignItems: "center",
                        justifyItems: "start",     // ← keeps the first cell left
                        textAlign: "left",         // ← belt + suspenders
                        gap: 24,
                        }}
                    >
                        {/* NAME (flexible, left aligned, single line with ellipsis) */}
                        <div
                        style={{
                            fontFamily: "var(--font-sport), var(--font-body), system-ui",
                            fontWeight: 500,
                            fontSize: 24,
                            lineHeight: 1.1,
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
                            VIEW PLAYER →
                        </button>
                        </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Reuse existing popup with full team context */}
      <PlayerInfoPopup open={open} player={player} onClose={handleClose} />
    </section>
  );
}