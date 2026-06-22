import "server-only";
import { getAuth } from "firebase-admin/auth";
import { getUserDoc, upsertUserProfile } from "@/lib/repositories/usersRepo";

export async function getAdminDisplayName(uid: string | null): Promise<string | null> {
  if (!uid) return null;

  const fromDb = await getUserDoc(uid);
  const fromDbName = String(fromDb?.displayName ?? "").trim();
  if (fromDbName) return fromDbName;

  try {
    const u = await getAuth().getUser(uid);
    const fbDisplay = u.displayName?.trim() || null;
    const fbEmail = u.email?.trim() || null;

    if (fbEmail) {
      await upsertUserProfile({
        id: uid,
        email: fbEmail,
        displayName: fbDisplay,
      });
    }

    return fbDisplay || String(fromDb?.email ?? "").trim() || fbEmail || null;
  } catch {
    return String(fromDb?.email ?? "").trim() || null;
  }
}
