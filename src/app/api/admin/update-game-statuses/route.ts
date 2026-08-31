// src/app/api/admin/update-game-statuses/route.ts
import { assertCronOrSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import { COMPLETION_GRACE_MINUTES } from "@/lib/gameDateTime";
import { syncPastGameStatuses } from "@/lib/repositories/gamesRepo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const auth = await assertCronOrSuperAdmin(req);
    if (isAuthFailure(auth)) return auth.response;

    console.log(`[${new Date().toISOString()}] Starting game status update`);

    const { completed, finalized } = await syncPastGameStatuses(COMPLETION_GRACE_MINUTES);
    const totalUpdated = completed + finalized;

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Marked ${completed} games completed and ${finalized} games final`,
        completed,
        finalized,
        totalUpdated,
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { "content-type": "application/json" } }
    );
  } catch (e: any) {
    console.error("Game status update failed:", e);
    return new Response(
      JSON.stringify({
        error: e?.message || "Failed to update game statuses",
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}
