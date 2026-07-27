"use client";

import { auth } from "@/lib/firebaseClient";

export function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin parent blocks access to window.top — we're embedded.
    return true;
  }
}

export async function requestEmbedStorageAccess(): Promise<boolean> {
  if (!isEmbedded()) return true;
  if (typeof document.requestStorageAccess !== "function") return true;

  try {
    if (typeof document.hasStorageAccess === "function") {
      if (await document.hasStorageAccess()) return true;
    }
    await document.requestStorageAccess();
    if (typeof document.hasStorageAccess === "function") {
      return document.hasStorageAccess();
    }
    return true;
  } catch {
    return false;
  }
}

export async function establishSession(embedded = isEmbedded()): Promise<void> {
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) throw new Error("Missing authentication token");

  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken, embedded }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to establish session");
  }
}

export async function waitForServerSession(): Promise<boolean> {
  for (let i = 0; i < 10; i++) {
    const res = await fetch("/api/me", { credentials: "include", cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (data?.auth?.uid) return true;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return false;
}

export async function prepareEmbeddedSession(): Promise<void> {
  if (!isEmbedded()) return;

  const hasAccess = await requestEmbedStorageAccess();
  if (!hasAccess) {
    throw new Error(
      "Your browser blocked sign-in inside the embedded view. Use “Open in new tab” below, or allow cookies for this site."
    );
  }
}

export async function finalizeClientSession(): Promise<void> {
  await prepareEmbeddedSession();
  await establishSession();
  const ok = await waitForServerSession();
  if (!ok) {
    const hint = isEmbedded()
      ? " Sign-in succeeded but the session cookie was blocked. Try opening the app in a new tab."
      : "";
    throw new Error(`Could not establish a session.${hint}`);
  }
}

export function embedFallbackUrl(path = "/login"): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.href).href;
}

export async function clearSession(): Promise<void> {
  await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embedded: isEmbedded() }),
  });
}
