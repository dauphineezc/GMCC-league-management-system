export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import PublicLeagueTabsServer from "@/components/publicLeagueTabs.server";
import Link from "next/link";

export default async function SuperAdminHome() {
  const user = await getServerUser();
  if (!user) redirect("/login");
  if (!user.superadmin) redirect("/");

  return (
    <main style={{ padding: 20, display: "grid", gap: 30 }}>
      {/* Welcome */}
      <section>
        <h1 className="page-title">Welcome</h1>
        <p>You're signed in as <code>{user.email ?? user.id}</code>.</p>
        <Link className="btn btn--outline" href="/logout">Sign out</Link>
      </section>

      
      {/* Public leagues — powered by the server wrapper */}
      <section id="public-leagues">
        <h2 className="section-title">Leagues</h2>
        <PublicLeagueTabsServer defaultTab="basketball" />
      </section>
    </main>
  );
}