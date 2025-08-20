// Server Component
import { kv } from "@vercel/kv";
import { revalidatePath } from "next/cache";

async function seed() {
  "use server";
  const now = new Date().toISOString();

  // --- Leagues --------------------------------------------------------------
  const leagues = [
    { id: "5v5", name: "5v5", schedulePdfUrl: "", createdAt: now, updatedAt: now },
    { id: "4v4b", name: "4v4B", schedulePdfUrl: "", createdAt: now, updatedAt: now },
  ];
  await kv.set("league:index", leagues.map(({ id, name }) => ({ id, name })));
  for (const lg of leagues) {
    await kv.set(`league:${lg.id}`, lg);
    await kv.set(`league:${lg.id}:teams`, []);
    await kv.set(`league:${lg.id}:teamIds`, []);
    await kv.set(`league:${lg.id}:standings`, []);
    await kv.set(`league:${lg.id}:players`, []);
  }

  // --- Demo Admin assignment (so you can view /admin immediately) ----------
  // Replace "demo-admin" with your Firebase UID, or use the dev cookie (see step 3).
  await kv.set(`admin:demo-admin:leagues`, leagues.map(l => l.id));

  // --- Demo Teams (one league fully populated) -----------------------------
  type Team = { id: string; leagueId: string; name: string; description?: string; managerUserId: string; approved: boolean; rosterLimit: number; createdAt: string; updatedAt: string; };
  const mkTeam = (id:string, leagueId:string, name:string, managerUserId:string): Team => ({
    id, leagueId, name, description: `${name} description`,
    managerUserId, approved: false, rosterLimit: 8, createdAt: now, updatedAt: now
  });

  const t1 = mkTeam("t-rockets", "5v5", "Rockets", "uid-a");
  const t2 = mkTeam("t-spurs",   "5v5", "Spurs",   "uid-b");
  const t3 = mkTeam("t-sonics",  "5v5", "Sonics",  "uid-c");

  for (const t of [t1,t2,t3]) {
    await kv.set(`team:${t.id}`, t);
  }
  await kv.set(`league:5v5:teams`, [
    { teamId: t1.id, name: t1.name, description: t1.description },
    { teamId: t2.id, name: t2.name, description: t2.description },
    { teamId: t3.id, name: t3.name, description: t3.description },
  ]);
  await kv.set(`league:5v5:teamIds`, [t1.id, t2.id, t3.id]);

  // --- Rosters (public) + private dues -------------------------------------
  const roster = (entries: any[]) => entries.map(e => ({ ...e, joinedAt: now }));
  await kv.set(`team:${t1.id}:roster`, roster([
    { userId: "uid-a", displayName: "Aliyah S.", isManager: true  },
    { userId: "uid-d", displayName: "Devon K.",  isManager: false },
    { userId: "uid-e", displayName: "Emi T.",    isManager: false },
  ]));
  await kv.set(`team:${t2.id}:roster`, roster([
    { userId: "uid-b", displayName: "Beau M.",   isManager: true  },
    { userId: "uid-f", displayName: "Frank L.",  isManager: false },
  ]));
  await kv.set(`team:${t3.id}:roster`, roster([
    { userId: "uid-c", displayName: "Casey R.",  isManager: true  },
  ]));

  for (const uid of ["uid-a","uid-d","uid-e","uid-b","uid-f","uid-c"]) {
    await kv.set(`team:${t1.id}:roster:private:${uid}`, { paymentStatus: "UNPAID" });
    await kv.set(`team:${t2.id}:roster:private:${uid}`, { paymentStatus: "UNPAID" });
    await kv.set(`team:${t3.id}:roster:private:${uid}`, { paymentStatus: "UNPAID" });
  }
  // Mark a couple as paid so the UI shows variety
  await kv.set(`team:${t1.id}:roster:private:uid-d`, { paymentStatus: "PAID" });
  await kv.set(`team:${t2.id}:roster:private:uid-b`, { paymentStatus: "PAID" });

  // --- User memberships (for /api/me + dashboard realism) ------------------
  await kv.set(`user:uid-a:memberships`, [{ leagueId: "5v5", teamId: t1.id, isManager: true }]);
  await kv.set(`user:uid-b:memberships`, [{ leagueId: "5v5", teamId: t2.id, isManager: true }]);
  await kv.set(`user:uid-c:memberships`, [{ leagueId: "5v5", teamId: t3.id, isManager: true }]);
  await kv.set(`user:uid-d:memberships`, [{ leagueId: "5v5", teamId: t1.id, isManager: false }]);
  await kv.set(`user:uid-e:memberships`, [{ leagueId: "5v5", teamId: t1.id, isManager: false }]);
  await kv.set(`user:uid-f:memberships`, [{ leagueId: "5v5", teamId: t2.id, isManager: false }]);

  // --- Derived admin index: league:5v5:players ------------------------------
  const leaguePlayers = [
    { userId: "uid-a", displayName: "Aliyah S.", teamId: t1.id, teamName: t1.name, isManager: true,  paymentStatus: "UNPAID" },
    { userId: "uid-d", displayName: "Devon K.",  teamId: t1.id, teamName: t1.name, isManager: false, paymentStatus: "PAID"   },
    { userId: "uid-e", displayName: "Emi T.",    teamId: t1.id, teamName: t1.name, isManager: false, paymentStatus: "UNPAID" },
    { userId: "uid-b", displayName: "Beau M.",   teamId: t2.id, teamName: t2.name, isManager: true,  paymentStatus: "PAID"   },
    { userId: "uid-f", displayName: "Frank L.",  teamId: t2.id, teamName: t2.name, isManager: false, paymentStatus: "UNPAID" },
    { userId: "uid-c", displayName: "Casey R.",  teamId: t3.id, teamName: t3.name, isManager: true,  paymentStatus: "UNPAID" },
  ];
  await kv.set(`league:5v5:players`, leaguePlayers);

  // Optional: give 5v5 a demo schedule PDF URL placeholder
  await kv.set(`league:5v5`, { ...(await kv.get(`league:5v5`)), schedulePdfUrl: "https://example.com/fall-5v5.pdf", updatedAt: new Date().toISOString() });

  revalidatePath("/admin");
}

export default function SeedPage() {
  return (
    <div style={{ padding: 24, maxWidth: 720 }}>
      <h1>Seed Demo Data</h1>
      <p>This will create demo leagues, teams, rosters, and an admin assignment.</p>
      <form action={seed}>
        <button style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8 }}>Seed Now</button>
      </form>
      <p style={{ marginTop: 12 }}>After seeding, open <code>/admin</code>.</p>
    </div>
  );
}
