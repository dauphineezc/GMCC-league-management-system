"use client";

import { useState } from "react";

type InviteModalType = "link" | "code";

type InviteDeliveryChannel = { attempted: boolean; sent: boolean; error?: string };
type InviteResult = {
  token?: string;
  code?: string;
  expiresIn?: number;
  delivery?: {
    email: InviteDeliveryChannel;
    // sms: InviteDeliveryChannel;
  };
};

export default function InviteModal({
  type,
  teamId,
  onClose,
}: {
  type: InviteModalType;
  teamId: string;
  teamName?: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  // const [phone, setPhone] = useState('');
  const [ttlHours, setTtlHours] = useState(24);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [error, setError] = useState("");
  const hasContact = Boolean(email.trim() /* || phone.trim() */);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId,
          type,
          ttlHours,
          email: email.trim() || undefined,
          // phone: phone.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to create invite");
      }

      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const inviteLink = result?.token
    ? `${window.location.origin}/join?t=${result.token}`
    : "";

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      alert("Copied to clipboard!");
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ fontWeight: 400, fontSize: "22px" }}>
            {type === "link" ? "Generate Invite Link" : "Generate Invite Code"}
          </h2>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!result ? (
            <>
              <p className="modal-description">
                {type === "link"
                  ? "Generate a one-time invite link. The invitee will be automatically added to the team when they click the link."
                  : "Generate a shareable code. The invitee must have an account and enter this code on their home page."}{" "}
                If you enter an email, we&apos;ll send it automatically. You can still copy it afterward.
              </p>

              <div className="form-field">
                <label htmlFor="email">Email (optional — we&apos;ll send the invite)</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="invitee@example.com"
                />
              </div>

              <div className="form-field">
                <label htmlFor="ttl">Expires in</label>
                <select
                  id="ttl"
                  value={ttlHours}
                  onChange={(e) => setTtlHours(Number(e.target.value))}
                >
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours (recommended)</option>
                  <option value={48}>48 hours</option>
                </select>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button
                  className="btn btn--outline btn--sm"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary btn--sm"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading
                    ? hasContact
                      ? "Sending..."
                      : "Generating..."
                    : hasContact
                      ? "Generate & send"
                      : "Generate"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="success-message">
                ✅ {type === "link" ? "Invite link" : "Invite code"} generated successfully!
                <br />
                Expires in {result.expiresIn} hours.
              </div>

              {result.delivery && result.delivery.email.attempted && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  {result.delivery.email.sent ? (
                    <div className="info-message">📧 Sent to {email.trim()}</div>
                  ) : (
                    <div className="error-message" style={{ marginBottom: 0 }}>
                      Couldn&apos;t email {email.trim()}
                      {result.delivery.email.error ? `: ${result.delivery.email.error}` : "."} You
                      can still copy the {type === "link" ? "link" : "code"} below.
                    </div>
                  )}
                </div>
              )}

              {type === "link" && inviteLink && (
                <div className="form-field">
                  <label>Invite Link</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="text" value={inviteLink} readOnly style={{ flex: 1 }} />
                    <button
                      className="btn btn--outline btn--sm"
                      onClick={() => copyToClipboard(inviteLink)}
                    >
                      Copy
                    </button>
                  </div>
                  <small style={{ color: "var(--muted)", marginTop: 4 }}>
                    Share this link with the person you want to invite. It&apos;s a one-time use
                    link.
                  </small>
                </div>
              )}

              {type === "code" && result.code && (
                <div className="form-field">
                  <label>Invite Code</label>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <code
                      style={{
                        fontSize: 24,
                        fontWeight: "bold",
                        padding: 12,
                        background: "var(--bg-secondary, #f5f5f5)",
                        borderRadius: 4,
                        flex: 1,
                        textAlign: "center",
                        letterSpacing: 2,
                      }}
                    >
                      {result.code}
                    </code>
                    <button
                      className="btn btn--outline btn--sm"
                      onClick={() => copyToClipboard(result.code!)}
                    >
                      Copy
                    </button>
                  </div>
                  <small style={{ color: "var(--muted)", marginTop: 4 }}>
                    Share this code with the person you want to invite. They must enter it on their
                    home page.
                  </small>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn--primary" onClick={onClose}>
                  Done
                </button>
              </div>
            </>
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

        .form-field input,
        .form-field select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-field input:focus,
        .form-field select:focus {
          outline: none;
          border-color: #4caf50;
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
          margin-bottom: 16px;
        }

        .info-message {
          background: #e3f2fd;
          color: #1565c0;
          padding: 12px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
