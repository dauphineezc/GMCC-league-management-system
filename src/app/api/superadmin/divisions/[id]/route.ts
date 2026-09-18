import { assertSuperAdmin, isAuthFailure } from "@/lib/authGuards";
import {
  deleteDivision,
  updateDivisionName,
} from "@/lib/repositories/divisionsRepo";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await ctx.params;
  if (!id) {
    return Response.json({ ok: false, error: "ID_REQUIRED" }, { status: 400 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = String(body.name ?? "").trim();
  if (!name) {
    return Response.json({ ok: false, error: "NAME_REQUIRED" }, { status: 400 });
  }

  try {
    const division = await updateDivisionName(id, name);
    if (!division) {
      return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    return Response.json({ ok: true, division });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to update division";
    return Response.json({ ok: false, error: message }, { status: 400 });
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await assertSuperAdmin();
  if (isAuthFailure(auth)) return auth.response;

  const { id } = await ctx.params;
  if (!id) {
    return Response.json({ ok: false, error: "ID_REQUIRED" }, { status: 400 });
  }

  const ok = await deleteDivision(id);
  if (!ok) {
    return Response.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
