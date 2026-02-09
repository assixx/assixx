# ADR-012: Frontend Route Security - Fail-Closed RBAC via Route Groups

| Metadata                | Value                                                   |
| ----------------------- | ------------------------------------------------------- |
| **Status**              | Accepted                                                |
| **Date**                | 2026-01-26                                              |
| **Decision Makers**     | SCS Technik                                             |
| **Affected Components** | SvelteKit Frontend, hooks.server.ts, Route Architecture |

---

## Context

### The Problem: Fail-Open Route Security

The previous RBAC implementation in `hooks.server.ts` used a `ROUTE_PERMISSIONS` map:

```typescript
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  '/root-dashboard': ['root'],
  '/admin-dashboard': ['admin', 'root'],
  '/employee-dashboard': ['employee', 'admin', 'root'],
  // ...
};
```

**Comment in code:** "Routes not listed here allow ALL authenticated users."

This is a **Fail-Open Design**. If a developer creates a new route and forgets to add it to `ROUTE_PERMISSIONS`, that route is accessible to **every authenticated user** — including Employees who can see Admin pages.

### Concrete Risk

1. Developer creates `/manage-salaries/+page.svelte` (Admin-only)
2. Forgets `ROUTE_PERMISSIONS` entry
3. Employee navigates to `/manage-salaries` → **Page loads**
4. Backend API blocks data (Guards), but the UI itself is visible
5. Information Leak: Feature existence, form structure, labels

### Requirements

- **Fail-Closed by Default** — New routes are protected without manual entry
- **Clean Architecture** — Separation of Authentication (Who are you?) and Authorization (What are you allowed to do?)
- **Framework-Idiomatic** — SvelteKit-native solution instead of custom middleware
- **Preserve FAST PATH** — Performance optimization (50-80ms) from `locals.user` reuse
- **Zero URL Changes** — Existing URLs must not change

---

## Decision

### SvelteKit Route Groups for Structural RBAC

We replace the central `ROUTE_PERMISSIONS` map with **SvelteKit Route Groups** with their own `+layout.server.ts` files:

```
routes/(app)/
├── +layout.svelte           ← App Shell (Header, Sidebar, Footer) — UNCHANGED
├── +layout.server.ts        ← User Data Fetch + FAST PATH — UNCHANGED
├── permission-denied/       ← Stays direct (all auth users)
├── _lib/                    ← Shared Utilities — UNCHANGED
│
├── (root)/                  ← 🔴 ROOT ONLY
│   ├── +layout.server.ts   ← if role !== 'root' → redirect
│   ├── root-dashboard/
│   ├── root-profile/
│   ├── manage-root/
│   └── logs/
│
├── (admin)/                 ← 🟡 ADMIN + ROOT
│   ├── +layout.server.ts   ← if role not in ['admin', 'root'] → redirect
│   ├── admin-dashboard/
│   ├── manage-employees/
│   ├── features/
│   └── ... (13 Routes)
│
└── (shared)/                ← 🟢 ALL AUTHENTICATED
    ├── +layout.server.ts   ← if !user → redirect (fail-closed auth check)
    ├── employee-dashboard/
    ├── chat/
    ├── blackboard/
    └── ... (11 Routes)
```

### Architecture Decisions

| Decision                   | Chosen                  | Rationale                                         |
| -------------------------- | ----------------------- | ------------------------------------------------- |
| **Security Mechanism**     | SvelteKit Route Groups  | Structural security, framework-native             |
| **Default Policy**         | Fail-Closed             | New route MUST be in group → automatically secure |
| **hooks.server.ts Role**   | Authentication only     | SRP: Token Check + User Fetch in locals.user      |
| **Authorization Location** | Group +layout.server.ts | Each group checks its own role                    |
| **App Shell Sharing**      | Layout inheritance      | (app)/+layout.svelte applies to all groups        |
| **FAST PATH**              | Preserved               | hooks fetches User → locals.user → Layout reused  |

### Security Layers (Defense in Depth)

```
Layer 1: hooks.server.ts      → Authentication (Token valid?)
Layer 2: (app)/+layout.server → User Data Fetch (Who are you?)
Layer 3: Group Layout         → Authorization (Are you allowed?)
Layer 4: Backend API Guards   → API Authorization (NestJS @Roles())
```

### URL Transparency

SvelteKit Route Groups in parentheses `(root)`, `(admin)`, `(shared)` do **not** appear in the URL. `/admin-dashboard` stays `/admin-dashboard`.

---

## Alternatives Considered

### 1. Convention-Based Prefix + Default-Deny (Approach 2)

Derive roles from URL prefix (`/admin-*` → admin, `/root-*` → root):

```typescript
if (pathname.startsWith('/admin-')) return ['admin', 'root'];
if (pathname.startsWith('/manage-')) return ['admin', 'root'];
```

| Pros                 | Cons                                             |
| -------------------- | ------------------------------------------------ |
| No file moves needed | 13 of 30 routes don't fit any prefix scheme      |
| One file to maintain | SHARED_ROUTES list = still manual maintenance    |
| Quick to implement   | String matching is fragile                       |
|                      | Naming convention must be documented             |
|                      | Security depends on code logic, not architecture |
|                      | Anti-Pattern: hooks.server.ts as God Object      |

