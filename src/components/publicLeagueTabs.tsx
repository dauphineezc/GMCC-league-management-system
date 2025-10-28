// /components/publicLeagueTabs.tsx
"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import type { Sport } from "@/types/domain";

type LeagueLite = {
  id: string;
  name: string;
  sport: Sport;
};

export default function PublicLeagueTabs({
  leagues,
  defaultTab = "basketball",
}: {
  leagues: LeagueLite[];
  defaultTab?: "basketball" | "volleyball";
}) {
  const [tab, setTab] = useState<"basketball" | "volleyball">(defaultTab);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const { basketball, volleyball } = useMemo(() => {
    // normalize sport casing once
    const norm = (s: unknown): Sport =>
      (String(s ?? "").toLowerCase() as Sport);

    const list = (leagues ?? []).map(l => ({
      ...l,
      sport: norm(l.sport),
    }));

    const bb = list
      .filter(l => l.sport === "basketball")
      .sort((a, b) => a.name.localeCompare(b.name));

    const vb = list
      .filter(l => l.sport === "volleyball")
      .sort((a, b) => a.name.localeCompare(b.name));

    return { basketball: bb, volleyball: vb };
  }, [leagues]);

  const list = tab === "basketball" ? basketball : volleyball;

  return (
    <section className="card">
      <div className="team-tabs">
        <button
          type="button"
          className={`team-tab ${tab === "basketball" ? "is-active" : ""}`}
          onClick={() => setTab("basketball")}
        >
          Basketball
        </button>
        <button
          type="button"
          className={`team-tab ${tab === "volleyball" ? "is-active" : ""}`}
          onClick={() => setTab("volleyball")}
        >
          Volleyball
        </button>
      </div>

      <div className="pad-card-sides" style={{ paddingTop: 14 }}>
        {!mounted ? (
          <p className="muted" style={{ margin: 0 }}>Loading leagues...</p>
        ) : list.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No leagues available yet.</p>
        ) : (
          <div>
            {list.map((lg, idx) => (
              <div
                key={lg.id}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  padding: "12px 8px",
                  borderTop: idx === 0 ? "none" : "1px solid #f3f4f6",
                }}
              >
                <span style={{ 
                  fontWeight: 500,
                  fontSize: 20,
                  lineHeight: 1.2,
                  color: "var(--navy)",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {lg.name}
                </span>
                <Link 
                  href={`/leagues/${lg.id}`} 
                  className="card-cta"
                  style={{
                    fontSize: "12px",
                    flexShrink: 0,
                    marginLeft: "12px",
                  }}
                >
                  VIEW LEAGUE →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}