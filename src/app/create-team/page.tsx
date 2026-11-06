// src/app/create-team/page.tsx
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/serverUser";
import {
  listAllLeaguesLite,
  readLeagueDocByRef,
} from "@/lib/repositories/leaguesRepo";
import CreateTeamLeagueFields from "@/components/createTeamLeagueFields";
import { POST as createTeamHandler } from "@/app/api/teams/route";

function isNextRedirect(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest?: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

function failCreate(message: string): never {
  redirect(`/create-team?error=${encodeURIComponent(message)}`);
}

async function createTeam(formData: FormData) {
  "use server";

  try {
    const name = String(formData.get("name") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const leagueId = String(formData.get("leagueId") || "").trim();

    if (!name) failCreate("Team name is required");
    if (!leagueId) failCreate("Please select a league");

    const league = await readLeagueDocByRef(leagueId);
    if (!league) failCreate("Selected league was not found");

    const sport = String(league.sport || "basketball");
    const gender = String(league.gender || "co-ed");
    const estimatedDivision = String(league.division || "");

    if (!estimatedDivision) {
      failCreate("Selected league has no division configured.");
    }

    const user = await getServerUser();
    if (!user?.id) {
      failCreate("Not authenticated. Please log in first.");
    }
    // In-process call: the handler re-reads this request's session via cookies()
    const res = await createTeamHandler(
      new Request("http://internal/api/teams", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          leagueId,
          sport,
          gender,
          estimatedDivision,
        }),
      }) as NextRequest
    );

    const data = await res.json().catch(() => ({}));
    const teamId = data?.team?.id;
    if (!res.ok || !teamId) {
      failCreate(data?.error?.message || "Failed to create team. Please try again.");
    }

    revalidatePath("/");
    redirect(`/team/${teamId}?created=true`);
  } catch (err) {
    if (isNextRedirect(err)) throw err;
    console.error("createTeam failed:", err);
    failCreate("Failed to create team. Please try again.");
  }
}

export default async function CreateTeamPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : "";

  // Include unapproved leagues: league.approved defaults to false and is not
  // used as a registration gate elsewhere (public listings show all leagues).
  const leagues = await listAllLeaguesLite({ onlyApproved: false });

  return (
    <form action={createTeam} style={{ display: "grid", gap: 14, maxWidth: 720 }}>
      <h1 className="section-title">Create a Team</h1>
      {error ? (
        <p role="alert" style={{ margin: 0, color: "#9b1c1c", fontWeight: 600 }}>
          {error}
        </p>
      ) : null}

      <div className="card" style={{ padding: 16, display: "grid", gap: 14, background: "#FFFFFF" }}>
        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Team name</div>
          <input name="name" placeholder="Team name" className="input" style={{ width: "100%" }} required />
        </label>

        <label>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Description (optional)</div>
          <input name="description" placeholder="Optional description" className="input" style={{ width: "100%" }} />
        </label>

        <CreateTeamLeagueFields leagues={leagues} />
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" className="btn btn--primary" disabled={leagues.length === 0}>
          Create
        </button>
        <Link href="/" className="btn">
          Cancel
        </Link>
      </div>
    </form>
  );
}
