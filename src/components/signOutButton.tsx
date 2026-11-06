"use client";

import { useState } from "react";
import { auth } from "@/lib/firebaseClient";

export default function SignOutButton({
  className,
  children = "Sign out",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {
      // Continue to clear client state even if the server call fails.
    }
    try {
      await auth.signOut();
    } catch {
      // Continue even if client Firebase state is already cleared.
    }
    window.location.replace("/");
  }

  return (
    <button type="button" className={className} onClick={() => void signOut()} disabled={busy}>
      {busy ? "Signing out…" : children}
    </button>
  );
}
