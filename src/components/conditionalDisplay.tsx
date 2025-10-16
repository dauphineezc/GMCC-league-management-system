import type { PermissionLevel } from "@/lib/permissions";
import type { PermissionChecker } from "@/lib/permissions";

/**
 * Component that only renders children if user has required permission level
 */
export function IfPermission({
  checker,
  level,
  children,
  fallback = null,
}: {
  checker: PermissionChecker;
  level: PermissionLevel;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return checker.can(level) ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component that only renders for superadmins
 */
export function IfSuperAdmin({
  checker,
  children,
  fallback = null,
}: {
  checker: PermissionChecker;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return checker.isSuperAdmin() ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component that only renders for admins (including superadmins)
 */
export function IfAdmin({
  checker,
  children,
  fallback = null,
}: {
  checker: PermissionChecker;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return checker.isAdmin() ? <>{children}</> : <>{fallback}</>;
}

/**
 * Component that only renders for logged-in users
 */
export function IfPlayer({
  checker,
  children,
  fallback = null,
}: {
  checker: PermissionChecker;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return checker.isPlayer() ? <>{children}</> : <>{fallback}</>;
}

