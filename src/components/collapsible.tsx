// /src/components/Collapsible.tsx
"use client";

import { useState } from "react";

export default function Collapsible({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        className={`collapsible${open ? " active" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {title} <span style={{ fontSize: "20px", fontWeight: "600" }}>{open ? "−" : "+"}</span>
      </button>

      <div
        className="content"
        style={{
          display: open ? "block" : "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}