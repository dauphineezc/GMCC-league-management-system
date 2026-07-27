"use client";

import { auth } from "@/lib/firebaseClient";

export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function fullAppUrl(path = "/login"): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.href).href;
}

export function openAppInNewTab(path = "/login"): void {
  window.open(fullAppUrl(path), "_blank", "noopener,noreferrer");
}

async function establishSession(): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) throw new Error("Missing authentication token");

  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to establish session");
  }
}

async function waitForServerSession(): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data?.auth?.uid) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

export async function finalizeClientSession(): Promise<void> {
  await establishSession();
  const ok = await waitForServerSession();
  if (!ok) {
    throw new Error("Could not establish a session. Please try again.");
  }
}
