import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

export type FirebaseUserLite = {
  uid: string;
  email: string | null;
  displayName: string | null;
  isSuperadmin: boolean;
};

function getExportAdminApp() {
  return (
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID!,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
      }),
      projectId: process.env.FIREBASE_PROJECT_ID,
    })
  );
}

/** List Firebase users for KV export (standalone — no server-only import). */
export async function listFirebaseUsersForExport(): Promise<Map<string, FirebaseUserLite>> {
  const map = new Map<string, FirebaseUserLite>();
  const superEmails = new Set(
    String(process.env.SUPERADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );

  const auth = getAuth(getExportAdminApp());
  let token: string | undefined;

  do {
    const res = await auth.listUsers(1000, token);
    for (const u of res.users) {
      const email = u.email?.toLowerCase() ?? null;
      map.set(u.uid, {
        uid: u.uid,
        email,
        displayName: u.displayName ?? null,
        isSuperadmin:
          Boolean(u.customClaims?.superadmin) || (email ? superEmails.has(email) : false),
      });
    }
    token = res.pageToken;
  } while (token);

  return map;
}
