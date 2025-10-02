// /src/app/logout/page.tsx
"use client";
import { useEffect } from "react";
import { auth } from "@/lib/firebaseClient";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try {
        await fetch("/api/auth/session", { method: "DELETE", credentials: "include" });
      } catch {}
      try {
        await auth.signOut();
      } catch {}
      // Force a full reload so the server re-renders the navbar with no session
      location.replace("/");
    })();
  }, []);
  return <p className="p-6">Signing you out…</p>;
}