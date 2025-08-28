"use client";
import * as React from "react";

type TabsProps = {
  tabs: Record<string, React.ReactNode>;
  initial?: string;
  labels?: Record<string, string>;
};

export default function Tabs({ tabs, initial, labels }: TabsProps) {
  const keys = Object.keys(tabs);
  const first = initial && keys.includes(initial) ? initial : keys[0];
  const [active, setActive] = React.useState(first);

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => setActive(k)}
            style={{
              padding: "6px 10px",
              border: "1px solid #d1d5db",
              borderRadius: 8,
              background: active === k ? "#f3f4f6" : "white",
              cursor: "pointer",
            }}
            aria-pressed={active === k}
          >
            {labels?.[k] ?? k}
          </button>
        ))}
      </div>
      <div>{tabs[active]}</div>
    </div>
  );
}