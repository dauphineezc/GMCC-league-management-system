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

  // --- contact fetch (email / phone / dob) ---
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(null);
  const [resolvedPhone, setResolvedPhone] = useState<string | null>(null);
  const [resolvedDob, setResolvedDob] = useState<string | null>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [contactLoading, setContactLoading] = useState(false);
  const uid = (player as any)?.userId ?? (player as any)?.id ?? null;

  useEffect(() => {
    let abort = false;
    setResolvedEmail(null);
    setResolvedPhone(null);
    setResolvedDob(null);
    if (!open || !uid) return;

    const leagueQs = contextLeagueId
      ? `?leagueId=${encodeURIComponent(contextLeagueId)}`
      : "";

    setEmailLoading(true);
    setContactLoading(true);

    fetch(`/api/users/${encodeURIComponent(uid)}/email${leagueQs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!abort) setResolvedEmail(j?.email ?? null);
      })
      .finally(() => {
        if (!abort) setEmailLoading(false);
      });

    fetch(`/api/users/${encodeURIComponent(uid)}/contact${leagueQs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!abort) {
          setResolvedPhone(typeof j?.phone === "string" ? j.phone : null);
          setResolvedDob(typeof j?.dob === "string" ? j.dob : null);
        }
      })
      .finally(() => {
        if (!abort) setContactLoading(false);
      });

    return () => {
      abort = true;
    };
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

  const phoneToShow =
    resolvedPhone ??
    player.contact?.phone ??
    "";
  const dobRaw =
    resolvedDob ??
    player.contact?.dob ??
    "";
  const dobToShow = (() => {
    if (contactLoading && resolvedDob === null) return "";
    if (!dobRaw) return "—";
    const d = new Date(`${dobRaw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return dobRaw;
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  })();

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
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>
              {contactLoading && resolvedDob === null
                ? <span style={{ display: "inline-block", width: "12ch" }}>&nbsp;</span>
                : dobToShow}
            </div>

            {/* <div className="contact-label">Emergency Contact</div>
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>{player.contact.emergencyName || "—"}</div> */}

            <div className="contact-label">Phone</div>
            <div className="contact-val" style={{ minHeight: "1.25rem" }}>
              {contactLoading && resolvedPhone === null
                ? <span style={{ display: "inline-block", width: "12ch" }}>&nbsp;</span>
                : (phoneToShow || "—")}
            </div>

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
              <div
                className={
                  teamsOrdered.length > 5
                    ? "player-popup__teams-list player-popup__teams-list--scroll"
                    : "player-popup__teams-list"
                }
              >
                {teamsOrdered.map((t, idx) => {
                  const singleCol = (columns ?? 2) === 1;
                  const primaryName = singleCol
                    ? (t.leagueName ?? t.teamName)
                    : (t.teamName ?? t.leagueName);
                  const leagueName = t.leagueName ?? "";
                  const isContext =
                    (!!contextTeamId && t.teamId === contextTeamId) ||
                    (!!contextLeagueId && t.leagueId === contextLeagueId);
                  const paid = isContext && typeof contextPaidOverride === "boolean"
                    ? contextPaidOverride
                    : Boolean(t.paid);
                  return (
                    <div
                      key={`${t.teamId ?? t.leagueId ?? idx}`}
                      className="player-popup__teamrow"
                    >
                      <div className="teamrow-names">
                        <div className="teamrow-team" title={primaryName ?? ""}>
                          {primaryName}
                        </div>
                        {!singleCol && leagueName && (
                          <div className="teamrow-league" title={leagueName}>
                            {leagueName}
                          </div>
                        )}
                      </div>

                      {!singleCol && showPaidBadge && (
                        <div className="teamrow-badge">
                          <span
                            className={`badge ${paid ? "badge--ok" : "badge--pending"}`}
                            style={{ whiteSpace: "nowrap" }}
                            title={paid ? "PAID" : "UNPAID"}
                          >
                            {paid ? "PAID" : "UNPAID"}
                          </span>
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