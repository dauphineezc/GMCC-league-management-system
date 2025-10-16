# Permission System Usage Examples

## Server Component Examples

### Example 1: Basic Conditional Rendering

```tsx
// app/leagues/[leagueId]/page.tsx
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { IfAdmin, IfSuperAdmin } from "@/components/conditionalDisplay";

export default async function LeaguePage({ params }: { params: { leagueId: string } }) {
  const user = await getServerUser();
  const permissions = await PermissionChecker.create(user, params.leagueId);

  return (
    <main>
      <h1>League Details</h1>
      
      {/* Public: Everyone sees this */}
      <section>
        <h2>Teams</h2>
        {/* ... teams list */}
      </section>

      {/* Admin-only section */}
      <IfAdmin checker={permissions}>
        <section>
          <h2>Admin Controls</h2>
          <button>Approve Teams</button>
          <button>Upload Schedule</button>
        </section>
      </IfAdmin>

      {/* Superadmin-only section */}
      <IfSuperAdmin checker={permissions}>
        <section>
          <h2>Superadmin Controls</h2>
          <button>Assign League Admin</button>
        </section>
      </IfSuperAdmin>
    </main>
  );
}
```

### Example 2: Conditional Data Fetching

```tsx
// app/leagues/[leagueId]/page.tsx
export default async function LeaguePage({ params }: { params: { leagueId: string } }) {
  const user = await getServerUser();
  const permissions = await PermissionChecker.create(user, params.leagueId);

  // Always fetch public data
  const teams = await fetchTeams(params.leagueId);
  
  // Conditionally fetch admin data
  let adminData = null;
  if (permissions.isAdmin()) {
    adminData = await fetchAdminData(params.leagueId);
  }

  return (
    <main>
      <PublicView teams={teams} />
      
      <IfAdmin checker={permissions}>
        <AdminView data={adminData} />
      </IfAdmin>
    </main>
  );
}
```

### Example 3: Different Views with Fallback

```tsx
// app/team/[teamId]/page.tsx
export default async function TeamPage({ params }: { params: { teamId: string } }) {
  const user = await getServerUser();
  const permissions = await PermissionChecker.create(user, params.teamId);

  return (
    <main>
      <IfAdmin 
        checker={permissions}
        fallback={<PublicTeamView teamId={params.teamId} />}
      >
        <AdminTeamView teamId={params.teamId} />
      </IfAdmin>
    </main>
  );
}
```

### Example 4: Multiple Permission Levels

```tsx
import { IfPermission } from "@/components/conditionalDisplay";

export default async function LeaguePage({ params }: { params: { leagueId: string } }) {
  const user = await getServerUser();
  const permissions = await PermissionChecker.create(user, params.leagueId);

  return (
    <main>
      {/* Public - everyone */}
      <IfPermission checker={permissions} level="public">
        <PublicContent />
      </IfPermission>

      {/* Player - logged in users */}
      <IfPermission checker={permissions} level="player">
        <button>Join Team</button>
      </IfPermission>

      {/* Admin - league admins and superadmins */}
      <IfPermission checker={permissions} level="admin">
        <button>Manage League</button>
      </IfPermission>

      {/* Superadmin - only superadmins */}
      <IfPermission checker={permissions} level="superadmin">
        <button>Delete League</button>
      </IfPermission>
    </main>
  );
}
```

## Client Component Examples

### Example 5: Interactive Client Component

```tsx
"use client";

import { usePermissions } from "@/lib/usePermissions";
import { IfAdminClient } from "@/components/conditionalDisplay.client";

export default function InteractiveLeagueControls({ leagueId }: { leagueId: string }) {
  const { checker, loading, isAdmin } = usePermissions(leagueId);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <IfAdminClient checker={checker}>
        <button onClick={() => console.log("Admin action")}>
          Admin Button
        </button>
      </IfAdminClient>
      
      {/* Or use the convenience methods directly */}
      {isAdmin() && (
        <button>Another Admin Button</button>
      )}
    </div>
  );
}
```

### Example 6: Conditional Form Fields

```tsx
"use client";

import { usePermissions } from "@/lib/usePermissions";

export default function TeamForm({ leagueId, teamId }: { leagueId: string; teamId: string }) {
  const { checker, loading } = usePermissions(leagueId);

  if (loading) return <div>Loading...</div>;

  return (
    <form>
      {/* Everyone can edit team name */}
      <input name="teamName" placeholder="Team Name" />
      
      {/* Only admins can approve teams */}
      {checker.isAdmin() && (
        <label>
          <input type="checkbox" name="approved" />
          Team Approved
        </label>
      )}
      
      {/* Only superadmins can delete teams */}
      {checker.isSuperAdmin() && (
        <button type="button" className="btn-danger">
          Delete Team
        </button>
      )}
    </form>
  );
}
```

### Example 7: Role-Based Navigation

