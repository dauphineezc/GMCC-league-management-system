// src/app/create-team/page.tsx
import { DIVISIONS } from "@/lib/divisions";
import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function createTeam(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const leagueId = String(formData.get("leagueId") || "").trim();
  const description = String(formData.get("description") || "").trim();

  // who am I? (cookie first, then header fallback)
  const c = cookies();
  const userId =
    c.get("dev-user-id")?.value ||
    c.get("auth_user")?.value ||
    headers().get("x-user-id") ||
    "";

  if (!userId) throw new Error("No user. Use the dev sign-in first.");

  const origin =
    headers().get("origin") ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const res = await fetch(new URL("/api/teams", origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      // tell the API who is creating the team
      "x-user-id": userId,
    },
    body: JSON.stringify({ name, leagueId, description }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.error?.message || "Failed to create team");
  }

  // so Home > “My Teams” updates on your next visit
  revalidatePath("/");

  // go to the new team
  redirect(`/team/${data.team.id}`);
}

export default function CreateTeamPage() {
  return (
    <form action={createTeam} style={{ display: "grid", gap: 8, padding: 24 }}>
      <input name="name" placeholder="Team name" required />
      <select name="leagueId" defaultValue={DIVISIONS[0].id} required>
        {DIVISIONS.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} ({d.id})
          </option>
        ))}
      </select>
      <input name="description" placeholder="Optional description" />
      <button>Create</button>
    </form>
  );
}