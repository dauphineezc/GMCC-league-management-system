import { kv } from "@vercel/kv";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import Link from "next/link";

type Params = { leagueId: string };

export default async function LeagueAdmin({ params }: { params: Params }) {
  const leagueId = params.leagueId;
  const userId = headers().get("x-user-id") || "unknown";
  const managed: string[] = (await kv.get<string[]>(`admin:${userId}:leagues`)) ?? [];
  const canManage = managed.includes(leagueId);

  const league = (await kv.get<any>(`league:${leagueId}`)) ?? { id: leagueId, name: leagueId };
  const teamCards = (await kv.get<any[]>(`league:${leagueId}:teams`)) ?? [];
  const teamIds = (await kv.get<string[]>(`league:${leagueId}:teamIds`)) ?? [];
  const teams = await Promise.all(
    teamIds.map(async tid => ({
      info: await kv.get<any>(`team:${tid}`),
      roster: (await kv.get<any[]>(`team:${tid}:roster`)) ?? [],
    }))
  );
  const master = (await kv.get<any[]>(`league:${leagueId}:players`)) ?? [];

  return (
    <main style={{ padding: 24, display: "grid", gap: 20 }}>
      <p><Link href="/admin">← Back to Admin</Link></p>
      <h1>{league.name} <span style={{ color: "#6b7280" }}>({leagueId})</span></h1>
      {!canManage && (
        <p style={{ color: "#9ca3af" }}>You don’t manage this league. Read-only.</p>
      )}

      {/* Schedule PDF (editable if owner) */}
      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Schedule (PDF)</h3>
        <form action={updateSchedule} style={{ display: "flex", gap: 8 }}>
          <input type="hidden" name="leagueId" value={leagueId} />
          <input
            name="schedulePdfUrl"
            defaultValue={league.schedulePdfUrl || ""}
            placeholder="https://…/schedule.pdf"
            style={input}
            disabled={!canManage}
          />
          <button style={btn} disabled={!canManage}>Save</button>
        </form>
        {league.schedulePdfUrl && (
          <p style={{ marginTop: 8 }}>
            Current: <a href={league.schedulePdfUrl} target="_blank" rel="noreferrer">{league.schedulePdfUrl}</a>
          </p>
        )}
      </section>

      {/* Teams table */}
      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Teams ({teamCards.length})</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                      <button style={btn} disabled={!canManage}>{info.approved ? "Unapprove" : "Approve"}</button>
                    </form>
                  </td>
                </tr>
              ))}
              {teams.length === 0 && <tr><td colSpan={5} style={td}>No teams yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Master roster (edit dues if owner) */}
      <section style={card}>
        <h3 style={{ marginTop: 0 }}>Master Roster (dues status)</h3>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                      <button style={btn} disabled={!canManage}>Toggle</button>
                    </form>
                  </td>
                </tr>
              ))}
              {master.length === 0 && <tr><td colSpan={5} style={td}>No players yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

/* ---------- server actions (co-located) ---------- */
async function updateSchedule(formData: FormData) {
  "use server";
  const leagueId = String(formData.get("leagueId") || "");
  const schedulePdfUrl = String(formData.get("schedulePdfUrl") || "");
  const prev = (await kv.get<any>(`league:${leagueId}`)) || {};
  await kv.set(`league:${leagueId}`, { ...prev, schedulePdfUrl, updatedAt: new Date().toISOString(), });
  revalidatePath(`/admin/leagues/${leagueId}`);
}

async function toggleApproved(formData: FormData) {
  "use server";
  const teamId = String(formData.get("teamId") || "");
  const approved = String(formData.get("approved") || "") === "true";
  const t = (await kv.get<any>(`team:${teamId}`)) ?? {};
  await kv.set(`team:${teamId}`, { ...t, approved: !approved, updatedAt: new Date().toISOString() });
  // keep summary list in sync
  if (t.leagueId) {
    const cards = (await kv.get<any[]>(`league:${t.leagueId}:teams`)) ?? [];
    const idx = cards.findIndex(c => c.teamId === teamId);
    if (idx >= 0) cards[idx] = { ...cards[idx] }; // nothing visible changes here, but we could include approved if you add it to the card shape
    await kv.set(`league:${t.leagueId}:teams`, cards);
  }
  revalidatePath(`/admin/leagues/${t.leagueId || ""}`);
}

async function flipPayment(formData: FormData) {
  "use server";
  const teamId = String(formData.get("teamId") || "");
  const userId = String(formData.get("userId") || "");
  const key = `team:${teamId}:roster:private:${userId}`;
  const cur = (await kv.get<any>(key)) ?? { paymentStatus: "UNPAID" };
  const next = cur.paymentStatus === "PAID" ? "UNPAID" : "PAID";
  await kv.set(key, { paymentStatus: next });

  // also reflect in league:<id>:players if present
  const team = (await kv.get<any>(`team:${teamId}`)) ?? {};
  const leagueKey = `league:${team.leagueId}:players`;
  const rows = (await kv.get<any[]>(leagueKey)) ?? [];
  const i = rows.findIndex(r => r.userId === userId && r.teamId === teamId);
  if (i >= 0) { rows[i] = { ...rows[i], paymentStatus: next }; await kv.set(leagueKey, rows); }

  revalidatePath(`/admin/leagues/${team.leagueId || ""}`);
}

/* ---------- styles ---------- */
const card: React.CSSProperties = { border: "1px solid #eee", borderRadius: 12, padding: 16 };
const input: React.CSSProperties = { flex: 1, padding: 8, border: "1px solid #ccc", borderRadius: 8 };
const btn:   React.CSSProperties = { padding: "8px 12px", border: "1px solid #ccc", borderRadius: 8, background: "white", cursor: "pointer" };
const th:    React.CSSProperties = { textAlign: "left", borderBottom: "1px solid #eee", padding: 8, fontWeight: 600, fontSize: 13 };
const td:    React.CSSProperties = { borderBottom: "1px solid #eee", padding: 8, fontSize: 14 };