```tsx
"use client";

import { usePermissions } from "@/lib/usePermissions";
import Link from "next/link";

export function LeagueNavigation({ leagueId }: { leagueId: string }) {
  const { role, loading } = usePermissions(leagueId);

  if (loading) return null;

  return (
    <nav>
      <Link href={`/leagues/${leagueId}`}>Overview</Link>
      <Link href={`/leagues/${leagueId}/schedule`}>Schedule</Link>
      
      {(role === "admin" || role === "superadmin") && (
        <>
          <Link href={`/leagues/${leagueId}/manage-teams`}>Manage Teams</Link>
          <Link href={`/leagues/${leagueId}/upload-schedule`}>Upload Schedule</Link>
        </>
      )}
      
      {role === "superadmin" && (
        <Link href={`/leagues/${leagueId}/settings`}>League Settings</Link>
      )}
    </nav>
  );
}
```

## API Route Examples

### Example 8: Protected API Route

```tsx
// app/api/leagues/[leagueId]/approve/route.ts
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { hasLeaguePermission } from "@/lib/permissions";

export async function POST(
  req: Request,
  { params }: { params: { leagueId: string } }
) {
  const user = await getServerUser();
  
  // Check if user has admin permission
  if (!(await hasLeaguePermission(user, params.leagueId, "admin"))) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 403 }
    );
  }

  // User is authorized, proceed with action
  const { teamId } = await req.json();
  // ... approve team logic
  
  return NextResponse.json({ success: true });
}
```

### Example 9: Different Actions for Different Roles

```tsx
// app/api/leagues/[leagueId]/route.ts
import { NextResponse } from "next/server";
import { getServerUser } from "@/lib/serverUser";
import { getUserLeagueRole } from "@/lib/permissions";

export async function PATCH(
  req: Request,
  { params }: { params: { leagueId: string } }
) {
  const user = await getServerUser();
  const role = await getUserLeagueRole(user, params.leagueId);
  
  const body = await req.json();
  
  // Anyone can update name/description
  if (body.name || body.description) {
    // ... update logic
  }
  
  // Only admins can change schedule
  if (body.schedule) {
    if (role !== "admin" && role !== "superadmin") {
      return NextResponse.json({ error: "Admin required" }, { status: 403 });
    }
    // ... update schedule
  }
  
  // Only superadmins can delete
  if (body.delete) {
    if (role !== "superadmin") {
      return NextResponse.json({ error: "Superadmin required" }, { status: 403 });
    }
    // ... delete logic
  }
  
  return NextResponse.json({ success: true });
}
```

## Testing Examples

### Example 10: Testing Permissions

```tsx
// __tests__/permissions.test.ts
import { getUserLeagueRole, hasLeaguePermission } from "@/lib/permissions";

describe("Permission System", () => {
  it("should identify superadmin correctly", async () => {
    const user = { id: "1", email: "admin@test.com", superadmin: true };
    const role = await getUserLeagueRole(user, "league-1");
    expect(role).toBe("superadmin");
  });

  it("should deny admin actions to regular players", async () => {
    const user = { id: "2", email: "player@test.com", superadmin: false };
    const canApprove = await hasLeaguePermission(user, "league-1", "admin");
    expect(canApprove).toBe(false);
  });

  it("should allow admin actions to league admins", async () => {
    const user = { 
      id: "3", 
      email: "leagueadmin@test.com", 
      superadmin: false,
      leagueAdminOf: ["league-1"]
    };
    const canApprove = await hasLeaguePermission(user, "league-1", "admin");
    expect(canApprove).toBe(true);
  });
});
```

## Common Patterns

### Pattern: Progressive Enhancement

Start with public view, add features based on role:

```tsx
export default async function Page({ params }) {
  const user = await getServerUser();
  const permissions = await PermissionChecker.create(user, params.id);

  return (
    <main>
      {/* Base: Public view */}
      <PublicContent />
      
      {/* Enhancement 1: Player features */}
      <IfPermission checker={permissions} level="player">
        <PlayerFeatures />
      </IfPermission>
      
      {/* Enhancement 2: Admin features */}
      <IfPermission checker={permissions} level="admin">
        <AdminFeatures />
      </IfPermission>
      
      {/* Enhancement 3: Superadmin features */}
      <IfPermission checker={permissions} level="superadmin">
        <SuperAdminFeatures />
      </IfPermission>
    </main>
  );
}
```

### Pattern: Unified Component with Props

Create one component that adapts to role:

```tsx
type LeagueViewProps = {
  leagueId: string;
  permissions: PermissionChecker;
};

export function LeagueView({ leagueId, permissions }: LeagueViewProps) {
  const showAdminControls = permissions.isAdmin();
  const showSuperAdminControls = permissions.isSuperAdmin();
  
  return (
    <div>
      <LeagueHeader leagueId={leagueId} />
      <LeagueTeams leagueId={leagueId} />
      
      {showAdminControls && <AdminPanel />}
      {showSuperAdminControls && <SuperAdminPanel />}
    </div>
  );
}
```

### Pattern: Permission-Aware Links

```tsx
function getLeagueUrl(leagueId: string, role: PermissionLevel): string {
  // Same URL for everyone - page will adapt
  return `/leagues/${leagueId}`;
}

// Old way (bad):
// - Public: /leagues/abc
// - Admin: /admin/leagues/abc  
// - Superadmin: /superadmin/leagues/abc

// New way (good):
// Everyone: /leagues/abc (shows appropriate view)
```

