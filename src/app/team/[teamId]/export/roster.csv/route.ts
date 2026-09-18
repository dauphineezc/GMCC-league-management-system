export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { adminAuth } from "@/lib/firebaseAdmin";
import { readDoc, readArr, readMap } from "@/lib/kvHelpers";
import { readLeagueName } from "@/lib/readLeagueName";
import {
  csvAttachment,
  csvDownloadRedirect,
} from "@/lib/adminCsvExport";
import type { RosterEntry } from "@/types/domain";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const { teamId } = await params;
  const team = await readDoc<Record<string, any>>(`team:${teamId}`);
  if (!team?.leagueId) {
    return new Response("Team not found", { status: 404 });
  }

  const leagueId = String(team.leagueId);
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) {
    return csvDownloadRedirect(auth.response.status === 401 ? "login" : "denied");
  }

  const [roster, payments, leagueName] = await Promise.all([
    readArr<RosterEntry>(`team:${teamId}:roster`),
    readMap<Record<string, boolean>>(`team:${teamId}:payments`),
    readLeagueName(leagueId),
  ]);

  const uids = Array.from(new Set(roster.map((r) => r.userId))).filter((id) => !id.includes("@"));
  const uidToEmail = new Map<string, string>();
  for (let i = 0; i < uids.length; i += 100) {
    const batch = uids.slice(i, i + 100).map((uid) => ({ uid }));
    const res = await adminAuth.getUsers(batch);
    for (const u of res.users) uidToEmail.set(u.uid, u.email ?? "");
  }

  const teamName = String(team.name ?? teamId);
  const rows = [...roster]
    .sort((a, b) =>
      (a.displayName || a.userId).localeCompare(b.displayName || b.userId, undefined, {
        sensitivity: "base",
      })
    )
    .map((r) => ({
      uid: r.userId,
      email: r.userId.includes("@") ? r.userId : (uidToEmail.get(r.userId) ?? ""),
      displayName: r.displayName,
      leagueId,
      leagueName,
      teamId,
      teamName,
      isManager: r.isManager ? "yes" : "no",
      paid: payments[r.userId] || r.paid ? "yes" : "no",
    }));

  return csvAttachment(
    `${teamId}-roster`,
    ["uid", "email", "displayName", "leagueId", "leagueName", "teamId", "teamName", "isManager", "paid"],
    rows
  );
}
