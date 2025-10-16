# Permission System Migration Guide

## Problem Statement

Currently, the application has duplicate pages across different route groups:
- `/admin/*` - Admin-specific views
- `/superadmin/*` - Superadmin-specific views  
- `/leagues/*`, `/teams/*`, etc. - Public/Player views

This leads to:
- ~90% code duplication
- Maintenance burden (bugs need fixing in multiple places)
- Inconsistent UX across user types
- Harder to add new features

## Solution: Unified Routes with Role-Based Rendering

Instead of separate pages, use **single routes** with conditional rendering based on user permissions.

### Architecture Overview

```
┌─────────────────────────────────────────┐
│  Single Route (e.g., /leagues/[id])    │
└──────────────┬──────────────────────────┘
               │
       ┌───────▼────────┐
       │ Permission     │
       │ Checker        │
       └───────┬────────┘
               │
    ┌──────────┴──────────┐
    │                     │
┌───▼────┐          ┌─────▼──────┐
│ Public │          │   Admin    │
│ View   │          │   View     │
└────────┘          └─────┬──────┘
                          │
                    ┌─────▼──────┐
                    │ SuperAdmin │
                    │  Features  │
                    └────────────┘
```

## New Files Created

### 1. `src/lib/permissions.ts`
Core permission checking logic:
- `hasLeaguePermission()` - Check if user has required permission
- `getUserLeagueRole()` - Get user's role for a league
- `PermissionChecker` - Class for component-level checks

### 2. `src/components/conditionalDisplay.tsx`
React components for conditional rendering:
- `<IfPermission>` - Render based on permission level
- `<IfSuperAdmin>` - Render only for superadmins
- `<IfAdmin>` - Render for admins (includes superadmins)
- `<IfPlayer>` - Render for logged-in users

### 3. `src/app/leagues/[leagueId]/unified-page.tsx.example`
Example of unified league page replacing 3 separate pages.

## Migration Steps

### Phase 1: League Pages (Example)

1. **Backup current pages** (optional)
   ```bash
   # Move existing pages to .backup
   mv src/app/\(admin\)/admin/leagues/[leagueId]/page.tsx src/app/\(admin\)/admin/leagues/[leagueId]/page.tsx.backup
   mv src/app/\(superadmin\)/superadmin/leagues/[leagueId]/page.tsx src/app/\(superadmin\)/superadmin/leagues/[leagueId]/page.tsx.backup
   ```

2. **Update main league page**
   - Replace `/src/app/leagues/[leagueId]/page.tsx` with unified version
   - Remove the redirect logic (lines 89-99 in current version)
   - Add permission-based rendering

3. **Update navigation links**
   - Change admin links from `/admin/leagues/...` to `/leagues/...`
   - Change superadmin links from `/superadmin/leagues/...` to `/leagues/...`
   - The page will automatically show the right view

4. **Test thoroughly**
   - Test as public user (not logged in)
   - Test as regular player
   - Test as league admin
   - Test as superadmin

### Phase 2: Team Pages

Similar pattern for team pages:
- Consolidate `/team/[teamId]`, `/admin/team/[teamId]`, `/superadmin/team/[teamId]`
- Use `PermissionChecker` to show/hide features
- Keep manager-specific features conditional

### Phase 3: Other Routes

Apply the same pattern to:
- Home/dashboard pages
- Player directories
- Admin management pages

## Usage Examples

### Basic Permission Check

```tsx
import { getServerUser } from "@/lib/serverUser";
import { PermissionChecker } from "@/lib/permissions";
import { IfAdmin, IfSuperAdmin } from "@/components/conditionalDisplay";

export default async function MyPage({ params }) {
  const user = await getServerUser();
  const permissions = await PermissionChecker.create(user, params.leagueId);

  return (
    <div>
      {/* Everyone sees this */}
      <h1>League Name</h1>
      
      {/* Only admins see this */}
      <IfAdmin checker={permissions}>
        <button>Approve Teams</button>
      </IfAdmin>
      
      {/* Only superadmins see this */}
      <IfSuperAdmin checker={permissions}>
        <button>Assign Admin</button>
      </IfSuperAdmin>
    </div>
  );
}
```

### Conditional Data Fetching

```tsx
// Only fetch expensive data if user has permission
if (permissions.isAdmin()) {
  const masterRoster = await fetchMasterRoster();
  // ... use roster
}
```

### Different Views for Different Roles

```tsx
<IfAdmin 
  checker={permissions}
  fallback={<PublicView />}
>
  <AdminView />
</IfAdmin>
```

## Benefits

### ✅ **Reduced Code Duplication**
- One route instead of 3+ routes
- Shared logic, shared components
- Single source of truth

### ✅ **Easier Maintenance**
- Fix bugs once, not 3 times
- Add features once
- Consistent behavior

### ✅ **Better User Experience**
- Same URL for all users
- Share links easily
- Contextual features appear automatically

### ✅ **Cleaner Routing**
- No route group complexity
- Simpler navigation
- Easier to understand

### ✅ **Type Safety**
- TypeScript checks permission levels
- Compile-time safety for roles
- Better IDE support

## API Route Considerations

For API routes, you can also consolidate:

**Before:**
```
/api/admin/leagues/[id]/approve
/api/superadmin/leagues/[id]/assign
```

**After:**
```
/api/leagues/[id]/approve   (check permissions inside)
/api/leagues/[id]/assign    (check permissions inside)
```

Use the same permission system:

```tsx
// /api/leagues/[id]/approve/route.ts
import { getServerUser } from "@/lib/serverUser";
import { hasLeaguePermission } from "@/lib/permissions";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const user = await getServerUser();
  
  // Check permission
  if (!(await hasLeaguePermission(user, params.id, "admin"))) {
    return new Response("Unauthorized", { status: 403 });
  }
  
  // ... rest of logic
}
```

## Gradual Migration

You don't have to migrate everything at once:

1. **Start with one feature** (e.g., league pages)
2. **Test thoroughly** with all user types
3. **Migrate next feature** once confident
4. **Keep old routes** until migration is complete (just redirect to new ones)

Example gradual approach:
```tsx
// Old route: /admin/leagues/[id]/page.tsx
export default async function OldAdminLeaguePage({ params }) {
  // Redirect to new unified route
  redirect(`/leagues/${params.id}`);
}
```

## Testing Checklist

For each migrated page, test:

- [ ] Public user (not logged in) sees correct view
- [ ] Logged-in player sees player features
- [ ] League admin sees admin features (but not superadmin)
- [ ] Superadmin sees all features
- [ ] Links/navigation work correctly
- [ ] CSV exports use correct URLs
- [ ] API calls work from all views
- [ ] No permission leaks (admins can't see superadmin-only data)

## Troubleshooting

**Issue: Permission checks are slow**
- Cache the `PermissionChecker` instance
- Consider moving expensive checks to client components with suspense

**Issue: Components flash/flicker**
- Ensure permission checks happen server-side
- Use proper loading states

**Issue: TypeScript errors**
- Make sure all imports are correct
- Check that `PermissionChecker` is properly awaited

## Future Enhancements

Possible improvements:
- Add permission caching/memoization
- Create admin/superadmin-only client components
- Add audit logging for permission checks
- Create a permissions dashboard for debugging
- Add role-based route protection middleware

## Questions?

This is a significant architectural change. Start small, test thoroughly, and gradually migrate. The long-term maintainability benefits are worth it!

