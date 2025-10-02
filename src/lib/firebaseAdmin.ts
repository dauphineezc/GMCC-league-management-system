// /src/lib/firebaseAdmin.ts
import "server-only";
import { getApps, initializeApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/** Build a credential from env or fall back to ADC */
function makeCredential() {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    return cert({
      projectId,
      clientEmail,
      // Handle escaped newlines from .env
      privateKey: privateKey.replace(/\\n/g, "\n"),
    });
  }
  // Fallback to GOOGLE_APPLICATION_CREDENTIALS / default credentials if set
  return applicationDefault();
}

/** Idempotent Admin initialization (safe in dev hot-reloads) */
export function getAdminApp(): App {
  return getApps()[0] ?? initializeApp({
    credential: makeCredential(),
    projectId: process.env.FIREBASE_PROJECT_ID || undefined,
  });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** Back-compat: many routes import { adminAuth } directly */
export const adminAuth: Auth = getAdminAuth();