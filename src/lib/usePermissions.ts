"use client";

import { useEffect, useState } from "react";
import type { PermissionLevel } from "@/lib/permissions";

/**
 * Client-side user auth state
 */
export type ClientUser = {
  uid: string;
  email: string | null;
  superadmin: boolean;
  leagueAdminOf: string[] | null;
} | null;

/**
 * Client-side permission checker
 */
export class ClientPermissionChecker {
  constructor(
    private user: ClientUser,
    private leagueId: string
  ) {}

  private get userRole(): PermissionLevel {
    if (!this.user) return "public";
    if (this.user.superadmin) return "superadmin";
    
    // Check if user is admin of this league
    if (this.user.leagueAdminOf?.includes(this.leagueId)) {
      return "admin";
    }
    
    return "player";
  }

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

  getRole(): PermissionLevel {
    return this.userRole;
  }
}

/**
 * React hook for client-side permission checking
 */
export function usePermissions(leagueId: string) {
  const [user, setUser] = useState<ClientUser>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch("/api/me", { cache: "no-store" });
        if (!res.ok) {
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data.auth || null);
      } catch (error) {
        console.error("Failed to fetch user:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, []);

  const checker = new ClientPermissionChecker(user, leagueId);

  return {
    user,
    loading,
    checker,
    // Convenience methods
    can: (level: PermissionLevel) => checker.can(level),
    isSuperAdmin: () => checker.isSuperAdmin(),
    isAdmin: () => checker.isAdmin(),
    isPlayer: () => checker.isPlayer(),
    role: checker.getRole(),
  };
}

