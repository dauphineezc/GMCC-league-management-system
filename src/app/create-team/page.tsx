// src/app/create-team/page.tsx
export const dynamic = "force-dynamic";

import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import Link from "next/link";
import { kv } from "@vercel/kv";

// ---- enums used in form + payload ----
const SPORTS = ["basketball", "volleyball"] as const;
const GENDERS = ["mens", "womens", "co-ed"] as const;
const PRACTICE_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DIVISION_ESTIMATES = ["low b", "high b", "a"] as const;

type Sport = typeof SPORTS[number];
type Gender = typeof GENDERS[number];
type PracticeDay = typeof PRACTICE_DAYS[number];
type DivisionEstimate = typeof DIVISION_ESTIMATES[number];

function isOneOf<T extends readonly string[]>(
  list: T,
  val: string | null
): val is T[number] {
  return !!val && (list as readonly string[]).includes(val);
}

async function createTeam(formData: FormData) {
  "use server";

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();

  const sportRaw = String(formData.get("sport") || "");
  const genderRaw = String(formData.get("gender") || "");
  const divRaw = String(formData.get("estimatedDivision") || "");

  const daysRaw = formData.getAll("practiceDays").map(String);

  if (!name) throw new Error("Team name is required");

  const sport: Sport = isOneOf(SPORTS, sportRaw) ? (sportRaw as Sport) : "basketball";
  const gender: Gender = isOneOf(GENDERS, genderRaw) ? (genderRaw as Gender) : "co-ed";
  const estimatedDivision: DivisionEstimate =
    isOneOf(DIVISION_ESTIMATES, divRaw) ? (divRaw as DivisionEstimate) : "low b";

  const preferredPracticeDays: PracticeDay[] = daysRaw.filter((d) =>
    PRACTICE_DAYS.includes(d as PracticeDay)
  ) as PracticeDay[];

  // who am I?
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

  // NOTE: leagueId is intentionally null at creation time
  const res = await fetch(new URL("/api/teams", origin), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({
      name,
      description,
      leagueId: null,
      sport,
      gender,
      estimatedDivision,
      preferredPracticeDays,
    }),
    cache: "no-store",
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || "Failed to create team");

  revalidatePath("/");
  redirect(`/team/${data.team.id}`);
}

export default function CreateTeamPage() {
  return (
    <form action={createTeam} style={{ display: "grid", gap: 14, padding: 24, maxWidth: 720 }}>
      <h1 className="section-title">Create a Team</h1>

      <div className="card" style={{ padding: 16, display: "grid", gap: 14 }}>
        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Team name</div>
          <input name="name" placeholder="Team name" required />
        </label>

        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Description (optional)</div>
          <input name="description" placeholder="Optional description" />
        </label>

        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Sport</div>
          <select name="sport" defaultValue="basketball" required>
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Team gender</div>
          <select name="gender" defaultValue="co-ed" required>
            <option value="mens">Mens</option>
            <option value="womens">Womens</option>
            <option value="co-ed">Co-ed</option>
          </select>
        </label>

        <fieldset style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 700, marginBottom: 6 }}>Preferred practice days</legend>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {PRACTICE_DAYS.map((d) => (
              <label key={d} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" name="practiceDays" value={d} />
                {d.toUpperCase()}
              </label>
            ))}
          </div>
        </fieldset>

        <label>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Estimated division</div>
          <select name="estimatedDivision" defaultValue="low b" required>
            <option value="low b">Low B</option>
            <option value="high b">High B</option>
            <option value="a">A</option>
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button type="submit" className="btn btn--primary">Create</button>
        <Link href="/player" className="btn btn--primary">Cancel</Link>
      </div>
    </form>
  );
}