// /src/app/logout/page.tsx
"use client";

import { useEffect } from "react";
import { auth } from "@/lib/firebaseClient";

export default function LogoutPage() {
  useEffect(() => {
    void (async () => {
      try {
        await auth.signOut();
      } catch {
        // Continue even if client Firebase state is already cleared.
      }
      window.location.replace("/api/auth/logout");
    })();
  }, []);

  return <p className="p-6">Signing you out…</p>;
}
