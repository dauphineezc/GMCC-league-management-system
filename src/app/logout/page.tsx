// /src/app/logout/page.tsx
"use client";
import { useEffect } from "react";
import { auth } from "@/lib/firebaseClient";
import { clearSession } from "@/lib/embedAuth";

export default function LogoutPage() {
  useEffect(() => {
    (async () => {
      try {
        await clearSession();
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