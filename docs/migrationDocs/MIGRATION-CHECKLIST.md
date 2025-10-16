# Permission System Migration Checklist

Use this checklist to track your migration progress.

## ✅ Phase 0: Preparation

- [ ] Read `docs/PERMISSION-SYSTEM-README.md`
- [ ] Review `docs/before-after-comparison.md` 
- [ ] Understand your current route structure
- [ ] Identify all duplicate pages
- [ ] Choose migration strategy (gradual vs all-at-once)
- [ ] Create a backup branch: `git checkout -b backup/pre-permission-migration`
- [ ] Create a feature branch: `git checkout -b feature/permission-system`

## ✅ Phase 1: Infrastructure Setup

- [x] ✅ Create `src/lib/permissions.ts` (DONE - file created)
- [x] ✅ Create `src/components/conditionalDisplay.tsx` (DONE - file created)
- [x] ✅ Create `src/lib/usePermissions.ts` (DONE - file created)
- [x] ✅ Create `src/components/conditionalDisplay.client.tsx` (DONE - file created)
- [ ] Run tests: `npm test` (if you have tests)
- [ ] Verify no TypeScript errors: `npm run type-check` or `tsc --noEmit`
- [ ] Commit infrastructure: `git add . && git commit -m "Add permission system infrastructure"`

## ✅ Phase 2: League Pages Migration

### Step 1: Backup Current Files
- [ ] Rename `/app/leagues/[leagueId]/page.tsx` → `page.tsx.old`
- [ ] Rename `/app/(admin)/admin/leagues/[leagueId]/page.tsx` → `page.tsx.old`
- [ ] Rename `/app/(superadmin)/superadmin/leagues/[leagueId]/page.tsx` → `page.tsx.old`

### Step 2: Create Unified Page
- [ ] Copy `unified-page.tsx.example` to `/app/leagues/[leagueId]/page.tsx`
- [ ] Remove `.example` extension
- [ ] Customize as needed for your specific requirements
- [ ] Fix any TypeScript errors

### Step 3: Test Unified Page
- [ ] Test as **public user** (not logged in)
  - [ ] Can view league info
  - [ ] Cannot see admin controls
  - [ ] Cannot see superadmin controls
  - [ ] Links work correctly
  
- [ ] Test as **regular player**
  - [ ] Can view league info
  - [ ] Can see player-specific features (if any)
  - [ ] Cannot see admin controls
  - [ ] Cannot see superadmin controls
  
- [ ] Test as **league admin**
  - [ ] Can view league info
  - [ ] Can see admin controls
  - [ ] Can download CSV
  - [ ] Cannot see superadmin-only controls
  - [ ] CSV export works
  
- [ ] Test as **superadmin**
  - [ ] Can view league info
  - [ ] Can see all admin controls
  - [ ] Can see superadmin controls
  - [ ] Can assign league admin
  - [ ] All features work

### Step 4: Create Redirects (Temporary)
- [ ] Update `/app/(admin)/admin/leagues/[leagueId]/page.tsx`:
  ```tsx
  import { redirect } from "next/navigation";
  export default function Page({ params }) {
    redirect(`/leagues/${params.leagueId}`);
  }
  ```
- [ ] Update `/app/(superadmin)/superadmin/leagues/[leagueId]/page.tsx`:
  ```tsx
  import { redirect } from "next/navigation";
  export default function Page({ params }) {
    redirect(`/leagues/${params.leagueId}`);
  }
  ```

### Step 5: Update Navigation Links
- [ ] Find all links to `/admin/leagues/[leagueId]`
- [ ] Replace with `/leagues/[leagueId]`
- [ ] Find all links to `/superadmin/leagues/[leagueId]`
- [ ] Replace with `/leagues/[leagueId]`
- [ ] Update navbar/navigation components
- [ ] Update dashboard links

### Step 6: Test Again
- [ ] Click through navigation as each user type
- [ ] Verify redirects work
- [ ] Verify new links work
- [ ] Test deep linking (bookmark a URL)

### Step 7: Commit
- [ ] `git add .`
- [ ] `git commit -m "Migrate league pages to unified permission system"`

## ✅ Phase 3: Team Pages Migration

### Step 1: Identify Team Pages
- [ ] List all team page variations:
  - [ ] `/team/[teamId]/page.tsx`
  - [ ] `/admin/team/[teamId]/page.tsx`
  - [ ] `/superadmin/team/[teamId]/page.tsx`
  - [ ] Other variations?

### Step 2: Create Unified Team Page
- [ ] Create unified `/app/team/[teamId]/page.tsx`
- [ ] Add permission checks
- [ ] Use conditional rendering for manager/admin features
- [ ] Test with all user types

### Step 3: Update Links
- [ ] Replace `/admin/team/` links → `/team/`
- [ ] Replace `/superadmin/team/` links → `/team/`

### Step 4: Test & Commit
- [ ] Test as team member
- [ ] Test as team manager
- [ ] Test as league admin
- [ ] Test as superadmin
- [ ] `git commit -m "Migrate team pages to unified permission system"`

## ✅ Phase 4: Dashboard/Home Pages Migration

### Step 1: Identify Dashboard Pages
- [ ] `/app/page.tsx` (public home)
- [ ] `/app/player/page.tsx` (player dashboard)
- [ ] `/app/admin/page.tsx` (admin dashboard)
- [ ] `/app/superadmin/page.tsx` (superadmin dashboard)

### Step 2: Decide on Consolidation
Two options:
- [ ] **Option A**: Single dashboard at `/` with role-based content
- [ ] **Option B**: Keep separate dashboards (they might be different enough)

