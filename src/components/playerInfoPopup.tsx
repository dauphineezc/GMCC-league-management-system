// src/components/playerInfoPopup.tsx
"use client";

import { useEffect, useMemo } from "react";
import type { PlayerInfo } from "@/types/domain";

type Props = {
  open: boolean;
  player: PlayerInfo | null;
  onClose: () => void;
  contextLeagueId?: string;
  contextTeamId?: string;
  contextPaidOverride?: boolean;

  // Optional display overrides (used by super admin “Admins” popup)
  itemsLabel?: string;   // e.g. "Leagues"
  showPaid?: boolean;    // hide PAID/UNPAID
  columns?: 1 | 2;       // 1 = single column list
};

export default function PlayerInfoPopup({
  open,
  player,
  onClose,
  contextLeagueId,
  contextTeamId,
  contextPaidOverride,
  itemsLabel,
  showPaid,
  columns,
}: Props) {
  const label = itemsLabel ?? "Teams";
  const showPaidBadge = showPaid !== false;    // default: true
  const cols = columns ?? 2;                   // default: 2 (Team | League)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const teamsOrdered = useMemo(() => {
    const teams = player?.teams ?? [];
    if (!contextTeamId && !contextLeagueId) return teams;

    const score = (t: any) =>
      (t.teamId === contextTeamId ? 2 : 0) + (t.leagueId === contextLeagueId ? 1 : 0);

    return [...teams].sort((a, b) => score(b) - score(a));
  }, [player?.teams, contextTeamId, contextLeagueId]);

  if (!open || !player) return null;

  return (
    <div
      className="popup-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="player-popup" role="document">
        {/* Header */}
        <div className="player-popup__header">
          <h3 className="player-popup__name">{player.displayName}</h3>
          <button className="player-popup__close" onClick={onClose} aria-label="Close" title="Close">×</button>
        </div>

        {/* Body */}
        <div className="player-popup__body">
          {/* Contact */}
          <div className="player-popup__contact">
            <div><div className="contact-label">DOB</div><div className="contact-val">{player.contact.dob}</div></div>
            <div><div className="contact-label">Emergency Contact</div><div className="contact-val">{player.contact.emergencyName}</div></div>
            <div><div className="contact-label">Phone</div><div className="contact-val">{player.contact.phone}</div></div>
            <div><div className="contact-label">Emergency Phone</div><div className="contact-val">{player.contact.emergencyPhone}</div></div>
            <div><div className="contact-label">Email</div><div className="contact-val">{player.contact.email}</div></div>
          </div>

          {/* Teams / Leagues */}
          <div className="player-popup__teams">
            <h4 className="player-popup__teams-title" style={{ margin: "15px 0 3px" }} >{label}:</h4>

            {teamsOrdered.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No teams found.</p>
            ) : (
              <div className="space-y-2">
                {teamsOrdered.map((t, idx) => {
                  const isContext =
                    (!!contextTeamId && t.teamId === contextTeamId) ||
                    (!!contextLeagueId && t.leagueId === contextLeagueId);

                  const paid = isContext && typeof contextPaidOverride === "boolean"
                    ? contextPaidOverride
                    : Boolean(t.paid);

                  // Row: either 1 column (e.g. "Leagues") or 2 columns (Team | League + PAID)
                  return (
                    <div
                      key={`${t.teamId ?? t.leagueId ?? idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: cols === 1 ? "1fr" : "1fr 1fr",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      {/* Left cell: Team (or single label when cols === 1) */}
                      <div className="mini-card" style={{ textAlign: "left" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: ".02em",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={cols === 1 ? (t.leagueName ?? t.teamName) : (t.teamName ?? t.leagueName)}
                        >
                          {cols === 1 ? (t.leagueName ?? t.teamName) : (t.teamName ?? t.leagueName)}
                        </div>
                      </div>

                      {/* Right cell: League + PAID (only when 2-column mode) */}
                      {cols !== 1 && (
                        <div
                          className="mini-card"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 10,
                            textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700,
                              textTransform: "uppercase",
                              letterSpacing: ".02em",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                            title={t.leagueName ?? ""}
                          >
                            {t.leagueName ?? ""}
                          </div>

                          {showPaidBadge && (
                            <span
                              className={`badge ${paid ? "badge--ok" : "badge--pending"}`}
                              style={{ whiteSpace: "nowrap" }}
                              title={paid ? "PAID" : "UNPAID"}
                            >
                              {paid ? "PAID" : "UNPAID"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}