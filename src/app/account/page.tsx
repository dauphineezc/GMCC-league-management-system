// /src/app/account/page.tsx
import { redirect } from "next/navigation";
import { getAuth } from "firebase-admin/auth";
import { getServerUser } from "@/lib/serverUser";
import { getUserDoc, upsertUserProfile } from "@/lib/repositories/usersRepo";
import AccountSettingsClient from "@/components/accountSettingsClient";

async function resolveAccountDisplayName(
  uid: string,
  sessionEmail: string | null
): Promise<string> {
  const doc = await getUserDoc(uid);
  const fromDb = String(doc?.displayName ?? "").trim();
  if (fromDb) return fromDb;

  try {
    const firebaseUser = await getAuth().getUser(uid);
    const fbDisplayName = firebaseUser.displayName?.trim() || "";
    const email = firebaseUser.email ?? sessionEmail;

    if (email) {
      await upsertUserProfile({
        id: uid,
        email,
        displayName: fbDisplayName || null,
      });
    }

    return fbDisplayName || email || "";
  } catch {
    return String(doc?.email ?? sessionEmail ?? "");
  }
}

export default async function AccountSettingsPage() {
  const user = await getServerUser();

  if (!user?.id) {
    redirect("/login");
  }

  const displayName = await resolveAccountDisplayName(user.id, user.email);

  const userData = {
    id: user.id,
    email: user.email,
    displayName: displayName || user.email || "",
  };

  return <AccountSettingsClient user={userData} />;
}
