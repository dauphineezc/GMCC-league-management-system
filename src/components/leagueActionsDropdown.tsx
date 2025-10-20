"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  leagueId: string;
};

export default function LeagueActionsDropdown({ leagueId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="league-actions-dropdown" style={{ marginBottom: "16px" }}>
      <button
        type="button"
        className="league-actions-toggle"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          backgroundColor: "var(--navy)",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "16px",
          fontWeight: 600,
          fontFamily: "var(--font-body), system-ui",
          transition: "all 0.2s ease",
        }}
      >
        {/* Hamburger Icon */}
        {/* <svg 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: "transform 0.2s ease",
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
          }}
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg> */}
        League Actions
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{
            marginLeft: "auto",
            transition: "transform 0.2s ease",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
        </svg>
      </button>

      {/* Dropdown Content */}
      <div
        style={{
          maxHeight: open ? "450px" : "0",
          maxWidth: "400px",
          overflow: "hidden",
          transition: "max-height 0.3s ease, opacity 0.3s ease",
          opacity: open ? 1 : 0,
        }}
      >
        <div
          className="gradient-card"
          style={{
            marginTop: "12px",
            padding: "20px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <Link
              href={`/leagues/${leagueId}/schedule`}
              className="btn btn--primary"
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22H5c-1.11 0-2-.9-2-2l.01-14c0-1.1.88-2 1.99-2h1V2h2v2h8V2h2v2h1c1.1 0 2 .9 2 2v6h-2v-2H5v10h7v2zm10.13-5.01l.71-.71c.39-.39.39-1.02 0-1.41l-.71-.71c-.39-.39-1.02-.39-1.41 0l-.71.71 2.12 2.12zm-.71.71l-5.3 5.3H14v-2.12l5.3-5.3 2.12 2.12z"/>
              </svg>
              Manage Schedule
            </Link>
            <Link
              href={`/leagues/${leagueId}/results`}
              className="btn btn--primary"
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M620-360q-17 0-28.5-11.5T580-400v-160q0-17 11.5-28.5T620-600h100q17 0 28.5 11.5T760-560v160q0 17-11.5 28.5T720-360H620Zm20-60h60v-120h-60v120Zm-440 60v-100q0-17 11.5-28.5T240-500h80v-40H200v-60h140q17 0 28.5 11.5T380-560v60q0 17-11.5 28.5T340-460h-80v40h120v60H200Zm250-160v-60h60v60h-60Zm0 140v-60h60v60h-60ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h120v-80h80v80h240v-80h80v80h120q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h290v-60h60v60h290v-480H510v60h-60v-60H160v480Zm0 0v-480 480Z"/>
              </svg>
              Enter Game Results
            </Link>
            <Link
              href={`/leagues/${leagueId}/sendAnnouncement`}
              className="btn btn--primary"
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 11v2h4v-2h-4zm-2 6.61c.96.71 2.21 1.65 3.2 2.39.4-.53.8-1.07 1.2-1.6-.99-.74-2.24-1.68-3.2-2.4-.4.54-.8 1.08-1.2 1.61zM20.4 5.6c-.4-.53-.8-1.07-1.2-1.6-.99.74-2.24 1.68-3.2 2.4.4.53.8 1.07 1.2 1.6.96-.72 2.21-1.65 3.2-2.4zM4 9c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h3l3.29 3.29c.63.63 1.71.18 1.71-.71V6.41c0-.89-1.08-1.34-1.71-.71L7 9H4zm13.5 3c0-1.33-.58-2.53-1.5-3.35v6.69c.92-.81 1.5-2.01 1.5-3.34z"/>
              </svg>
              Send Announcement
            </Link>
            <a
              className="btn btn--primary"
              href={`/leagues/${encodeURIComponent(leagueId)}/export.csv`}
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Download Roster CSV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

