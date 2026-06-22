/**
 * Postgres smoke test — verifies backfilled data is readable via repositories.
 * Usage: npm run smoke:postgres
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("FAIL: DATABASE_URL is not set");
    process.exit(1);
  }

  const { db } = await import("../src/db/index");
  const { leagues, teams, teamMembers, games, users, leagueAdmins, invites, schedulePdfs } =
    await import("../src/db/schema");
  const { count } = await import("drizzle-orm");

  const { listAllLeaguesLite, readLeagueDocByRef } = await import(
    "../src/lib/repositories/leaguesRepo"
  );
  const { getTeamsForLeagueRef, batchGetRosters, getLeaguePlayerRows } = await import(
    "../src/lib/repositories/teamsRepo"
  );
  const { getSchedulePdfInfo, getSchedulePdfBytes } = await import(
    "../src/lib/repositories/schedulePdfsRepo"
  );
  const { readLeagueGames, calculateStandings } = await import("../src/lib/leagueData");
  const { readMembershipsForUid } = await import("../src/lib/repositories/usersRepo");

  const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

  const tableCounts = await Promise.all([
    db.select({ n: count() }).from(leagues),
    db.select({ n: count() }).from(teams),
    db.select({ n: count() }).from(teamMembers),
    db.select({ n: count() }).from(games),
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(leagueAdmins),
    db.select({ n: count() }).from(invites),
    db.select({ n: count() }).from(schedulePdfs),
  ]);

  const [lc, tc, mc, gc, uc, ac, ic, pc] = tableCounts.map((r) => r[0]?.n ?? 0);
  checks.push({
    name: "Table row counts",
    ok: lc > 0 && tc > 0 && mc > 0,
    detail: `leagues=${lc} teams=${tc} members=${mc} games=${gc} users=${uc} admins=${ac} invites=${ic} schedulePdfs=${pc}`,
  });

  const lite = await listAllLeaguesLite({ onlyApproved: false });
  checks.push({
    name: "listAllLeaguesLite",
    ok: lite.length > 0 && lite.every((l) => l.id && l.name && l.sport),
    detail: `${lite.length} leagues, slugs: ${lite.map((l) => l.id).join(", ")}`,
  });

  const sampleSlug = lite[0]?.id;
  if (sampleSlug) {
    const doc = await readLeagueDocByRef(sampleSlug);
    checks.push({
      name: `readLeagueDocByRef(${sampleSlug})`,
      ok: Boolean(doc?.name),
      detail: doc?.name ? String(doc.name) : "missing",
    });

    const leagueTeams = await getTeamsForLeagueRef(sampleSlug);
    checks.push({
      name: `getTeamsForLeagueRef(${sampleSlug})`,
      ok: leagueTeams.length >= 0,
      detail: `${leagueTeams.length} teams`,
    });

    if (leagueTeams.length > 0) {
      const rosters = await batchGetRosters([leagueTeams[0].teamId]);
      const roster = rosters.get(leagueTeams[0].teamId) ?? [];
      checks.push({
        name: "batchGetRosters",
        ok: roster.length >= 0,
        detail: `team ${leagueTeams[0].name}: ${roster.length} players`,
      });
    }

    const leagueGames = await readLeagueGames(sampleSlug);
    checks.push({
      name: `readLeagueGames(${sampleSlug})`,
      ok: Array.isArray(leagueGames),
      detail: `${leagueGames.length} games`,
    });

    const standings = await calculateStandings(sampleSlug);
    checks.push({
      name: `calculateStandings(${sampleSlug})`,
      ok: Array.isArray(standings),
      detail: `${standings.length} rows`,
    });

    const playerRows = await getLeaguePlayerRows(sampleSlug);
    checks.push({
      name: `getLeaguePlayerRows(${sampleSlug})`,
      ok: playerRows.length >= 0 && playerRows.every((p) => p.userId && p.teamId),
      detail: `${playerRows.length} players for announcements`,
    });
  }

  if (pc > 0) {
    for (const league of lite) {
      const info = await getSchedulePdfInfo(league.id);
      if (!info) continue;
      const pdf = await getSchedulePdfBytes(league.id);
      checks.push({
        name: `getSchedulePdf(${league.id})`,
        ok: Boolean(pdf && pdf.bytes.length > 0),
        detail: pdf
          ? `${info.filename} (${pdf.bytes.length} bytes)`
          : "metadata only",
      });
      break;
    }
  }

  const userRows = await db.select({ id: users.id }).from(users).limit(1);
  if (userRows[0]) {
    const memberships = await readMembershipsForUid(userRows[0].id);
    checks.push({
      name: "readMembershipsForUid",
      ok: Array.isArray(memberships),
      detail: `user ${userRows[0].id.slice(0, 8)}… → ${memberships.length} membership(s)`,
    });
  }

  console.log("\n=== Postgres Smoke Test ===\n");
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "PASS" : "FAIL";
    if (!c.ok) failed++;
    console.log(`[${mark}] ${c.name}`);
    if (c.detail) console.log(`       ${c.detail}`);
  }
  console.log(`\n${checks.length - failed}/${checks.length} checks passed.\n`);

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