### Step 3: Implement Choice
- [ ] Create unified dashboard OR
- [ ] Keep separate dashboards but use permission components within each

### Step 4: Test & Commit
- [ ] Test as each user type
- [ ] `git commit -m "Migrate dashboard pages"`

## ✅ Phase 5: API Routes (Optional)

### Step 1: Review API Routes
- [ ] List all `/api/admin/*` routes
- [ ] List all `/api/superadmin/*` routes
- [ ] Determine which can be consolidated

### Step 2: Migrate API Routes
- [ ] Move to `/api/*` (remove admin/superadmin prefix)
- [ ] Add permission checks inside route handlers
- [ ] Use `hasLeaguePermission()` for authorization

Example:
```tsx
// Before: /api/admin/leagues/[id]/approve
// After: /api/leagues/[id]/approve (with permission check)

import { hasLeaguePermission } from "@/lib/permissions";

export async function POST(req, { params }) {
  const user = await getServerUser();
  if (!(await hasLeaguePermission(user, params.id, "admin"))) {
    return new Response("Unauthorized", { status: 403 });
  }
  // ... proceed
}
```

### Step 3: Update API Calls
- [ ] Find all `fetch('/api/admin/...')` calls
- [ ] Update to `fetch('/api/...')`
- [ ] Find all `fetch('/api/superadmin/...')` calls
- [ ] Update to `fetch('/api/...')`

### Step 4: Test & Commit
- [ ] Test all API endpoints as different user types
- [ ] Verify unauthorized access is blocked
- [ ] `git commit -m "Migrate API routes to unified permission system"`

## ✅ Phase 6: Cleanup

### Step 1: Remove Old Routes
- [ ] Delete `/app/(admin)/admin/leagues/[leagueId]/page.tsx.old`
- [ ] Delete `/app/(superadmin)/superadmin/leagues/[leagueId]/page.tsx.old`
- [ ] Delete other `.old` backup files
- [ ] Delete redirect pages (if no longer needed)

### Step 2: Remove Route Groups (if empty)
- [ ] Delete `/app/(admin)/` directory (if empty)
- [ ] Delete `/app/(superadmin)/` directory (if empty)

### Step 3: Update Documentation
- [ ] Update README.md with new routing structure
- [ ] Update any developer documentation
- [ ] Remove references to old `/admin/*` and `/superadmin/*` routes

### Step 4: Final Test
- [ ] Full regression test as public user
- [ ] Full regression test as player
- [ ] Full regression test as admin
- [ ] Full regression test as superadmin
- [ ] Test all major workflows:
  - [ ] User registration
  - [ ] Team creation
  - [ ] Team joining
  - [ ] Schedule viewing
  - [ ] Admin approval
  - [ ] CSV export
  - [ ] Other critical features

### Step 5: Commit Cleanup
- [ ] `git add .`
- [ ] `git commit -m "Remove old route group structure"`

## ✅ Phase 7: Deployment

### Pre-deployment
- [ ] Run full test suite: `npm test`
- [ ] Run type check: `npm run type-check` or `tsc --noEmit`
- [ ] Run linter: `npm run lint`
- [ ] Check for console errors in dev mode
- [ ] Review all changes: `git diff main`

### Deployment
- [ ] Merge to main: `git checkout main && git merge feature/permission-system`
- [ ] Push to repository: `git push origin main`
- [ ] Deploy to staging (if available)
- [ ] Test on staging environment
- [ ] Deploy to production
- [ ] Monitor for errors

### Post-deployment
- [ ] Verify production site works
- [ ] Check error logs
- [ ] Get user feedback
- [ ] Monitor for any permission-related issues

## ✅ Phase 8: Monitoring & Iteration

### Week 1
- [ ] Monitor error logs daily
- [ ] Check for user-reported issues
- [ ] Verify analytics/metrics haven't dropped
- [ ] Fix any urgent issues

### Week 2-4
- [ ] Gather feedback from admins and superadmins
- [ ] Identify any UX improvements needed
- [ ] Document lessons learned
- [ ] Plan future enhancements

### Future Enhancements
- [ ] Add permission caching if needed
- [ ] Add audit logging for sensitive actions
- [ ] Create permission management dashboard
- [ ] Add role-based feature flags
- [ ] Consider team-level permissions (manager role)

## 📊 Success Metrics

Track these to verify migration success:

- [ ] **Code duplication**: Should be near 0%
- [ ] **Page count**: Reduced by ~66%
- [ ] **Bug reports**: Should decrease over time
- [ ] **Feature velocity**: Should increase (easier to add features)
- [ ] **Developer satisfaction**: Ask your team!
- [ ] **User satisfaction**: Consistent URLs improve UX

## 🎉 Completion

- [ ] All phases complete
- [ ] No critical bugs
- [ ] Team is comfortable with new system
- [ ] Documentation is up to date
- [ ] Celebrate! 🎉

---

## Notes & Issues

Use this space to track any issues or notes during migration:

```
[Date] [Issue/Note]
______________________________






______________________________
```

## Rollback Plan

If something goes wrong:

1. **Quick rollback**: Merge from backup branch
   ```bash
   git checkout main
   git merge backup/pre-permission-migration --no-ff
   git push origin main
   ```

2. **Gradual rollback**: Revert specific commits
   ```bash
   git revert <commit-hash>
   ```

3. **Emergency**: Restore old route groups temporarily
   - Copy `.old` files back
   - Deploy quickly
   - Fix issues in new branch

