// /src/app/create-account/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, googleProvider, appleProvider, microsoftProvider } from "@/lib/firebaseClient";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  getAdditionalUserInfo,
} from "firebase/auth";

type Gender = "FEMALE" | "MALE" | "NONBINARY" | "PREFER_NOT_TO_SAY" | "OTHER";

async function establishSession() {
  const idToken = await auth.currentUser?.getIdToken(true);
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken }),
  });
}

export default function CreateAccountPage() {
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [gender, setGender] = useState<Gender>("PREFER_NOT_TO_SAY");
  const [dob, setDob] = useState(""); // yyyy-mm-dd
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const router = useRouter();
  const params = useSearchParams();
  const prefillEmail = params.get("email");
  useEffect(() => { if (prefillEmail) setEmail(prefillEmail); }, [prefillEmail]);

  const profilePayload = useMemo(() => ({
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    gender,
    dob, // keep as yyyy-mm-dd; backend can normalize to ISO date if desired
  }), [firstName, lastName, gender, dob]);

  function validateProfile() {
    if (!profilePayload.firstName || !profilePayload.lastName) return "Please enter your first and last name.";
    if (!dob) return "Please enter your date of birth.";
    return null;
  }

  async function postProfile() {
    const r = await fetch("/api/users/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(profilePayload),
    });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(t || "Failed to save profile");
    }
  }

  async function complete() {
    await establishSession();
    await postProfile();
    router.replace("/player"); // neutral landing; can navigate to create/join team from here
  }

  async function createWithEmail() {
    const v = validateProfile();
    if (v) { setErr(v); return; }
    setErr(null); setBusy(true);
    try {
      await createUserWithEmailAndPassword(auth, email.trim(), pw);
      await complete();
    } catch (e: any) {
      setErr(e?.message ?? "Account creation failed");
    } finally {
      setBusy(false);
    }
  }

  async function createWithProvider(provider: any) {
    const v = validateProfile();
    if (v) { setErr(v); return; }
    setErr(null); setBusy(true);
    try {
      const cred = await signInWithPopup(auth, provider);
      const info = getAdditionalUserInfo(cred);
      // If this provider maps to an existing user, this is not “create”—send to login.
      if (!info?.isNewUser) {
        await auth.signOut();
        setErr("This sign-in already exists. Please sign in instead.");
        return;
      }
      await complete();
    } catch (e: any) {
      setErr(e?.message ?? "Account creation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main style={{ padding: 20, display: "grid", gap: 10 }}>
      <section className="auth-card w-full" style={{ justifySelf: "center", justifyItems: "center", minHeight: "500px", padding: "32px", maxWidth: "640px", width: "100%" }}>
        <h2 className="content-title" style={{ marginBottom: 24 }}>Create your account</h2>

        <div className="space-y-4" style={{ width: "100%" }}>
          <div className="auth-row">
            <label className="auth-label">First name</label>
            <input className="auth-input" value={firstName} onChange={e => setFirst(e.target.value)} required />
          </div>
          <div className="auth-row">
            <label className="auth-label">Last name</label>
            <input className="auth-input" value={lastName} onChange={e => setLast(e.target.value)} required />
          </div>
          <div className="auth-row">
            <label className="auth-label">Gender</label>
            <select className="auth-input" value={gender} onChange={e => setGender(e.target.value as Gender)}>
              <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
              <option value="NONBINARY">Non-binary</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="auth-row">
            <label className="auth-label">Date of birth</label>
            <input className="auth-input" type="date" value={dob} onChange={e => setDob(e.target.value)} required />
          </div>
        </div>

        <hr className="my-6" />

        <div className="space-y-2" style={{ width: "100%" }}>
          <h3 className="text-sm text-slate-600">Create with email</h3>
          <div className="auth-row">
            <label className="auth-label">Email</label>
            <input className="auth-input" value={email} onChange={e => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" />
          </div>
          <div className="auth-row">
            <label className="auth-label">Password</label>
            <input className="auth-input" value={pw} onChange={e => setPw(e.target.value)} type="password" autoComplete="new-password" />
          </div>
          <button className="brand-btn auth-primary" disabled={busy} onClick={() => void createWithEmail()}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </div>

        <div className="mt-6 mb-4">
          <p className="text-center text-slate-600">or continue with</p>
        </div>
        <div className="oauth-buttons-container" style={{ display: 'flex', flexDirection: 'row', gap: '12px', justifyContent: 'center' }}>
          <button type="button" className="oauth-btn" disabled={busy} onClick={() => void createWithProvider(googleProvider)} aria-label="Google">
            <span className="oauth-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
            </span>
          </button>
          <button type="button" className="oauth-btn" disabled={busy} onClick={() => void createWithProvider(microsoftProvider)} aria-label="Microsoft">
            <span className="oauth-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="#F25022" d="M1 1h10v10H1z"/>
                <path fill="#00A4EF" d="M13 1h10v10H13z"/>
                <path fill="#7FBA00" d="M1 13h10v10H1z"/>
                <path fill="#FFB900" d="M13 13h10v10H13z"/>
              </svg>
            </span>
          </button>
          <button type="button" className="oauth-btn" disabled={busy} onClick={() => void createWithProvider(appleProvider)} aria-label="Apple">
            <span className="oauth-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="24" height="24">
                <path fill="#000000" d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
            </span>
          </button>
        </div>

        {err && <p role="alert" className="mt-4 text-sm text-red-600">{err}</p>}

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account? <a href="/login" className="text-blue-700 hover:underline">Sign in</a>
        </p>
      </section>
    </main>
  );
}