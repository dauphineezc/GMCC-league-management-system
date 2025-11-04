// src/app/api/superadmin/leagues/[leagueId]/assign-admin/route.ts
import { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getServerUser, isSuperAdmin } from "@/lib/serverUser";
import { getAdminDisplayName } from "@/lib/adminUserLookup";
import { addLeagueToAdmin, removeLeagueFromAdmin, migrateAdminLeaguesToSet } from "@/lib/adminIndex";
import { readLeagueDocJSON, writeLeagueAdminJSON } from "@/lib/leagueDoc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { leagueId: string } }) {
  const me = await getServerUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (!(await isSuperAdmin(me))) return new Response("Forbidden", { status: 403 });

  const { leagueId } = params;

  let body: any;
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const rawEmail = (body?.email ?? "").toString().trim().toLowerCase();
  const rawUid = (body?.adminUserId ?? "").toString().trim();
  const unassign = body?.email === null || body?.adminUserId === null;

  // Resolve admin UID
  let adminUid: string | null = null;

  if (unassign) {
    adminUid = null;
  } else if (rawUid) {
    adminUid = rawUid;
  } else if (rawEmail) {
    try {
      const fbUser = await getAuth().getUserByEmail(rawEmail);
      adminUid = fbUser.uid;
    } catch (e: any) {
      if (e?.errorInfo?.code === "auth/user-not-found") {
        return new Response(JSON.stringify({ error: "unknown-email" }), { status: 400 });
      }
      console.warn("getUserByEmail error:", e);
      return new Response("Lookup error", { status: 500 });
    }
  } else {
    return new Response(JSON.stringify({ error: "missing-identifier" }), { status: 400 });
  }

  // optional: figure out previous admin to maintain reverse index
  const before = await readLeagueDocJSON(leagueId);
  const prevUid = before?.adminUserId ?? null;

  const updated = await writeLeagueAdminJSON(leagueId, adminUid);

  // normalize old admin’s storage if needed
  if (prevUid) await migrateAdminLeaguesToSet(prevUid);
  if (adminUid) await migrateAdminLeaguesToSet(adminUid);

  // keep reverse index in sync
  if (prevUid && prevUid !== adminUid) await removeLeagueFromAdmin(prevUid, leagueId);
  if (adminUid) await addLeagueToAdmin(adminUid, leagueId);

  const adminDisplayName = adminUid ? await getAdminDisplayName(adminUid) : null;

  return new Response(
    JSON.stringify({
      ok: true,
      leagueId,
      adminUserId: adminUid,
      adminEmail: rawEmail || null,
      adminDisplayName,
      leagueDoc: updated,
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}