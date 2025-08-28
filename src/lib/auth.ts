// lib/auth.ts
import { headers, cookies } from "next/headers";
import { kv } from "@vercel/kv";

export type Role = "admin" | "player" | "coach" | "ref" | "viewer";

type Profile = {
  roles?: Role[];
  displayName?: string;
};

export async function getSession() {
  const h = headers();
  const c = cookies();

  const userId =
    h.get("x-user-id") ||
    c.get("auth_user")?.value ||
    c.get("dev-user-id")?.value ||
    null;

  if (!userId) return { userId: null, roles: new Set<Role>(), displayName: null as string | null };

  // canonical roles (dev: store once in KV if you want)
  const profile = (await kv.get<Profile>(`user:${userId}:profile`)) || { roles: [] };

  // dev override from the role picker
  const devRole = c.get("dev-role")?.value as Role | undefined;

  const roles = new Set<Role>([...(profile.roles || []), ...(devRole ? [devRole] : [])]);

  return {
    userId,
    roles,
    displayName: profile.displayName || userId,
  };
}

export function hasRole(roles: Set<Role>, role: Role) {
  return roles.has(role);
}