import type { ServerUser } from "@/lib/serverUser";
import { isLeagueAdminAsync } from "@/lib/serverUser";

/**
 * Permission levels for feature gating
 */
export type PermissionLevel = "public" | "player" | "admin" | "superadmin";

/**
 * Check if user has at least the required permission level for a league
 */
export async function hasLeaguePermission(
  user: ServerUser | null,
  leagueId: string,
  requiredLevel: PermissionLevel
): Promise<boolean> {
  // Public - anyone can access
  if (requiredLevel === "public") return true;

  // Anything beyond public requires a user
  if (!user) return false;

  // Player - any logged-in user
  if (requiredLevel === "player") return true;

  // Admin - must be league admin or superadmin
  if (requiredLevel === "admin") {
    return await isLeagueAdminAsync(user, leagueId);
  }

  // Superadmin - must be superadmin
  if (requiredLevel === "superadmin") {
    return user.superadmin === true;
  }

  return false;
}

/**
 * Get the user's effective role for a league
 */
export async function getUserLeagueRole(
  user: ServerUser | null,
  leagueId: string
): Promise<PermissionLevel> {
  if (!user) return "public";
  
  if (user.superadmin) return "superadmin";
  
  const isAdmin = await isLeagueAdminAsync(user, leagueId);
  if (isAdmin) return "admin";
  
  return "player";
}

/**
 * Hook-like utility for components to check permissions
 */
export class PermissionChecker {
  constructor(
    private user: ServerUser | null,
    private leagueId: string,
    private userRole: PermissionLevel
  ) {}

  can(level: PermissionLevel): boolean {
    const levels: PermissionLevel[] = ["public", "player", "admin", "superadmin"];
    const userLevelIndex = levels.indexOf(this.userRole);
    const requiredLevelIndex = levels.indexOf(level);
    return userLevelIndex >= requiredLevelIndex;
  }

  isSuperAdmin(): boolean {
    return this.userRole === "superadmin";
  }

  isAdmin(): boolean {
    return this.userRole === "admin" || this.userRole === "superadmin";
  }

  isPlayer(): boolean {
    return this.userRole !== "public";
  }

  static async create(user: ServerUser | null, leagueId: string) {
    const role = await getUserLeagueRole(user, leagueId);
    return new PermissionChecker(user, leagueId, role);
  }
}

