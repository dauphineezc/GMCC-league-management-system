// src/app/(superadmin)/superadmin/teams/assignTeam.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type League = { leagueId: string; name: string };

export default function AssignTeam({
  teamId,
  leagues,
  current,
  selectStyle,
  selectClassName,
  buttonStyle,
  buttonClassName,
  gap = 8,
}: {
  teamId: string;
  leagues: League[];
  current?: string | null; // leagueId
  selectStyle?: React.CSSProperties;
  selectClassName?: string;
  buttonStyle?: React.CSSProperties;
  buttonClassName?: string;
  gap?: number;
}) {
  const router = useRouter();

  // controlled: keep a string always ("" means unassigned)
  const [value, setValue] = useState<string>(current ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // if parent updates `current`, sync our state
  useEffect(() => {
    setValue(current ?? "");
  }, [current]);

  const disabled = isPending || value === (current ?? "");

  async function assign() {
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

  const CONTROL: React.CSSProperties = {
    minWidth: 180,
  };

  const hasCurrentInOptions = value
    ? leagues.some(l => l.leagueId === value)
    : true;

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap }}>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={selectClassName ?? "input"}
        style={{ ...CONTROL, ...selectStyle }}
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
        className={buttonClassName ?? "btn btn--outline btn--sm"}
        style={buttonStyle}
        disabled={disabled}
        onClick={() =>
          startTransition(async () => {
            try {
              await assign();
              router.refresh();
            } catch (e: any) {
              setErr(e?.message ?? "Failed");
            }
          })
        }
      >
        {isPending ? "Assigning…" : "Assign"}
      </button>

      {err && (
        <span className="subtle-text" style={{ marginLeft: 6, color: "#dc2626" }}>
          {err}
        </span>
      )}
    </div>
  );
}