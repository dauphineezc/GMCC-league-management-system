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
      <section className="auth-card w-full" style={{ justifySelf: "center", justifyItems: "center", minHeight: "500px", padding: "32px", maxWidth: "600px", width: "100%" }}>
        <h2 className="content-title" style={{ marginBottom: "35px", textAlign: "center" }}>
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
            {/* <div className="mt-6 mb-4 text-center">
              <p className="text-center text-slate-600">or continue with</p>
            </div> */}
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => withUi(() => signInExistingWithProvider(googleProvider))}
                aria-label="Sign in with Google"
                onMouseEnter={(e) => {
                  if (busy) return;
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.filter = "brightness(1.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.filter = "none";
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                  height: 44,
                  minWidth: 280,
                  padding: "0 16px",
                  border: "1px solidrgb(205, 208, 214)",
                  borderRadius: 6,
                  background: "#fff",
                  color: "var(--navy)",
                  fontWeight: 500,
                  boxShadow: "0 1px 1px rgba(0,0,0,.05)",
                  cursor: "pointer",
                  // transition: "transform 150ms ease-out, filter 150ms ease-out"
                }}
              >
                <svg
                  viewBox="0 0 24 24"
                  width="20"
                  height="20"
                  aria-hidden="true"
                  focusable="false"
                  style={{ display: "block", flexShrink: 0 }}
                >
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span style={{ whiteSpace: "nowrap" }}>Sign in with Google</span>
              </button>
            </div>
          </>
        )}

        {err && <p role="alert" className="mt-4 text-sm text-red-600">{err}</p>}

        {!forgotPasswordMode && !resetEmailSent && (
          <p className="mt-6 text-center text-sm text-slate-600" style={{ marginTop: "50px", textAlign: "center" }}>
            Don't have an account?{" "}
            <a href="/create-account" className="text-blue-700 hover:underline">Create one here</a>
          </p>
        )}
      </section>
    </main>
  );
}