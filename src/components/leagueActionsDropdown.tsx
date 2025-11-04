"use client";

import { useState } from "react";
import Link from "next/link";

type Props = {
  leagueId: string;
};

export default function LeagueActionsDropdown({ leagueId }: Props) {
  const [open, setOpen] = useState(false);
  const [showFeeModal, setShowFeeModal] = useState(false);

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
          maxWidth: "420px",
          overflow: open ? "visible" : "hidden",
          transition: "max-height 0.3s ease, opacity 0.3s ease",
          opacity: open ? 1 : 0,
        }}
      >
        <div
          className="gradient-card"
          style={{
            marginTop: "12px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <button
              type="button"
              className="btn btn--secondary btn--md"
              onClick={() => {
                setShowFeeModal(true);
                setOpen(false);
              }}
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z"/>
              </svg>
              Set Team Fee
            </button>
            <Link
              href={`/leagues/${leagueId}/schedule`}
              className="btn btn--secondary btn--md"
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 22H5c-1.11 0-2-.9-2-2l.01-14c0-1.1.88-2 1.99-2h1V2h2v2h8V2h2v2h1c1.1 0 2 .9 2 2v6h-2v-2H5v10h7v2zm10.13-5.01l.71-.71c.39-.39.39-1.02 0-1.41l-.71-.71c-.39-.39-1.02-.39-1.41 0l-.71.71 2.12 2.12zm-.71.71l-5.3 5.3H14v-2.12l5.3-5.3 2.12 2.12z"/>
              </svg>
              Manage Schedule
            </Link>
            <Link
              href={`/leagues/${leagueId}/results`}
              className="btn btn--secondary btn--md"
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M620-360q-17 0-28.5-11.5T580-400v-160q0-17 11.5-28.5T620-600h100q17 0 28.5 11.5T760-560v160q0 17-11.5 28.5T720-360H620Zm20-60h60v-120h-60v120Zm-440 60v-100q0-17 11.5-28.5T240-500h80v-40H200v-60h140q17 0 28.5 11.5T380-560v60q0 17-11.5 28.5T340-460h-80v40h120v60H200Zm250-160v-60h60v60h-60Zm0 140v-60h60v60h-60ZM160-160q-33 0-56.5-23.5T80-240v-480q0-33 23.5-56.5T160-800h120v-80h80v80h240v-80h80v80h120q33 0 56.5 23.5T880-720v480q0 33-23.5 56.5T800-160H160Zm0-80h290v-60h60v60h290v-480H510v60h-60v-60H160v480Zm0 0v-480 480Z"/>
              </svg>
              Enter Game Results
            </Link>
            <Link
              href={`/leagues/${leagueId}/sendAnnouncement`}
              className="btn btn--secondary btn--md"
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M720-440v-80h160v80H720Zm48 280-128-96 48-64 128 96-48 64Zm-80-480-48-64 128-96 48 64-128 96ZM200-200v-160h-40q-33 0-56.5-23.5T80-440v-80q0-33 23.5-56.5T160-600h160l200-120v480L320-360h-40v160h-80Zm240-182v-196l-98 58H160v80h182l98 58Zm120 36v-268q27 24 43.5 58.5T620-480q0 41-16.5 75.5T560-346ZM300-480Z"/>
              </svg>
              Send Announcement
            </Link>
            {/* <a
              className="btn btn--secondary btn--md"
              href={`/leagues/${encodeURIComponent(leagueId)}/export.csv`}
              style={{ width: "100%", justifyContent: "center", display: "flex", alignItems: "center", gap: "8px" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Download Roster CSV
            </a> */}
          </div>
        </div>
      </div>

      {/* Team Fee Modal */}
      {showFeeModal && (
        <TeamFeeModal
          leagueId={leagueId}
          onClose={() => setShowFeeModal(false)}
        />
      )}
    </div>
  );
}

/* ---------------- Team Fee Modal Component ---------------- */

function TeamFeeModal({
  leagueId,
  onClose,
}: {
  leagueId: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    // Validate amount
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      setError("Please enter a valid amount");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/leagues/${leagueId}/set-team-fee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountCents: Math.round(amountNum * 100) }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to set team fee");
      }

      setSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontWeight: 400, fontSize: "22px" }}>Set Team Fee</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {!success ? (
            <>
              <p className="modal-description">
                Enter the fee amount that each team must pay. This will be applied to all teams in this league.
              </p>

              <div className="form-field">
                <label htmlFor="amount">Fee Amount ($)</label>
                <input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  disabled={loading}
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button
                  className="btn btn--outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleSubmit}
                  disabled={loading || !amount}
                >
                  {loading ? "Setting..." : "Set Fee"}
                </button>
              </div>
            </>
          ) : (
            <div className="success-message">
              ✅ Team fee has been set successfully! Refreshing...
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          border-radius: 8px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          border-bottom: 1px solid #e0e0e0;
        }

        .modal-header h2 {
          margin: 0;
          font-size: 20px;
        }

        .modal-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }

        .modal-close:hover {
          background: #f0f0f0;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-description {
          margin-bottom: 20px;
          color: #666;
        }

        .form-field {
          margin-bottom: 16px;
        }

        .form-field label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
        }

        .form-field input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-field input:focus {
          outline: none;
          border-color: #4CAF50;
        }

        .form-field input:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .error-message {
          background: #ffebee;
          color: #c62828;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
        }

        .success-message {
          background: #e8f5e9;
          color: #2e7d32;
          padding: 12px;
          border-radius: 4px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}


