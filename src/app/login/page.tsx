// /src/app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, googleProvider, appleProvider, microsoftProvider } from "@/lib/firebaseClient";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
  sendPasswordResetEmail,
} from "firebase/auth";

// ---------- helpers ----------
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
async function waitForServerSession(): Promise<boolean> {
  for (let i = 0; i < 8; i++) {
    const r = await fetch("/api/me", { credentials: "include", cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (j?.auth?.uid) return true;
    await new Promise(res => setTimeout(res, 120));
  }
  return false;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);

  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  async function finish() {
    await establishSession();
    await waitForServerSession();
    const me = await getMe();
    const target = next && next !== "/" ? next : targetFromMe(me);
    location.assign(target);
  }

  async function withUi(action: () => Promise<void>) {
    setErr(null); setBusy(true);
    try { await action(); }
    catch (e: any) { setErr(e?.message ?? "Authentication failed"); }
    finally { setBusy(false); }
  }

  // Only allow sign-in for EXISTING accounts
  async function signInExistingWithEmail() {
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pw);
      await finish();
    } catch (e: any) {
      // If user doesn't exist, push to create-account with prefilled email
      if (e?.code === "auth/user-not-found") {
        router.push(`/create-account?email=${encodeURIComponent(email.trim())}`);
        return;
      }
      throw e;
    }
  }

  async function signInExistingWithProvider(provider: any) {
    const cred = await signInWithPopup(auth, provider);
    const info = getAdditionalUserInfo(cred);
    // If Firebase marks this as a new user, don't allow sign-in here.
    if (info?.isNewUser) {
      await auth.signOut();
      const prefillEmail = cred.user?.email ? `?email=${encodeURIComponent(cred.user.email)}` : "";
      router.push(`/create-account${prefillEmail}`);
      return;
    }
    await finish();
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      setErr("Please enter your email address");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetEmailSent(true);
      setErr(null);
    } catch (e: any) {
      if (e?.code === "auth/user-not-found") {
        setErr("No account found with this email address");
      } else if (e?.code === "auth/invalid-email") {
        setErr("Invalid email address");
      } else {
        setErr(e?.message ?? "Failed to send reset email");
      }
    }
  }

  return (
    <main style={{ padding: 20, display: "grid", gap: 10 }}>
      <section />
      <section className="auth-card w-full" style={{ justifySelf: "center", justifyItems: "center", minHeight: "500px", padding: "32px", maxWidth: "600px", width: "100%" }}>
        <h2 className="content-title" style={{ marginBottom: "35px" }}>
          {forgotPasswordMode ? "Reset your password" : "Welcome back! Please enter your details."}
        </h2>

        {resetEmailSent ? (
          <div className="space-y-6" style={{ width: "100%" }}>
            <div className="p-4 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                Password reset email sent! Please check your inbox at <strong>{email}</strong> for instructions to reset your password.
              </p>
            </div>
            <button
              type="button"
              className="brand-btn auth-primary"
              onClick={() => {
                setResetEmailSent(false);
                setForgotPasswordMode(false);
                setEmail("");
                setErr(null);
              }}
              style={{ marginTop: "30px" }}
            >
              Back to Sign In
            </button>
          </div>
        ) : forgotPasswordMode ? (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void withUi(handleForgotPassword);
            }}
          >
            <p className="text-sm text-slate-600 mb-4">
              Enter your email address and we'll send you instructions to reset your password.
            </p>
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

            <button type="submit" className="brand-btn auth-primary" disabled={busy} aria-busy={busy} style={{ marginTop: "30px", marginBottom: "10px" }}>
              {busy ? "Sending…" : "Send Reset Email"}
            </button>
            
            <button
              type="button"
              className="text-blue-700 hover:underline text-sm"
              onClick={() => {
                setForgotPasswordMode(false);
                setErr(null);
              }}
              disabled={busy}
              style={{ display: "block", margin: "0 auto" }}
            >
              Back to Sign In
            </button>
          </form>
        ) : (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
              void withUi(signInExistingWithEmail);
            }}
          >
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
              <button
                type="button"
                className="auth-link--small auth-forgot"
                onClick={(e) => {
                  e.preventDefault();
                  setForgotPasswordMode(true);
                  setErr(null);
                }}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
              >
                Forgot password?
              </button>
            </div>

            <button type="submit" className="brand-btn auth-primary" disabled={busy} aria-busy={busy} style={{ marginTop: "30px", marginBottom: "30px" }}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}

        {!forgotPasswordMode && !resetEmailSent && (
          <>
            <div className="mt-6 mb-4">
              <p className="text-center text-slate-600">or continue with</p>
            </div>

            <div className="oauth-buttons-container" style={{ display: 'flex', flexDirection: 'row', gap: '12px', justifyContent: 'center' }}>
              <button type="button" className="oauth-btn" disabled={busy} onClick={() => withUi(() => signInExistingWithProvider(googleProvider))} aria-label="Google">
                <span className="oauth-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </span>
              </button>
              <button type="button" className="oauth-btn" disabled={busy} onClick={() => withUi(() => signInExistingWithProvider(microsoftProvider))} aria-label="Microsoft">
                <span className="oauth-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#F25022" d="M1 1h10v10H1z"/>
                    <path fill="#00A4EF" d="M13 1h10v10H13z"/>
                    <path fill="#7FBA00" d="M1 13h10v10H1z"/>
                    <path fill="#FFB900" d="M13 13h10v10H13z"/>
                  </svg>
                </span>
              </button>
              <button type="button" className="oauth-btn" disabled={busy} onClick={() => withUi(() => signInExistingWithProvider(appleProvider))} aria-label="Apple">
                <span className="oauth-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="24" height="24">
                    <path fill="#000000" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </span>
              </button>
            </div>
          </>
        )}

        {err && <p role="alert" className="mt-4 text-sm text-red-600">{err}</p>}

        {!forgotPasswordMode && !resetEmailSent && (
          <p className="mt-6 text-center text-sm text-slate-600" style={{ marginTop: "50px" }}>
            Don't have an account?{" "}
            <a href="/create-account" className="text-blue-700 hover:underline">Create one here</a>
          </p>
        )}
      </section>
    </main>
  );
}