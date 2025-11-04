"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { PlayerInfo } from "@/types/domain";

type Props = {
  open: boolean;
  player: PlayerInfo | null;
  onClose: () => void;
  contextLeagueId?: string;
  contextTeamId?: string;
  contextPaidOverride?: boolean;
  itemsLabel?: string;
  showPaid?: boolean;
  columns?: 1 | 2;
};

const FALLBACK_EMAIL = "(no email on file)";

export default function PlayerInfoPopup(props: Props) {
  const {
    open, player, onClose,
    contextLeagueId, contextTeamId, contextPaidOverride,
    itemsLabel, showPaid, columns,
  } = props;

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // lock scroll when open
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    if (open) document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open, mounted]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const showPaidBadge = showPaid !== false;

  // --- email fetch state (unchanged logic) ---
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const uid = (player as any)?.userId ?? (player as any)?.id ?? null;

  useEffect(() => {
    let abort = false;
    setResolvedEmail(null);
    if (!open || !uid) return;
    setEmailLoading(true);

    const url = `/api/users/${encodeURIComponent(uid)}/email` +
      (contextLeagueId ? `?leagueId=${encodeURIComponent(contextLeagueId)}` : "");

    fetch(url)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (!abort) setResolvedEmail(j?.email ?? null); })
      .finally(() => { if (!abort) setEmailLoading(false); });

    return () => { abort = true; };
  }, [open, uid, contextLeagueId]);

  const teamsOrdered = useMemo(() => {
    const teams = player?.teams ?? [];
    if (!contextTeamId && !contextLeagueId) return teams;
    const score = (t: any) =>
      (t.teamId === contextTeamId ? 2 : 0) + (t.leagueId === contextLeagueId ? 1 : 0);
    return [...teams].sort((a, b) => score(b) - score(a));
  }, [player?.teams, contextTeamId, contextLeagueId]);

  if (!open || !player || !mounted) return null;

  const emailToShow =
    resolvedEmail ??
    player.contact?.email ??
    (emailLoading ? "" : FALLBACK_EMAIL);

  const overlay = (
    <div
      className="popup-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",   // center vertically
        justifyContent: "center" // center horizontally
      }}
    >
      <div
        className="player-popup"
        role="document"
        style={{
          // ensure the card itself isn’t translucent-duplicated by GPU layers
          willChange: "auto",
          transform: "translateZ(0)",
        }}
      >
        {/* Header */}
        <div className="player-popup__header">
          <h3 className="player-popup__name">{player.displayName}</h3>
          <button className="player-popup__close" onClick={onClose} aria-label="Close" title="Close">×</button>
        </div>

        {/* Body */}
        <div className="player-popup__body">
          {/* CONTACT: 2-col grid to avoid label/value wrapping */}
          <div
            className="player-popup__contact"
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr",
              columnGap: 12,
              rowGap: 8,
              alignItems: "center",
            }}
          >
            <div className="contact-label">DOB</div>
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>{player.contact.dob || "—"}</div>

            {/* <div className="contact-label">Emergency Contact</div>
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>{player.contact.emergencyName || "—"}</div> */}

            <div className="contact-label">Phone</div>
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>{player.contact.phone || "—"}</div>

            {/* <div className="contact-label">Emergency Phone</div>
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>{player.contact.emergencyPhone || "—"}</div> */}

            <div className="contact-label">Email</div>
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>
              {emailLoading
                ? <span style={{ display:"inline-block", width:"12ch" }}>&nbsp;</span>
                : (emailToShow || "—")}
            </div>
          </div>

          {/* TEAMS / LEAGUES (unchanged) */}
          <div className="player-popup__teams">
            <h4 className="player-popup__teams-title" style={{ margin: "15px 0 3px" }} >
              {itemsLabel ?? "Teams"}:
            </h4>

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
                  return (
                    <div
                      key={`${t.teamId ?? t.leagueId ?? idx}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: (columns ?? 2) === 1 ? "1fr" : "1fr 1fr",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <div className="mini-card" style={{ textAlign: "left" }}>
                        <div
                          style={{
                            fontWeight: 700, textTransform: "uppercase", letterSpacing: ".02em",
                            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                          }}
                          title={(columns ?? 2) === 1 ? (t.leagueName ?? t.teamName) : (t.teamName ?? t.leagueName)}
                        >
                          {(columns ?? 2) === 1 ? (t.leagueName ?? t.teamName) : (t.teamName ?? t.leagueName)}
                        </div>
                      </div>

                      {(columns ?? 2) !== 1 && (
                        <div
                          className="mini-card"
                          style={{
                            display: "flex", alignItems: "center",
                            justifyContent: "space-between", gap: 10, textAlign: "left",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 700, textTransform: "uppercase", letterSpacing: ".02em",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}
                            title={t.leagueName ?? ""}
                          >
                            {t.leagueName ?? ""}
                          </div>

                          {showPaidBadge && (
                            <span className={`badge ${paid ? "badge--ok" : "badge--pending"}`}
                              style={{ whiteSpace: "nowrap" }}
                              title={paid ? "PAID" : "UNPAID"}>
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

  // Render to body to escape transformed ancestors – eliminates flicker
  return createPortal(overlay, document.body);
}