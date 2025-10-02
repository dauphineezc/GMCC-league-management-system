// src/app/(superadmin)/superadmin/teams/editableLeagueAssignment.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type League = { leagueId: string; name: string };

export default function EditableLeagueAssignment({
  teamId,
  leagues,
  current,
}: {
  teamId: string;
  leagues: League[];
  current?: string | null; // leagueId
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<string>(current ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // if parent updates `current`, sync our state
  useEffect(() => {
    setValue(current ?? "");
  }, [current]);

  const currentLeague = leagues.find(l => l.leagueId === current);
  const displayName = currentLeague?.name || "Unassigned";

  async function save() {
    setErr(null);
    const res = await fetch("/api/superadmin/teams/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ teamId, leagueId: value }), // "" unassigns
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.error || "Failed");
    }
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        await save();
        setIsEditing(false);
        router.refresh();
      } catch (e: any) {
        setErr(e?.message ?? "Failed");
      }
    });
  };

  const handleCancel = () => {
    setValue(current ?? "");
    setIsEditing(false);
    setErr(null);
  };

  const hasCurrentInOptions = value
    ? leagues.some(l => l.leagueId === value)
    : true;

  if (isEditing) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <select
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input"
          style={{ minWidth: 180 }}
          name="leagueId"
          aria-label="Select league"
          title="Select league"
        >
          <option value="">Unassigned</option>

          {/* If the current id isn't in options (e.g., stale list), still show it selected */}
          {!hasCurrentInOptions && value && (
            <option value={value} hidden>
              {value}
            </option>
          )}

          {leagues.map((l) => (
            <option key={l.leagueId} value={l.leagueId}>
              {l.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          className="px-2 py-1 text-xs rounded disabled:opacity-50"
          style={{ 
            color: 'var(--navy)',
            border: 'none'
          }}
          disabled={isPending}
          onClick={handleSave}
        >
          {isPending ? 'Saving...' : 'Save'}
        </button>

        <button
          type="button"
          className="px-2 py-1 text-xs rounded disabled:opacity-50"
          style={{ 
            color: 'var(--navy)',
            border: 'none'
          }}
          disabled={isPending}
          onClick={handleCancel}
        >
          Cancel
        </button>

        {err && (
          <span className="subtle-text" style={{ marginLeft: 6, color: "#dc2626" }}>
            {err}
          </span>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span       
      style={{
        justifySelf: "center",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: 16,
        fontWeight: 600,
        color: "var(--navy)",
        textTransform: "uppercase",
      }}>
        {displayName}
      </span>
      <button
        type="button"
        className="p-1 rounded transition-colors"
        style={{ color: 'var(--navy)', backgroundColor: 'transparent', marginLeft: "10px", alignItems: "center" }}
        onClick={() => setIsEditing(true)}
        title="Edit league assignment"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
        </svg>
      </button>
    </div>
  );
}
