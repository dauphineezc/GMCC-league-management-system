export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession, hasRole, Role } from "@/lib/auth";

/* ---- dev sign-in with role ---- */
export async function devLogin(formData: FormData) {
  "use server";
  const uid = String(formData.get("uid") || "").trim() || "demo-user";
  const role = (String(formData.get("role") || "player") as Role);

  const c = cookies();
  c.set("dev-user-id", uid, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  c.set("auth_user",   uid, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  c.set("dev-role",   role, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });

  revalidatePath("/");
  redirect(role === "admin" ? "/admin" : "/player");
}

/* ---- dev set-role for already-signed-in users (no redirect loops) ---- */
export async function devSetRole(formData: FormData) {
  "use server";
  const role = (String(formData.get("role") || "player") as Role);
  const c = cookies();
  c.set("dev-role", role, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect(role === "admin" ? "/admin" : "/player");
}

/* ---- dev logout (works from here too) ---- */
export async function devLogout() {
  "use server";
  const c = cookies();
  c.delete("dev-user-id");
  c.delete("auth_user");
  c.delete("dev-role");
  revalidatePath("/home");
  redirect("/home");
}

export default async function HomeEntry() {
  const { userId, roles } = await getSession();

  // Already signed in? Route by explicit role.
  if (userId) {
    if (hasRole(roles, "admin")) redirect("/admin");
    if (hasRole(roles, "player")) redirect("/player");

    // ⚠️ Signed-in with NO role -> show a small chooser instead of redirecting.
    return (
      <main style={{ padding: 20 }}>
        <section className="card" style={{ padding: 16, maxWidth: 640 }}>
          <h2 className="section-title">Choose access</h2>
          <p style={{ marginTop: 0 }}>
            You’re signed in as <code>{userId}</code> but your role isn’t set.
          </p>

          <form action={devSetRole} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <select name="role" className="btn btn--light">
              <option value="player">Player</option>
              <option value="admin">Admin</option>
            </select>
            <button className="btn btn--primary">Continue</button>
          </form>

          <div style={{ marginTop: 12 }}>
            <form action={devLogout}>
              <button className="btn btn--outline">Sign out</button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  // Neutral sign-in page (not signed in)
  return (
    <main style={{ padding: 20 }}>
      <section className="card" style={{ padding: 16, maxWidth: 640 }}>
        <h2 className="section-title">Sign in</h2>
        <form action={devLogin} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input
            name="uid"
            placeholder="user id (e.g., demo-admin)"
            style={{ padding: 10, border: "1px solid #ccc", borderRadius: 8, minWidth: 240 }}
          />
          <select name="role" className="btn btn--light">
            <option value="player">Player</option>
            <option value="admin">Admin</option>
          </select>
          <button className="btn btn--primary">Sign in</button>
        </form>
      </section>
    </main>
  );
}