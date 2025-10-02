export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import PublicLeagueTabsServer from "@/components/publicLeagueTabs.server";
import Link from "next/link";

export default async function Home() {
  const user = await getServerUser();
  if (user) {
    if (user.superadmin) redirect("/superadmin");
    if (Array.isArray(user.leagueAdminOf)) redirect("/admin");
    redirect("/player");
  }

  return (
    <main style={{ padding: 20, display: "grid", gap: 10 }}>
      {/* Welcome */}
      <section>
        <h1 className="page-title">Welcome</h1>
      </section>

      <section>
        <Link className="btn btn--primary" href="/login">Sign in</Link>
      </section>
      
      {/* Public leagues — powered by the server wrapper */}
      <section id="public-leagues">
        <h2 className="section-title">Leagues</h2>
        <PublicLeagueTabsServer defaultTab="basketball" />
      </section>
    </main>
  );
}