**Decision:** Rejected — Only 17 of 30 routes fit a prefix scheme. The rest needs manual lists, which repeats the same fail-open problem.

### 2. Status Quo + Default-Deny Toggle

Just flip lines 204-206 in hooks.server.ts (null → redirect instead of pass-through):

| Pros                    | Cons                                        |
| ----------------------- | ------------------------------------------- |
| One-liner               | Still manual ROUTE_PERMISSIONS maintenance  |
| Immediately fail-closed | Every new route needs map entry             |
| No refactoring          | SRP violation: hooks = AuthN + AuthZ + more |
|                         | Not self-documenting                        |

**Decision:** Rejected — Quick fix, not sustainable. Addresses symptom, not root cause.

---

## Consequences

### Positive

1. **Fail-Closed by Architecture** — New route MUST be in group → automatically protected
2. **Self-Documenting** — `ls routes/(app)/(admin)/` shows all admin routes
3. **Code Review Safe** — Wrong group = visible in Git diff
4. **SRP** — hooks = Authentication, Layout = Authorization
5. **Framework-Native** — SvelteKit Route Groups designed for exactly this use case
6. **Zero URL Changes** — No breaking changes for frontend/bookmarks
7. **FAST PATH Preserved** — Performance optimization remains intact
8. **Onboarding** — "Admin page? → folder (admin)" instead of "Check ROUTE_PERMISSIONS"

### Negative

1. **28 directories to move** — One-time refactoring effort
2. **33 CSS import paths to update** — Relative paths become longer due to deeper nesting
3. **permission-denied as special case** — Stays directly under (app), not in a group

### Mitigations

| Problem                  | Mitigation                                           |
| ------------------------ | ---------------------------------------------------- |
| CSS import breakage      | Batch find-and-replace, visual check on all routes   |
| Forgotten route in (app) | Code review rule: No pages directly under (app)/     |
| Relative import paths    | Future: Evaluate `$styles` Vite alias as improvement |

---

## Implementation Details

### Group Layout Template

```typescript
// (app)/(admin)/+layout.server.ts
import { createLogger } from '$lib/utils/logger';

import { redirect } from '@sveltejs/kit';

import type { LayoutServerLoad } from './$types';

const log = createLogger('AdminGroupLayout');
const ALLOWED_ROLES: ReadonlySet<string> = new Set(['admin', 'root']);

export const load: LayoutServerLoad = async ({ parent, url }) => {
  const { user } = await parent();

  if (user === null || user === undefined) {
    redirect(302, '/login');
  }

  if (!ALLOWED_ROLES.has(user.role)) {
    log.warn({ pathname: url.pathname, userRole: user.role }, `RBAC(admin): Access denied`);
    redirect(302, '/permission-denied');
  }

  return {};
};
```

### hooks.server.ts Simplification

```
BEFORE: Token Check → User Fetch → Role Check (ROUTE_PERMISSIONS)
AFTER:  Token Check → User Fetch → set locals.user (done)
```

Role check is completely removed — handled by Group Layouts instead.

### Files

| Created                            | Purpose     |
| ---------------------------------- | ----------- |
| `(app)/(root)/+layout.server.ts`   | Root Guard  |
| `(app)/(admin)/+layout.server.ts`  | Admin Guard |
| `(app)/(shared)/+layout.server.ts` | Auth Guard  |

| Modified                            | Change       |
| ----------------------------------- | ------------ |
| `hooks.server.ts`                   | Auth-Only    |
| 28x `+page.svelte`                  | CSS Paths    |
| `docs/infrastructure/adr/README.md` | Index-Update |

---

## Verification

| Scenario                                | Expected                      | Status |
| --------------------------------------- | ----------------------------- | ------ |
| Employee → /admin-dashboard             | Redirect /permission-denied   | ☐      |
| Employee → /root-dashboard              | Redirect /permission-denied   | ☐      |
| Admin → /admin-dashboard                | Access allowed                | ☐      |
| Admin → /root-dashboard                 | Redirect /permission-denied   | ☐      |
| Root → all routes                       | Access allowed                | ☐      |
| Employee → /chat, /blackboard           | Access allowed                | ☐      |
| New route in (admin)/ without map entry | Automatically admin-only      | ☐      |
| URLs unchanged                          | /admin-dashboard (no /admin/) | ☐      |
| FAST PATH in Server-Logs                | ⚡ FAST PATH message          | ☐      |
| CSS loaded correctly                    | Visual check                  | ☐      |
| pnpm run check                          | 0 Errors                      | ☐      |
| pnpm run build                          | Success                       | ☐      |

---

## References

- [Implementation Plan](./ADR-012-implementation-plan.md) — Detailed step-by-step plan
- [SvelteKit Route Groups](https://svelte.dev/docs/kit/advanced-routing#Advanced-layouts-Group)
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) — Backend Auth
- [ADR-010: User Role Assignment](./ADR-010-user-role-assignment-permissions.md) — Role System
- [OWASP Access Control](https://owasp.org/www-community/Access_Control) — Fail-Closed Principle
- [adr.github.io](https://adr.github.io/) — ADR Best Practices
