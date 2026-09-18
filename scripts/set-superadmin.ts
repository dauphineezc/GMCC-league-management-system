/**
 * Grant (or revoke) Firebase customClaims.superadmin for a user by email.
 *
 * Usage:
 *   npx tsx scripts/set-superadmin.ts someone@example.com
 *   npx tsx scripts/set-superadmin.ts someone@example.com --revoke
 *   npx tsx scripts/set-superadmin.ts someone@example.com --check
 */
import { config } from "dotenv";
import { resolve } from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function main() {
  const email = process.argv[2];
  const revoke = process.argv.includes("--revoke");
  const checkOnly = process.argv.includes("--check");

  if (!email || email.startsWith("--")) {
    console.error(
      "Usage: npx tsx scripts/set-superadmin.ts <email> [--check|--revoke]"
    );
    process.exit(1);
  }

  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = requireEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId,
    });
  }

  const auth = getAuth();
  const user = await auth.getUserByEmail(email);
  const before = user.customClaims ?? {};

  console.log("--- Before ---");
  console.log("email:", user.email);
  console.log("uid:", user.uid);
  console.log("customClaims:", JSON.stringify(before, null, 2));

  if (checkOnly) {
    console.log(
      before.superadmin === true
        ? "\nResult: this user ALREADY has superadmin=true"
        : "\nResult: this user does NOT have superadmin claim"
    );
    return;
  }

  const next = { ...before, superadmin: !revoke };
  await auth.setCustomUserClaims(user.uid, next);

  const after = (await auth.getUser(user.uid)).customClaims ?? {};
  console.log("\n--- After ---");
  console.log("customClaims:", JSON.stringify(after, null, 2));
  console.log(
    revoke
      ? "\nDone: removed superadmin claim."
      : "\nDone: set superadmin=true."
  );
  console.log(
    "They must sign out and sign back in for the session cookie to refresh."
  );
}

main().catch((err) => {
  console.error("FAILED:", err?.message ?? err);
  process.exit(1);
});
