// src/components/leagueTabs.tsx
"use client";

import { useState } from "react";

type Key = "teams" | "schedule" | "history" | "standings";

export default function LeagueTabs({
  initial,
  labels,
  tabs,
}: {
  initial: Key;
  labels: Record<Key, string>;
  tabs: Record<Key, React.ReactNode>;
}) {
  const [tab, setTab] = useState<Key>(initial);

  return (
    <section className="card">
      <div className="team-tabs">
        {(Object.keys(labels) as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`team-tab ${tab === k ? "is-active" : ""}`}
            onClick={() => setTab(k)}
          >
            {labels[k]}
          </button>
        ))}
      </div>

      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        {tabs[tab]}
      </div>
    </section>
  );
}