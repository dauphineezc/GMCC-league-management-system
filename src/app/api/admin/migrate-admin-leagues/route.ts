export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { assertCronOrSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import { migrateAllAdminLeaguesFromEmail } from "@/lib/adminLeaguesMigration";

/**
 * One-time migration: admin:{email}:leagues → admin:{uid}:leagues (SET).
 * Superadmin session or CRON_SECRET bearer required.
 *
 * Query params:
 *   dry=1  — report only, no writes
 */
export async function POST(req: Request) {
  const auth = await assertCronOrSuperAdmin(req);
  if (isAuthFailure(auth)) return auth.response;

  const { searchParams } = new URL(req.url);
  const dry = searchParams.get("dry") === "1";

  try {
    const report = await migrateAllAdminLeaguesFromEmail({ dry });
    return NextResponse.json({ ok: true, ...report });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Migration failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
