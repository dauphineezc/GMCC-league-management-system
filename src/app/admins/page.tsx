// Admins Page (Superadmin Only)
export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import { buildAdminRosterLikeRows } from "@/lib/rosterAggregate";
import SuperAdminsList from "@/components/superAdminList";
import type { CSSProperties } from "react";

export default async function AdminsPage({
  searchParams,
}: {
  searchParams: { displayName?: string };
}) {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) notFound(); // Only superadmins can access

  const { roster, playerTeamsByUser } = await buildAdminRosterLikeRows();

  const uniqueCount = new Set(roster.map((r) => r.userId)).size;

    // Apply search
    const q = (searchParams.displayName ?? "").trim().toLowerCase();
    const filteredRows = q
      ? roster.filter((r) => r.displayName.toLowerCase().includes(q))
      : roster;
  
    // ✅ Deduplicate by userId so counts and list match (unique admins) 
    const uniqByUser = Array.from(
      new Map(filteredRows.map((r) => [r.userId, r])).values()
    );
  
    const CONTROL: CSSProperties = { minWidth: 160 };
    const hasFilters = Boolean(q);
    const resultCount = uniqByUser.length;

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title" style={{ marginBottom: 0 }}>Admins</h1>

      <a className="btn btn--outline" href="/export/admins.csv" style={{ justifySelf: "end" }}>
        Download CSV
      </a>

      {/* Filters (compact: search + buttons on same row) */}
      <form method="GET" className="card--soft" style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(160px, 320px) max-content",
            gap: 12,
            alignItems: "center",
          }}
        >
          <input
            name="displayName"
            placeholder="Search by admin name…"
            defaultValue={searchParams.displayName ?? ""}
            className="input"
            style={CONTROL}
            aria-label="Search by admin name"
          />
          <div style={{ display: "flex", gap: 8 }}>
            {hasFilters && (
              <a href="?" className="btn btn--light">
                Reset
              </a>
            )}
            <button className="btn btn--outline" type="submit">
              Apply
            </button>
          </div>
        </div>

        <div
          className="subtle-text"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}
          >
          <span>{resultCount} {resultCount === 1 ? "result" : "results"}</span>
        </div>
      </form>

        <SuperAdminsList roster={roster} adminTeamsByUser={playerTeamsByUser} />
      </main>
  );  
}