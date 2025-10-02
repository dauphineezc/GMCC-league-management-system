// /src/components/playerDirectoryClient.tsx
"use client";

import { useMemo, useState } from "react";

export type PlayerRow = { uid: string; email: string; displayName: string };

export default function PlayerDirectoryClient({ initial }: { initial: PlayerRow[] }) {
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return initial;
    return initial.filter(p =>
      p.email.toLowerCase().includes(s) ||
      p.displayName.toLowerCase().includes(s) ||
      p.uid.toLowerCase().includes(s)
    );
  }, [q, initial]);

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <input
          className="border rounded p-2 w-64"
          placeholder="Search name/email/UID…"
          value={q}
          onChange={e=>setQ(e.target.value)}
        />
        <span className="text-sm text-gray-500">{rows.length} of {initial.length}</span>
      </div>

      <div className="rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="py-2 px-3">Name</th>
              <th className="py-2 px-3">Email</th>
              <th className="py-2 px-3">UID</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p.uid} className="border-t">
                <td className="py-2 px-3">{p.displayName || "—"}</td>
                <td className="py-2 px-3">{p.email || "—"}</td>
                <td className="py-2 px-3 font-mono">{p.uid}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr><td className="py-10 px-3 text-gray-500" colSpan={3}>No matches.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}