// /src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, googleProvider, appleProvider, microsoftProvider } from "@/lib/firebaseClient";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

/* ---------- helpers ---------- */

async function establishSession() {
  const idToken = await auth.currentUser?.getIdToken(true);
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken }),
  });
}

async function getMe() {
  const r = await fetch("/api/me", { credentials: "include", cache: "no-store" });
  try { return await r.json(); } catch { return {}; }
}

function targetFromMe(me: any) {
  const a = me?.auth || {};
  if (a.superadmin) return "/superadmin";
  if (Array.isArray(a.leagueAdminOf) && a.leagueAdminOf.length) return "/admin";
  return "/player";
}

// small poll to ensure server sees fb:session cookie before we ask for /api/me
async function waitForServerSession(): Promise<boolean> {
  for (let i = 0; i < 8; i++) {
    const r = await fetch("/api/me", { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (j?.auth?.uid) return true;
    await new Promise(res => setTimeout(res, 120));
  }
  return false;
}

/* ---------- page ---------- */

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  async function finish() {
    await establishSession();                  // sets fb:session cookie
    await waitForServerSession();              // give the server a beat
    const me = await getMe();                  // read custom claims
    const target = next && next !== "/" ? next : targetFromMe(me);
    // use a hard nav so RSC cache doesn't bite us
    location.assign(target);
  }

  async function withUi(p: Promise<unknown>) {
    setErr(null); setBusy(true);
    try { await p; await finish(); }
    catch (e: any) { setErr(e?.message ?? "Authentication failed"); }
    finally { setBusy(false); }
  }

  return (

    <main style={{ padding: 20, display: "grid", gap: 10 }}>
      {/* Welcome */}
      <section>
        {/* <h1 className="page-title">Sign in</h1> */}
      </section>
      <section className="auth-card w-full" style={{ justifySelf: "center", justifyItems: "center", minHeight: "500px", padding: "32px", maxWidth: "600px", width: "100%" }}>
          <h2 className="content-title" style={{ marginBottom: "35px" }}>Welcome back! Please enter your details.</h2>

          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void withUi(signInWithEmailAndPassword(auth, email.trim(), pw));
            }}
          >
            {/* Email row */}
            <div className="auth-row">
              <label htmlFor="email" className="auth-label">Email:</label>
              <input
                id="email"
                className="auth-input"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>

            {/* Password row */}
            <div className="auth-row">
              <label htmlFor="password" className="auth-label">Password:</label>
              <input
                id="password"
                className="auth-input"
                placeholder="••••••••"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                required
              />
              {/* right-aligned under the input (grid column 2) */}
              <a href="/reset" className="auth-link--small auth-forgot">Forgot password?</a>
            </div>

            {/* Centered primary button */}
            <button
              type="submit"
              className="brand-btn auth-primary"
              disabled={busy}
              aria-busy={busy}
              style={{ marginTop: "30px", marginBottom: "30px" }}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* IdP buttons — icon only */}
          <div className="mt-6 mb-4">
            <p className="text-center text-slate-600">or continue with</p>
          </div>

          <div className="oauth-buttons-container" style={{ display: 'flex', flexDirection: 'row', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="oauth-btn"
              disabled={busy}
              onClick={() => withUi(signInWithPopup(auth, googleProvider))}
              aria-label="Google"
            >
              <span className="oauth-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" role="img" focusable="false">
                  <path fill="#EA4335" d="M24 9.5c3.3 0 6.3 1.2 8.7 3.2l6.5-6.5C35.6 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.7 6c1.8-5.4 7-9.7 13.7-9.7z"/>
                  <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-2.8-.3-4.1H24v7.8h12.7c-.6 3.3-2.3 6.1-4.9 8l7.6 5.9c4.5-4.1 7.1-10.1 7.1-17.6z"/>
                  <path fill="#FBBC05" d="M10.3 28.9c-.5-1.5-.8-3.1-.8-4.9s.3-3.4.8-4.9l-7.7-6C.9 15.6 0 19.7 0 24s.9 8.4 2.6 11.9l7.7-7z"/>
                  <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.5-4.9 2.5-8.3 2.5-6.7 0-11.9-4.5-13.7-10.5l-7.7 6C6.5 42.6 14.6 48 24 48z"/>
                </svg>
              </span>
            </button>

            <button
              type="button"
              className="oauth-btn"
              disabled={busy}
              onClick={() => withUi(signInWithPopup(auth, microsoftProvider))}
              aria-label="Microsoft"
            >
              <span className="oauth-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path fill="#F25022" d="M11 3H3v8h8z"/><path fill="#7FBA00" d="M21 3h-8v8h8z"/>
                  <path fill="#00A4EF" d="M11 13H3v8h8z"/><path fill="#FFB900" d="M21 13h-8v8h8z"/>
                </svg>
              </span>
            </button>

            <button
              type="button"
              className="oauth-btn"
              disabled={busy}
              onClick={() => withUi(signInWithPopup(auth, appleProvider))}
              aria-label="Apple"
            >
              <span className="oauth-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="img" focusable="false">
                  <path fill="currentColor" d="M16.2 12.5c-.1-2 1.7-3 1.8-3.1-1-1.5-2.6-1.7-3.1-1.7-1.3-.1-2.6.8-3.2.8-.7 0-1.7-.8-2.8-.7-1.4.1-2.7.8-3.4 2-1.5 2.6-.4 6.5 1.1 8.6.8 1.1 1.7 2.3 2.9 2.2 1.1 0 1.5-.7 2.9-.7s1.8.7 2.9.7c1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.6 1.2-2.7-.1-.1-2.3-.9-2.1-3.2zM14.6 5c.6-.7 1-1.7.9-2.7-.9.1-1.9.6-2.6 1.3-.6.6-1.1 1.6-1 2.5 1 .1 2-.5 2.7-1.1z"/>
                </svg>
              </span>
            </button>
          </div>

        {/* Error */}
        {err && (
          <p role="alert" className="mt-4 text-sm text-red-600">{err}</p>
        )}
  
        {/* Subtext */}
        <p className="mt-6 text-center text-sm text-slate-600" style={{ marginTop: "50px" }}>
          Don’t have an account?{" "}
          <a href="/create-team" className="text-blue-700 hover:underline">Create one</a>
        </p>
        </section>
    </main>
  );
}  