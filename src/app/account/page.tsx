// /src/app/account/page.tsx
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import { kv } from "@vercel/kv";
import { getAuth } from "firebase-admin/auth";
import AccountSettingsClient from "@/components/accountSettingsClient";

async function readUserProfile(uid: string): Promise<{ displayName?: string; email?: string } | null> {
  const key = `user:${uid}`;

  // Try HASH first (HGETALL)
  try {
    const h = (await kv.hgetall(key)) as Record<string, unknown> | null;
    if (h && Object.keys(h).length) {
      return h as { displayName?: string; email?: string };
    }
  } catch {
    // Not a hash, try GET
  }

  // Try GET (object or JSON string)
  try {
    const g = await kv.get(key);
    if (!g) return null;
    if (typeof g === "object") return g as { displayName?: string; email?: string };
    if (typeof g === "string") {
      const s = g.trim();
      if (!s) return null;
      try {
        return JSON.parse(s) as { displayName?: string; email?: string };
      } catch {
        return null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

async function getUserDisplayName(uid: string): Promise<string> {
  // 1) Check KV store first
  const kvProfile = await readUserProfile(uid);
  const kvDisplayName = kvProfile?.displayName?.trim();
  if (kvDisplayName) return kvDisplayName;

  // 2) Fall back to Firebase Auth
  try {
    const firebaseUser = await getAuth().getUser(uid);
    const fbDisplayName = firebaseUser.displayName?.trim();
    if (fbDisplayName) {
      // Cache it back to KV for next time
      try {
        const current = kvProfile || {};
        await kv.hset(`user:${uid}`, {
          ...current,
          displayName: fbDisplayName,
          email: firebaseUser.email || current.email,
        });
      } catch {
        // Cache write failed, but we still have the displayName
      }
      return fbDisplayName;
    }
  } catch {
    // Firebase fetch failed, continue with fallback
  }

  // 3) If no displayName found anywhere, return empty string
  return "";
}

export default async function AccountSettingsPage() {
  const user = await getServerUser();
  
  if (!user?.id) {
    redirect("/login");
  }

  // Fetch displayName from KV cache or Firebase Auth
  const displayName = await getUserDisplayName(user.id);

  const userData = {
    id: user.id,
    email: user.email,
    displayName: displayName || user.email || "",
  };

  return <AccountSettingsClient user={userData} />;
}
