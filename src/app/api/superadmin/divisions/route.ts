import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import {
  createDivision,
  listDivisions,
  normalizeSport,
} from "@/lib/repositories/divisionsRepo";

/** List skill divisions (superadmin). Optional ?sport=basketball|volleyball. */
export async function GET(req: Request) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const url = new URL(req.url);
  const sport = normalizeSport(url.searchParams.get("sport"));
  const divisions = await listDivisions(sport);
  return Response.json({ ok: true, divisions });
}

export async function POST(req: Request) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    sport?: string;
  };
  const name = String(body.name ?? "").trim();
  const sport = normalizeSport(body.sport);
  if (!name) {
    return Response.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  }
  if (!sport) {
    return Response.json({ ok: false, error: "SPORT_REQUIRED" }, { status: 400 });
  }

  try {
    const division = await createDivision(name, sport);
    return Response.json({ ok: true, division }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to create division";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}
