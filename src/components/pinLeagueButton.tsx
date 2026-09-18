"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export default function PinLeagueButton({
  leagueId,
  initiallyPinned,
}: {
  leagueId: string;
  initiallyPinned: boolean;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(initiallyPinned);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !pinned;
    setErr(null);
    setPinned(next);
    startTransition(async () => {
      const res = await fetch("/api/superadmin/pins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ leagueId, pinned: next }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPinned(!next);
        setErr(j?.error || "Failed to update pin");
        return;
      }
      setPinned(Boolean(j.pinned));
      router.refresh();
    });
  }

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 4 }}>
      <button
        type="button"
        className="btn btn--light btn--sm"
        onClick={toggle}
        disabled={isPending}
        title={pinned ? "Unpin from homepage" : "Pin to homepage"}
        aria-pressed={pinned}
      >
        {isPending ? "…" : pinned ? "Unpin from home" : "Pin to home"}
      </button>
      {err && (
        <span className="subtle-text" style={{ color: "#dc2626", fontSize: 12 }}>
          {err}
        </span>
      )}
    </div>
  );
}
