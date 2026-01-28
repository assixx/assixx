# Plan: Fail-Closed RBAC via SvelteKit Route Groups + ADR-012

## Overview

Replace the fail-open `ROUTE_PERMISSIONS` map in `hooks.server.ts` with structural, fail-closed RBAC using SvelteKit nested route groups. Create ADR-012 documenting the decision.

**Problem:** Routes not listed in `ROUTE_PERMISSIONS` are accessible to ALL authenticated users (fail-open). New routes are unprotected by default.

**Solution:** Three nested route groups under `(app)/` — `(root)`, `(admin)`, `(shared)` — each with a `+layout.server.ts` that enforces role access. hooks.server.ts reduces to authentication-only.

---

## Step 1: Create ADR-012

**File:** `docs/infrastructure/adr/ADR-012-frontend-route-security-groups.md`

Follows the project's established ADR template (see ADR-005 for reference). Documents:

- Context: fail-open ROUTE_PERMISSIONS gap
- Decision: SvelteKit route groups for structural RBAC
- Alternatives: Convention-based prefix matching (rejected)
- Consequences: fail-closed by architecture, clean AuthN/AuthZ separation

**Also update:** `docs/infrastructure/adr/README.md` — add ADR-012 to the index table.

---

## Step 2: Create Route Group Directories + Layout Files

Create 3 directories and 3 files:

```
frontend/src/routes/(app)/(root)/+layout.server.ts    → role === 'root'
frontend/src/routes/(app)/(admin)/+layout.server.ts   → role in ['admin', 'root']
frontend/src/routes/(app)/(shared)/+layout.server.ts  → any authenticated user
```

Each layout:

1. Calls `await parent()` to get user data from `(app)/+layout.server.ts`
2. Checks role
3. Redirects to `/permission-denied` if denied
4. Returns `{}` (no additional data — parent data passes through automatically)

**NO `+layout.svelte` needed** — groups inherit `(app)/+layout.svelte` (app shell) automatically.

---

## Step 3: Move Route Directories

### To `(root)/` — 4 routes:

- `root-dashboard/`, `root-profile/`, `manage-root/`, `logs/`

### To `(admin)/` — 13 routes:

- `admin-dashboard/`, `admin-profile/`
- `manage-employees/`, `manage-admins/`, `manage-teams/`, `manage-departments/`, `manage-areas/`, `manage-machines/`
- `features/`, `survey-admin/`, `survey-results/`
- `storage-upgrade/`, `tenant-deletion-status/`

### To `(shared)/` — 11 routes:

- `employee-dashboard/`, `employee-profile/`
- `chat/`, `blackboard/`, `calendar/`, `documents-explorer/`
- `kvp/`, `kvp-detail/`, `survey-employee/`
- `account-settings/`, `shifts/`

### Stays in `(app)/` directly:

- `permission-denied/` (must be accessible to all auth users, no group RBAC)
- `_lib/` (shared utilities for layout)
- `+layout.server.ts`, `+layout.svelte` (unchanged)

**URLs do NOT change** — route groups are URL-transparent in SvelteKit.

---

## Step 4: Fix Relative CSS Imports

Moving routes one level deeper breaks `../../../styles/*.css` imports (33 occurrences across 28 files). Each becomes `../../../../styles/*.css`.

Special case: `blackboard/[uuid]/+page.svelte` goes from `../../../../styles/` to `../../../../../styles/`.

**Method:** Batch find-and-replace per group after moving.

**Cross-route import (safe):** `kvp-detail` imports from `../kvp/_lib/` — both move to `(shared)`, relative path unchanged.

---

## Step 5: Simplify `hooks.server.ts`

**Remove:**

- `ROUTE_PERMISSIONS` constant (lines 40-75)
- `getRequiredRoles()` function (lines 119-133)
- Role-checking logic in `rbacHandle` (lines 204-232)

**Keep (renamed `rbacHandle` → `authHandle`):**

- Token check (authentication)
- `fetchUserData()` into `locals.user` (preserves FAST PATH optimization)
- Public/skip route logic
- All helper functions and types

**FAST PATH preserved:** hooks still fetch user data → `locals.user` → `(app)/+layout.server.ts` reuses it → group layout gets it via `parent()`.

---

## Step 6: Update ADR README Index

Add ADR-012 to `docs/infrastructure/adr/README.md` index table.

---

## Verification

1. `cd frontend && pnpm run check` — TypeScript/Svelte compilation
2. `cd frontend && pnpm run build` — Production build
3. `pnpm run dev:svelte` — Dev server + manual route testing:
   - Employee → `/admin-dashboard` → must redirect to `/permission-denied`
   - Employee → `/root-dashboard` → must redirect to `/permission-denied`
   - Admin → all admin routes accessible
   - Root → all routes accessible
   - Employee → all shared routes accessible
   - Check FAST PATH in server logs
4. Visual check: CSS loads correctly on all routes
5. Test `blackboard/[uuid]` and `manage-employees/availability/[uuid]` subdirectories

---

## Files Created (5)

| File                                                                | Purpose          |
| ------------------------------------------------------------------- | ---------------- |
| `docs/infrastructure/adr/ADR-012-frontend-route-security-groups.md` | ADR              |
| `frontend/src/routes/(app)/(root)/+layout.server.ts`                | Root role guard  |
| `frontend/src/routes/(app)/(admin)/+layout.server.ts`               | Admin role guard |
| `frontend/src/routes/(app)/(shared)/+layout.server.ts`              | Auth guard       |

## Files Modified (30)

| File                                | Change                                          |
| ----------------------------------- | ----------------------------------------------- |
| `frontend/src/hooks.server.ts`      | Remove ROUTE_PERMISSIONS, simplify to auth-only |
| `docs/infrastructure/adr/README.md` | Add ADR-012 to index                            |
| 28x `+page.svelte` files            | Fix relative CSS import paths                   |

## Files Moved (28 directories)

All route directories from `(app)/` into their respective groups. Internal structure unchanged.
