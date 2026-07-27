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
  await establishSessionWithToken(idToken, embedded);
}

export async function establishSessionWithToken(
  idToken: string,
  embedded = isEmbedded()
): Promise<void> {
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

export type GoogleAuthMessage =
  | {
      type: "gmcc-google-auth";
      status: "success";
      idToken: string;
      isNewUser?: boolean;
      email?: string | null;
    }
  | { type: "gmcc-google-auth"; status: "cancelled" }
  | { type: "gmcc-google-auth"; status: "error"; error: string };

const GOOGLE_BRIDGE_PATH = "/login/google-bridge";

export function isGoogleAuthMessage(data: unknown): data is GoogleAuthMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as GoogleAuthMessage).type === "gmcc-google-auth"
  );
}

export function openEmbeddedGoogleSignIn(): Window | null {
  const url = embedFallbackUrl(GOOGLE_BRIDGE_PATH);
  return window.open(
    url,
    "gmcc-google-signin",
    "popup=yes,width=520,height=640,noopener=no,noreferrer=no"
  );
}

export async function completeEmbeddedGoogleSignIn(idToken: string): Promise<void> {
  await prepareEmbeddedSession();
  await establishSessionWithToken(idToken, true);
  const ok = await waitForServerSession();
  if (!ok) {
    throw new Error(
      "Google sign-in succeeded but the session cookie was blocked. Try refreshing the page."
    );
  }
}

export function waitForEmbeddedGoogleAuth(): Promise<{
  idToken: string;
  isNewUser: boolean;
  email: string | null;
}> {
  const popup = openEmbeddedGoogleSignIn();
  if (!popup) {
    return Promise.reject(
      new Error(
        "Your browser blocked the Google sign-in popup. Allow popups for this site, or use email sign-in."
      )
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;

    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Google sign-in timed out. Please try again."));
    }, 5 * 60 * 1000);

    function cleanup() {
      window.clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (!isGoogleAuthMessage(event.data)) return;

      if (settled) return;
      settled = true;
      cleanup();

      if (event.data.status === "success") {
        resolve({
          idToken: event.data.idToken,
          isNewUser: Boolean(event.data.isNewUser),
          email: event.data.email ?? null,
        });
        return;
      }

      if (event.data.status === "cancelled") {
        reject(new Error("Google sign-in was cancelled."));
        return;
      }

      reject(new Error(event.data.error ?? "Google sign-in failed."));
    }

    window.addEventListener("message", onMessage);
  });
}
