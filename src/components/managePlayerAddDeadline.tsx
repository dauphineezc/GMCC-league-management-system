"use client";

import { useState, useEffect } from "react";

export default function ManagePlayerAddDeadline({
  leagueId,
}: {
  leagueId: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  
  const [currentDeadline, setCurrentDeadline] = useState<string | null>(null);
  const [currentOverride, setCurrentOverride] = useState(false);
  
  const [deadlineInput, setDeadlineInput] = useState("");
  const [overrideInput, setOverrideInput] = useState(false);

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(`/api/leagues/${leagueId}/player-add-deadline`);
        if (response.ok) {
          const data = await response.json();
          setCurrentDeadline(data.playerAddDeadline);
          setCurrentOverride(data.playerAddDeadlineOverride || false);
          
          // Pre-fill inputs
          if (data.playerAddDeadline) {
            // Convert ISO string to date input format (YYYY-MM-DD)
            const date = new Date(data.playerAddDeadline);
            setDeadlineInput(date.toISOString().split('T')[0]);
          }
          setOverrideInput(data.playerAddDeadlineOverride || false);
        }
      } catch (err) {
        console.error("Failed to fetch deadline settings:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSettings();
  }, [leagueId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");

    try {
      // Convert date input to ISO string
      let deadlineISO: string | null = null;
      if (deadlineInput) {
        const date = new Date(deadlineInput);
        // Set to end of day in local timezone
        date.setHours(23, 59, 59, 999);
        deadlineISO = date.toISOString();
      }

      const response = await fetch(`/api/leagues/${leagueId}/player-add-deadline`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerAddDeadline: deadlineISO,
          playerAddDeadlineOverride: overrideInput,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update deadline");
      }

      setCurrentDeadline(data.playerAddDeadline);
      setCurrentOverride(data.playerAddDeadlineOverride);
      setIsEditing(false);
      
      // Refresh page to update any cached data
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    const confirmed = confirm("Are you sure you want to remove the player add deadline? Team managers will be able to invite players at any time.");
    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/leagues/${leagueId}/player-add-deadline`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to clear deadline");
      }

      setCurrentDeadline(null);
      setCurrentOverride(false);
      setDeadlineInput("");
      setOverrideInput(false);
      setIsEditing(false);
      
      // Refresh page to update any cached data
      window.location.reload();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (currentDeadline) {
      const date = new Date(currentDeadline);
      setDeadlineInput(date.toISOString().split('T')[0]);
    } else {
      setDeadlineInput("");
    }
    setOverrideInput(currentOverride);
    setIsEditing(false);
    setError("");
  };

  if (loading) {
    return (
      <div className="card--soft" style={{ padding: 16, maxWidth: 720 }}>
        <div style={{ color: "#666" }}>Loading...</div>
      </div>
    );
  }

  // Determine if deadline has passed
  const deadlinePassed = currentDeadline && new Date(currentDeadline) < new Date();
  const isLocked = deadlinePassed && !currentOverride;

  if (!isEditing) {
    return (
      <div className="card--soft" style={{ padding: 16, maxWidth: 720 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, marginBottom: 8, fontSize: 16, fontWeight: 600, color: "var(--navy)" }}>
              Player Add Deadline
            </h3>
            
            {currentDeadline ? (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <strong style={{ color: "var(--navy)" }}>Deadline:</strong>{" "}
                  {new Date(currentDeadline).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                  {deadlinePassed && (
                    <span style={{ 
                      marginLeft: 8, 
                      padding: "2px 8px", 
                      borderRadius: 4, 
                      fontSize: 12, 
                      fontWeight: 600,
                      backgroundColor: isLocked ? "#FFF3E6" : "#EAF7EE",
                      color: isLocked ? "#ec720e" : "var(--green)"
                    }}>
                      {isLocked ? "LOCKED" : "UNLOCKED"}
                    </span>
                  )}
                </div>
                {deadlinePassed && (
                  <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                    {isLocked 
                      ? "⚠️ Team managers cannot invite new players (deadline passed)"
                      : "✅ Override active: Team managers can still invite players"
                    }
                  </div>
                )}
                {!deadlinePassed && (
                  <div style={{ fontSize: 14, color: "#666", marginBottom: 8 }}>
                    After this date, team managers will not be able to invite new players.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 14, color: "#666", fontStyle: "italic" }}>
                No deadline set. Team managers can invite players at any time.
              </div>
            )}
          </div>
          
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn--outline btn--sm"
            >
              {currentDeadline ? "Edit" : "Set Deadline"}
            </button>
            {currentDeadline && (
              <button
                type="button"
                onClick={handleClear}
                className="btn btn--outline btn--sm"
                disabled={saving}
                style={{ color: "#c62828" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card--soft" style={{ padding: 16, maxWidth: 720 }}>
      <h2 style={{ fontWeight: 400, fontSize: "22px" }}>
        Set Add Player Deadline
      </h2>
      
      <div style={{ marginBottom: 16 }}>
        <label htmlFor="deadline-date" style={{ display: "block", marginBottom: 8, fontWeight: 500, color: "var(--navy)" }}>
          Deadline Date
        </label>
        <input
          type="date"
          id="deadline-date"
          value={deadlineInput}
          onChange={(e) => setDeadlineInput(e.target.value)}
          className="input"
          style={{ maxWidth: 240 }}
          min={new Date().toISOString().split('T')[0]}
        />
        <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
          After this date, team managers will not be able to invite new players.
        </div>
      </div>

      {deadlinePassed && (
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: "#FFF3E6", borderRadius: 4 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={overrideInput}
              onChange={(e) => setOverrideInput(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            <span style={{ fontWeight: 500, color: "var(--navy)" }}>
              Override deadline (allow adding players after deadline)
            </span>
          </label>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4, marginLeft: 26 }}>
            Use this for special circumstances when players need to be added late in the season.
          </div>
        </div>
      )}

      {error && (
        <div style={{ color: "#c62828", marginBottom: 12, fontSize: 14 }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          className="btn btn--primary btn--sm"
          onClick={handleSave}
          disabled={saving || !deadlineInput}
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

