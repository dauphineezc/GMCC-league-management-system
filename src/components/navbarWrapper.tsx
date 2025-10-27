// /src/components/navbarWrapper.tsx
import { getServerUser } from "@/lib/serverUser";
import Navbar from "./navbar";
import { kv } from "@vercel/kv";

export const dynamic = "force-dynamic"; // <-- ensure navbar re-renders per request

async function smembersSafe(key: string): Promise<string[]> {
  try {
    const v = (await kv.smembers<string[]>(key)) ?? [];
    return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

export default async function NavbarWrapper() {
  const user = await getServerUser();
  
  // Check if user has admin leagues in KV (same logic as homepage)
  let hasAdminLeagues = false;
  if (user && !user.superadmin) {
    const adminKey = `admin:${user.id}:leagues`;
    let managed = await smembersSafe(adminKey);
    
    // Legacy email set check
    if (!managed.length && user.email) {
      const legacy = await smembersSafe(`admin:${user.email}:leagues`);
      if (legacy.length) {
        await kv.sadd(adminKey, ...legacy);
        managed = legacy;
      }
    }
    
    hasAdminLeagues = managed.length > 0;
  }
  
  return <Navbar user={user} hasAdminLeagues={hasAdminLeagues} />;
}

