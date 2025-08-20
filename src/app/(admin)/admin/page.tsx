// Server Component Admin Home
import { kv } from "@vercel/kv";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

// ---- server actions ----
async function updateSchedule(formData: FormData) {
  "use server";
  const leagueId = String(formData.get("leagueId"));
  const url = String(formData.get("schedulePdfUrl") || "");
  const league = await kv.get<any>(`league:${leagueId}`);
  if (!league) return;
  await kv.set(`league:${leagueId}`, { ...league, schedulePdfUrl: url, updatedAt: new Date().toISOString() });
  revalidatePath("/admin");
}

async function toggleApproved(formData: FormData) {
  "use server";
  const teamId = String(formData.get("teamId"));
  const approved = String(formData.get("approved")) === "true";
  const team = await kv.get<any>(`team:${teamId}`);
  if (!team) return;
  await kv.set(`team:${teamId}`, { ...team, approved: !approved, updatedAt: new Date().toISOString() });
  revalidatePath("/admin");
}

async function flipPayment(formData: FormData) {
  "use server";
  const teamId = String(formData.get("teamId"));
  const userId = String(formData.get("userId"));
  const priv = (await kv.get<any>(`team:${teamId}:roster:private:${userId}`)) || { paymentStatus: "UNPAID" };
  const next = priv.paymentStatus === "PAID" ? "UNPAID" : "PAID";
  await kv.set(`team:${teamId}:roster:private:${userId}`, { ...priv, paymentStatus: next });

  // also update derived league players table if present
  const team = await kv.get<any>(`team:${teamId}`);
  const lpKey = `league:${team?.leagueId}:players`;
  const players = (await kv.get<any[]>(lpKey)) || [];
  const updated = players.map(p => p.userId === userId ? { ...p, paymentStatus: next } : p);
  await kv.set(lpKey, updated);
  revalidatePath("/admin");
}

// ---- page ----
export default async function AdminPage() {
  const h = headers();
  const userId = h.get("x-user-id") || "unknown";

  // soft-gate: check assigned leagues
  const managedLeagues: string[] = (await kv.get<string[]>(`admin:${userId}:leagues`)) || [];
  const leaguesIndex: {id:string; name:string}[] = (await kv.get<any[]>("league:index")) || [];

  const leagues = await Promise.all(
    leaguesIndex
      .filter(l => managedLeagues.includes(l.id))
      .map(async l => {
        const league = await kv.get<any>(`league:${l.id}`);
        const teamCards = (await kv.get<any[]>(`league:${l.id}:teams`)) || [];
        const teamIds = (await kv.get<string[]>(`league:${l.id}:teamIds`)) || [];
        const teams = await Promise.all(teamIds.map(async id => ({
          info: await kv.get<any>(`team:${id}`),
          roster: (await kv.get<any[]>(`team:${id}:roster`)) || []
        })));
        const master = (await kv.get<any[]>(`league:${l.id}:players`)) || [];
        return { league, teamCards, teams, master };
      })
  );

  return (
    <div style={{ padding: 24, display: "grid", gap: 24 }}>
      <h1>Admin • Leagues I Manage</h1>
      {leagues.length === 0 && (
        <p>No leagues assigned to <code>{userId}</code>. Visit <code>/admin/seed</code> to create demo data.</p>
      )}

      {leagues.map(({ league, teamCards, teams, master }) => (
        <div key={league.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>{league.name} ({league.id})</h2>

          {/* Schedule PDF */}
          <details open>
            <summary><strong>Schedule (PDF)</strong></summary>
            <form action={updateSchedule} style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="hidden" name="leagueId" value={league.id} />
              <input
                name="schedulePdfUrl"
                defaultValue={league.schedulePdfUrl || ""}
                placeholder="https://…/schedule.pdf"
                style={{ flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 8 }}
              />
              <button style={{ padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8 }}>Save</button>
            </form>
            {league.schedulePdfUrl && (
              <p style={{ marginTop: 8 }}>
                Current: <a href={league.schedulePdfUrl} target="_blank" rel="noreferrer">{league.schedulePdfUrl}</a>
              </p>
            )}
          </details>

          {/* Teams table */}
          <details open style={{ marginTop: 16 }}>
            <summary><strong>Teams</strong> ({teamCards.length})</summary>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={th}>Team</th>
                    <th style={th}>Approved</th>
                    <th style={th}>Manager</th>
                    <th style={th}>Roster Size</th>
                    <th style={th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map(({ info, roster }) => (
                    <tr key={info.id}>
                      <td style={td}><strong>{info.name}</strong><div style={{ color:"#6b7280" }}>{info.description}</div></td>
                      <td style={td}>{info.approved ? "✅ Yes" : "—"}</td>
                      <td style={td}><code>{info.managerUserId}</code></td>
                      <td style={td}>{roster.length} / {info.rosterLimit}</td>
                      <td style={td}>
                        <form action={toggleApproved}>
                          <input type="hidden" name="teamId" value={info.id} />
                          <input type="hidden" name="approved" value={String(info.approved)} />
                          <button style={btn}>{info.approved ? "Unapprove" : "Approve"}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {teams.length === 0 && (
                    <tr><td colSpan={5} style={td}>No teams yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>

          {/* Master Roster */}
          <details style={{ marginTop: 16 }}>
            <summary><strong>Master Roster</strong> (dues status editable)</summary>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
                <thead>
                  <tr>
                    <th style={th}>Player</th>
                    <th style={th}>Team</th>
                    <th style={th}>Manager</th>
                    <th style={th}>Payment</th>
                    <th style={th}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {master.map((p) => (
                    <tr key={`${p.userId}-${p.teamId}`}>
                      <td style={td}><code>{p.userId}</code> <div>{p.displayName}</div></td>
                      <td style={td}>{p.teamName}</td>
                      <td style={td}>{p.isManager ? "⭐" : ""}</td>
                      <td style={td}>{p.paymentStatus === "PAID" ? "💰 PAID" : "— UNPAID"}</td>
                      <td style={td}>
                        <form action={flipPayment}>
                          <input type="hidden" name="teamId" value={p.teamId} />
                          <input type="hidden" name="userId" value={p.userId} />
                          <button style={btn}>Toggle</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                  {master.length === 0 && (
                    <tr><td colSpan={5} style={td}>No players yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      ))}
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", fontWeight: 600, padding: "8px 6px", borderBottom: "1px solid #e5e7eb" };
const td: React.CSSProperties = { padding: "8px 6px", borderBottom: "1px solid #f3f4f6", verticalAlign: "top" };
const btn: React.CSSProperties = { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 8, background: "white", cursor: "pointer" };
