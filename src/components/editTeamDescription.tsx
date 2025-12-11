"use client";

import { useState } from "react";

export default function EditTeamDescription({
  teamId,
  initialDescription,
  onSave,
}: {
  teamId: string;
  initialDescription?: string;
  onSave?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [description, setDescription] = useState(initialDescription || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/teams/${teamId}/description`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update description");
      }

      setIsEditing(false);
      if (onSave) {
        onSave();
      }
      // Refresh the page to show updated description
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDescription(initialDescription || "");
    setIsEditing(false);
    setError("");
  };

  if (!isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {initialDescription ? (
          <p style={{ margin: 0, fontSize: 16, color: 'var(--text)' }}>
            {initialDescription}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 16, color: 'var(--text)', fontStyle: "italic" }}>
            No description yet.
          </p>
        )}
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="icon-btn icon-btn--edit"
          style={{ 
            width: '28px',
            height: '28px',
            flexShrink: 0
          }}
          title="Edit description"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="card--soft" style={{ padding: 16 }}>
      <label htmlFor="team-description" style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "var(--navy)" }}>
        Team Description
      </label>
      <textarea
        id="team-description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={4}
        className="input"
        style={{
          width: "100%",
          height: "auto",
          minHeight: "100px",
          resize: "vertical",
        }}
        placeholder="Enter a description for your team..."
      />
      
      {error && (
        <div style={{ color: "#c62828", marginTop: 8, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          className="btn btn--outline btn--sm"
          onClick={handleCancel}
          disabled={saving}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

