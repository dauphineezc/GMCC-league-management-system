// src/app/api/leagues/[leagueId]/description/route.ts
import { NextRequest, NextResponse } from "next/server";
import { assertLeagueAdmin, isAuthFailure } from "@/lib/authGuards";
import { revalidatePath } from "next/cache";
import { updateLeagueFields } from "@/lib/repositories/leaguesRepo";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ leagueId: string }> }
) {
  const { leagueId } = await params;
  const auth = await assertLeagueAdmin(leagueId);
  if (isAuthFailure(auth)) return auth.response;

  try {
    const body = await req.json();
    const { description } = body;

    if (typeof description !== "string") {
      return NextResponse.json({ error: "Description must be a string" }, { status: 400 });
    }

    const updated = await updateLeagueFields(leagueId, {
      description: description.trim(),
    });

    if (!updated) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    revalidatePath(`/leagues/${leagueId}`);

    return NextResponse.json({
      success: true,
      description: description.trim(),
    });
  } catch (error: any) {
    console.error("Error updating league description:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
