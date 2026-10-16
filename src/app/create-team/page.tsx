// src/app/create-team/page.tsx
export const revalidate = 0;

import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerUser } from "@/lib/serverUser";
import {
  listAllLeaguesLite,
  readLeagueDocByRef,
} from "@/lib/repositories/leaguesRepo";
import CreateTeamLeagueFields from "@/components/createTeamLeagueFields";

async function createTeam(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  const leagueId = String(formData.get("leagueId") || "").trim();

  if (!name) throw new Error("Team name is required");
  if (!leagueId) throw new Error("Please select a league");

  const league = await readLeagueDocByRef(leagueId);
  if (!league) throw new Error("Selected league was not found");

  const sport = String(league.sport || "basketball");
  const gender = String(league.gender || "co-ed");
  const estimatedDivision = String(league.division || "");

  if (!estimatedDivision) {
    throw new Error("Selected league has no division configured.");
  }

  const user = await getServerUser();
  if (!user?.id) {
    throw new Error("Not authenticated. Please log in first.");
  }
  const origin =
    (await headers()).get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const session = (await cookies()).get("fb:session")?.value;

  const res = await fetch(new URL("/api/teams", origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(session ? { cookie: `fb:session=${session}` } : {}),
    },
    body: JSON.stringify({
      name,
      description,
      leagueId,
      sport,
      gender,
      estimatedDivision,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "Failed to create team");

  revalidatePath("/");
  redirect(`/team/${data.team.id}?created=true`);
}

export default async function CreateTeamPage() {
  // Include unapproved leagues: league.approved defaults to false and is not
  // used as a registration gate elsewhere (public listings show all leagues).
  const leagues = await listAllLeaguesLite({ onlyApproved: false });

  return (
    <form action={createTeam} style={{ display: "grid", gap: 14, padding: 24, maxWidth: 720 }}>
      <h1 className="section-title">Create a Team</h1>

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
