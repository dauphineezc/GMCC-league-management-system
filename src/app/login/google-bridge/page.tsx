"use client";

import { Suspense, useEffect, useState } from "react";
import { auth, googleProvider } from "@/lib/firebaseClient";
import {
  getRedirectResult,
  signInWithRedirect,
  signInWithPopup,
  getAdditionalUserInfo,
} from "firebase/auth";

function postToOpener(message: Record<string, unknown>) {
  if (!window.opener || window.opener.closed) return;
  window.opener.postMessage(message, window.location.origin);
}

function GoogleBridgeContent() {
  const [message, setMessage] = useState("Connecting to Google…");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        let cred = await getRedirectResult(auth);

        if (!cred) {
          if (window.opener && !window.opener.closed) {
            await signInWithRedirect(auth, googleProvider);
            return;
          }

          setMessage("Opening Google sign-in…");
          cred = await signInWithPopup(auth, googleProvider);
        }

        const idToken = await cred.user.getIdToken(true);
        const info = getAdditionalUserInfo(cred);
        postToOpener({
          type: "gmcc-google-auth",
          status: "success",
          idToken,
          isNewUser: Boolean(info?.isNewUser),
          email: cred.user.email,
        });
        setMessage("Signed in. You can close this window.");
        window.close();
      } catch (e: any) {
        if (cancelled) return;

        const code = e?.code ?? "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") {
          postToOpener({ type: "gmcc-google-auth", status: "cancelled" });
          setMessage("Sign-in cancelled.");
          window.close();
          return;
        }

        postToOpener({
          type: "gmcc-google-auth",
          status: "error",
          error: e?.message ?? "Google sign-in failed",
        });
        setMessage(e?.message ?? "Google sign-in failed.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={{ padding: 24, textAlign: "center" }}>
      <p style={{ margin: 0, color: "var(--navy)" }}>{message}</p>
    </main>
  );
}

export default function GoogleBridgePage() {
  return (
    <Suspense fallback={<main style={{ padding: 24, textAlign: "center" }}>Loading…</main>}>
      <GoogleBridgeContent />
    </Suspense>
  );
}
