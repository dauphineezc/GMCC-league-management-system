export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import { buildAdminRosterLikeRows } from "@/lib/rosterAggregate";
import SuperAdminsList from "@/components/superAdminList";

export default async function SuperAdminAdminsPage() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) redirect("/");

  const { roster, playerTeamsByUser } = await buildAdminRosterLikeRows();

  const uniqueCount = new Set(roster.map((r) => r.userId)).size;

  return (
    <main style={{ display: "grid", gap: 16 }}>
      <h1 className="page-title">Admins</h1>
      {/* count (left) + button (right) */}
      <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div className="subtle-text">{uniqueCount} total</div>
          <a className="btn btn--outline" href="/superadmin/export/admins.csv">
            Download CSV
          </a>
        </div>

        <SuperAdminsList roster={roster} adminTeamsByUser={playerTeamsByUser} />
      </main>
  );  
}