# ADR-045: Permission & Visibility Design — "Who is allowed to do what?"

| Metadata                | Value                                                                                                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**              | Accepted                                                                                                                                                                                                                                                   |
| **Date**                | 2026-04-15                                                                                                                                                                                                                                                 |
| **Decision Makers**     | SCS-Technik Team                                                                                                                                                                                                                                           |
| **Affected Components** | ALL feature modules (Blackboard, KVP, Surveys, TPM, Work Orders, Vacation, Approvals, Inventory, Documents …), backend guards, frontend gates, navigation                                                                                                  |
| **Supersedes**          | —                                                                                                                                                                                                                                                          |
| **Related ADRs**        | ADR-010 (roles/hierarchy), ADR-012 (route security groups), ADR-020 (per-user permissions), ADR-024 (frontend feature guards), ADR-033 (addons), ADR-034 (hierarchy labels), ADR-035 (scope architecture), ADR-036 (scope access), ADR-039 (deputy toggle) |

---

## Context

Over the last 12 months Assixx has introduced several orthogonal permission mechanisms (roles, hasFullAccess, lead positions, deputy-scope toggle, addon subscriptions, per-user permissions). Each one is documented in its own ADR. What is **missing** is the **unifying rule**: _how do these mechanisms combine when I gate a single button in the UI or protect a single mutation route in the backend?_

The result: **divergent patterns** across the codebase.

| Feature        | Frontend button gate                                            | Backend mutation guard                                    |
| -------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| **Surveys**    | `canManageSurveys(role, hasFullAccess, isAnyLead)` ✅ canonical | `@RequirePermission(SURVEY_ADDON, ..., 'canWrite')` ✅    |
| **Blackboard** | `const isAdmin = role === 'admin' \|\| 'root'` ❌ outdated      | `@Roles('admin', 'root')` + `@RequirePermission(…)` ❌    |
| **KVP**        | no gate (employee may submit a suggestion — by design)          | `@RequirePermission(KVP_ADDON, ..., 'canWrite')` ✅       |
| **TPM**        | `/tpm/plans/my-permissions` self-check ✅                       | `@RequirePermission(TPM_ADDON, MOD_PLANS, 'canWrite')` ✅ |

The `isAdmin` shortcut in Blackboard ignores:

- `hasFullAccess` (an admin without full access still sees the button although they should not be able to do anything)
- Lead positions (an employee team lead sees no button although they should be allowed to manage)
- Deputy-scope toggle ADR-039 (deputies with active tenant toggle are ignored)
- ADR-020 per-user permissions (an admin with explicitly revoked `canWrite` still sees the button)

The `@Roles('admin', 'root')` in the backend makes things worse: even if the frontend gated correctly, the backend guard would block an employee team lead with **a valid `canWrite` permission** with a 403.

### Requirements

1. **ONE** canonical decision rule "who is allowed to manage?" for all feature modules.
2. **Consistency** between frontend visibility and backend enforcement — no button visible that ends in 403.
3. **Compatible** with the deputy toggle (ADR-039) — routing through leads/deputies is the backend's job; the frontend trusts the `orgScope.isAnyLead` flag.
4. **Compatible** with per-user permissions (ADR-020) — fine-grained overrides remain effective.
5. **Creator bypass** — whoever created an item is allowed to edit/delete it (provided the feature has ownership semantics, e.g. blackboard entry, KVP suggestion).
6. **Easy for new features**: copy/paste a pattern, no metaprogramming.

---

## Decision

### 3-Layer Model ("Permission Stack")

Every action in the system goes through **up to three** gates in this order:

```
┌─────────────────────────────────────────────────────────────────┐
│ Layer 0: Addon subscription (ADR-033)                            │
│   → Has the tenant booked this module?                           │
│   → Frontend: `requireAddon()` in +page.server.ts                │
│   → Backend: @RequireAddon guard (if present)                    │
│   → Fails here → addon not subscribed, page is gone entirely     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 1: Management gate ("is the user allowed to manage at all?")│
│   → Combines role + hasFullAccess + lead scope + deputy toggle   │
│   → Frontend: `canManage<Module>(role, hasFullAccess, isAnyLead)`│
│   → Backend: @RequirePermission (NOT @Roles!)                    │
│   → Fails here → button/page invisible, 403 on direct access     │
├─────────────────────────────────────────────────────────────────┤
│ Layer 2: Fine-grained action permission (ADR-020)                │
│   → Does the user have canRead/canWrite/canDelete for this       │
│     module + action?                                             │
│   → Frontend (optional): `/{module}/my-permissions` endpoint     │
│   → Backend: @RequirePermission(ADDON, MODULE, 'canWrite')       │
│   → Fails here → individual action denied                        │
├─────────────────────────────────────────────────────────────────┤
│ Creator bypass (when applicable)                                 │
│   → authorId === currentUser.id → edit/delete on own content     │
│   → service-internal, NOT a controller guard                     │
└─────────────────────────────────────────────────────────────────┘
```

**Important:** Layer 1 is the new canonical rule and replaces every form of `isAdmin` shortcut. Layer 2 is already defined in ADR-020. Creator bypass is decided per feature.

### Layer 1: The Management-Gate Rule

```
canManage := role === 'root'
          || (role === 'admin' && hasFullAccess === true)
          || isAnyLead === true
```

**Component breakdown:**

| Component         | Meaning                                                             | Source                                   |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| `role === 'root'` | System role Root — always bypass by design.                         | `users.role` (ADR-010)                   |
| `hasFullAccess`   | Admin flag "sees everything in the tenant like Root".               | `users.has_full_access` (ADR-010)        |
| `isAnyLead`       | User is area/department/team lead **OR** deputy with active toggle. | `GET /users/me/org-scope` (ADR-035, 039) |

**Deputy logic (ADR-039) is intentionally _not_ explicit in the formula:** the backend automatically merges deputy IDs into `leadXxxIds` when the tenant toggle `deputy_has_lead_scope` is active. The frontend only ever sees `isAnyLead = true/false` — zero complexity on the consumer side.

### Decision Table "Who is allowed to manage?" (Layer 1)

| User                            | role       | hasFullAccess | Lead? | Deputy? | deputyToggle | canManage? |
| ------------------------------- | ---------- | ------------- | ----- | ------- | ------------ | ---------- |
| Root                            | `root`     | —             | —     | —       | —            | ✅ yes     |
| Admin (full access)             | `admin`    | `true`        | —     | —       | —            | ✅ yes     |
| Admin (limited, no lead)        | `admin`    | `false`       | no    | no      | —            | ❌ no      |
| Admin as area lead              | `admin`    | `false`       | yes   | —       | —            | ✅ yes     |
| Admin as deputy (toggle OFF)    | `admin`    | `false`       | no    | yes     | `false`      | ❌ no      |
| Admin as deputy (toggle ON)     | `admin`    | `false`       | no    | yes     | `true`       | ✅ yes¹    |
| Employee (no lead)              | `employee` | —             | no    | no      | —            | ❌ no      |
| Employee as team lead           | `employee` | —             | yes   | —       | —            | ✅ yes     |
| Employee as deputy (toggle OFF) | `employee` | —             | no    | yes     | `false`      | ❌ no      |
| Employee as deputy (toggle ON)  | `employee` | —             | no    | yes     | `true`       | ✅ yes¹    |

¹ Backend sets `isAnyLead = true` via the deputy merge — frontend only sees `isAnyLead=true`.

### Layer 2: Fine-grained Override (ADR-020)

An admin with full access is _in principle_ allowed to do everything. The tenant root admin can however **explicitly** revoke individual permissions or set fine-grained `canRead/canWrite/canDelete` per module for delegated leads (see ADR-020 extension 2026-03-14).

**Rule:** Layer 2 is **always enforced in the backend** via `@RequirePermission`. In the frontend it is _optional_ — only needed when an action denial would otherwise lead to a surprising 403 (see "When to add Layer 2 in the frontend?" below).

### Creator Bypass (optional, per feature)

If an entity has an `authorId`/`createdById` and the business logic permits (e.g. blackboard entry, KVP suggestion, calendar event `personal`), **the author bypasses both Layer 1 and Layer 2** for edit/delete on their _own_ records.

- Implementation: **service-internal**, not as a controller guard.
- No bypass for `canRead` (which is usually `canRead=true` anyway).
- No bypass for archive/unarchive or other "management" actions — only _trivial_ owner edits (title, text, attachments).

---

## Implementation Pattern

### Frontend — Canonical Helper

```typescript
// frontend/src/routes/(app)/_lib/navigation-config.ts

/**
 * Canonical "is the user allowed to manage this module?" decision.
 *
 * Pattern applies to: Blackboard, Surveys, KVP categories, TPM config,
 *                     Vacation overview, Work Orders admin, Approvals, …
 *
 * - Root: always yes (by design).
 * - Admin: only with hasFullAccess OR a lead position OR deputy with toggle.
 * - Employee: only with a lead position OR deputy with toggle.
 *
 * `isAnyLead` automatically merges deputy IDs when the tenant toggle
 * `deputy_has_lead_scope` is active (ADR-039).
 *
 * @see docs/infrastructure/adr/ADR-045-permission-visibility-design.md
 */
export function canManage(role: string | undefined, hasFullAccess: boolean, isAnyLead: boolean): boolean {
  return role === 'root' || (role === 'admin' && hasFullAccess) || isAnyLead;
}

// Wrapper per module (for readability + grep-friendliness):
export const canManageBlackboard = canManage;
export const canManageSurveys = canManage;
export const canManageKvpCategories = canManage;
// ...
```

**Wrapper names are pure readability** — they all delegate to `canManage`. If a module needs a divergent rule in the future, the wrapper can selectively diverge without breaking the generic function.

### Frontend — Page Pattern

```typescript
// +page.server.ts (defense in depth — prevents direct URL access)
import { canManageBlackboard } from '../../_lib/navigation-config';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const { user, activeAddons, orgScope } = await parent();
  requireAddon(activeAddons, 'blackboard'); // Layer 0

  // Layer 1: only relevant here when the ENTIRE page is for managers.
  // For mixed pages (read + optional write), Layer 1 is checked at the button.
  // Page-gate example (manage-surveys):
  if (!canManageBlackboard(user?.role, user?.hasFullAccess === true, orgScope.isAnyLead)) {
    redirect(302, '/blackboard'); // or 403
  }
  // ...
};
```

```svelte
<!-- +page.svelte (button gate) -->
<script lang="ts">
  import { canManageBlackboard } from '../../_lib/navigation-config';

  const { data } = $props();
  const canManage = $derived(
    canManageBlackboard(
      data.user?.role,
      data.user?.hasFullAccess === true,
      data.orgScope.isAnyLead,
    ),
  );
</script>

{#if canManage}
  <button class="btn btn-primary" onclick={openCreateModal}>
    <i class="fas fa-plus mr-2"></i>New entry
  </button>
{/if}
```

### Frontend — When to add Layer 2?

Layer 2 in the frontend only makes sense when:

1. The backend **could** deny the individual action even for a user with `canManage=true` (e.g. an admin-with-lead for whom Root has set `canWrite=false`).
2. The UX cost of a surprising 403 is high (e.g. user fills out a modal, clicks Save, then receives a 403).

In that case: **adopt the TPM pattern `/{module}/my-permissions` endpoint.** Response:

```typescript
// GET /blackboard/my-permissions
{ canReadPosts: true, canWritePosts: true, canDeletePosts: false,
  canReadArchive: true, canWriteArchive: false }
```

Frontend:

```svelte
<!-- Button gate with Layer 1 + Layer 2 -->
{#if canManage && myPermissions.canWritePosts}
  <button>New entry</button>
{/if}
```

**Default recommendation:** start with Layer 1 only. Add Layer 2 as soon as a single report comes in that buttons return 403.

### Backend — Canonical Controller Guards

```typescript
// ✅ CORRECT (Surveys pattern)
@Post('entries')
@RequirePermission(BLACKBOARD_ADDON, BB_POSTS, 'canWrite')
@HttpCode(HttpStatus.CREATED)
async createEntry(@Body() dto: CreateEntryDto, @CurrentUser() user: NestAuthUser) { ... }

// ❌ WRONG (outdated Blackboard state)
@Post('entries')
@UseGuards(RolesGuard)
@Roles('admin', 'root')                                     // ← blocks employee leads
@RequirePermission(BLACKBOARD_ADDON, BB_POSTS, 'canWrite')  // ← never reached
async createEntry(...) { ... }
```

**Rule:** `@Roles('admin', 'root')` is **FORBIDDEN** for mutations (POST/PUT/DELETE/PATCH) when a `@RequirePermission` exists. The role whitelist is already embedded in the `@RequirePermission` guard (checks lead scope + deputy merge + hasFullAccess + ADR-020 canWrite).

`@Roles(...)` is still allowed for:

- **Read endpoints at management level** (e.g. `/users` complete list) — here a role gate is cheaper than a permission check.
- **System endpoints** (`/root/…`) where Root exclusivity is intentional by design.
- **As defense in depth _on top_** — if an endpoint is meant only for `employee` (e.g. submitting a vacation request), combine `@Roles('employee', 'admin', 'root')` + `@RequirePermission`. But never narrower than the permission rule.

### Backend — Creator Bypass in the Service

```typescript
async updateEntry(
  id: number,
  dto: UpdateEntryDto,
  tenantId: number,
  currentUser: NestAuthUser,
): Promise<Entry> {
  const entry = await this.repo.findById(id, tenantId);
  if (entry === null) throw new NotFoundException();

  // Creator bypass: the author may edit their own entry,
  // even without Layer 1 (canManage) or Layer 2 (canWrite).
  const isCreator = entry.authorId === currentUser.id;
  if (!isCreator) {
    // Non-creator: regular permission check
    await this.permissions.assertCanWrite(currentUser, BB_ADDON, BB_POSTS);
  }

  return await this.repo.update(id, tenantId, dto);
}
```

**Important:** the creator bypass is **service logic**, not a controller guard, because it depends on the entity (`authorId` comes from the DB row).

---

## Alternatives Considered

### 1. Hide everything inside `@RequirePermission`, no Layer-1 helper

**Rejected.** Layer 1 is indispensable as a frontend gate (button visibility before API call). A pure backend-only approach leads to clickable buttons that 403 — bad UX.

### 2. Role explosion: `admin-with-blackboard-write`, `employee-team-lead-with-kvp-write`, …

**Rejected** (already rejected in ADR-020). Unmaintainable with 19 addons × 42 modules × 3 actions.

### 3. Pure ABAC (attribute-based) policy engine (e.g. Casbin, OpenFGA)

**Rejected.** Over-engineered for the current scope (4–6 factors, no complex policies). ADR-020 already made this decision. The combination of role + hasFullAccess + lead scope + permission covers 100% of known use cases.

### 4. Layer 2 only (ADR-020 alone, no Layer 1)

**Rejected.** Without Layer 1 every user would have to be granted permissions individually — including every team lead manually. Layer 1 is the "sensible default" that says: "Whoever holds a leadership role may manage — unless explicitly overridden."

---

## Consequences

### Positive

1. **One pattern for all modules** — copy/paste, not re-invent.
2. **Employee leads can do real leadership work**, not be tagged as admins.
3. **Deputy toggle ADR-039 acts consistently** for every module, without module-specific logic.
4. **ADR-020 fine-grained permissions remain effective** — Layer 2 in the backend remains the authoritative enforcement point.
5. **Frontend/backend cannot drift** — both use the same inputs (`role`, `hasFullAccess`, `isAnyLead`).
6. **Migration effort is manageable** — every "outdated" `isAdmin` shortcut is grep-able.

### Negative

1. **Migration effort:** every module with `const isAdmin = role === 'admin' \|\| 'root'` (currently Blackboard, possibly more) has to be migrated.
2. **Backend has to review guard combinations** — `@Roles('admin', 'root')` on mutations should be removed in most cases.
3. **Some overhead** on deputy-toggle changes: the `orgScope` cache in the frontend has to be invalidated when the toggle is flipped (already exists via `invalidateAll()`).

### Risks & Mitigations

| Risk                                                                                               | Mitigation                                                                                                      |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Developer forgets Layer 1 in the frontend, only Layer 2 → button-403                               | ESLint rule or review checklist: every `@RequirePermission`-gated mutation UI must have `canManage` in the gate |
| Backend refactor removes `@Roles`, but @RequirePermission is not registered → all users get access | CI test: every mutation must have either `@RequirePermission` or an explicit `@Public()` set                    |
| Deputy toggle is not merged server-side into `orgScope` → deputies do not see buttons              | Unit test in ScopeService (already exists for surveys — use as reference)                                       |
| Creator bypass is missed in the service → author cannot edit own entry                             | Integration test per feature: creator can always edit/delete (independent of permissions)                       |

---

## Migration Checklist

For EVERY feature module that has mutations (POST/PUT/DELETE/PATCH):

### Frontend

- [ ] Grep for `isAdmin` / `role === 'admin'` / `role === 'root'` in `+page.svelte` and `+page.server.ts`.
- [ ] Replace with `canManage<Module>(role, hasFullAccess, orgScope.isAnyLead)`.
- [ ] Add wrapper to `navigation-config.ts` (for readability + grep).
- [ ] Defense in depth in `+page.server.ts`: redirect non-managers when the page is _management only_.
- [ ] Optional Layer 2: if UX requires it, introduce `/{module}/my-permissions` endpoint (TPM pattern).

### Backend

- [ ] Grep for `@Roles('admin', 'root')` in all feature controllers.
- [ ] On mutations (`@Post`, `@Put`, `@Delete`, `@Patch`): REMOVE `@Roles(...)`, `@RequirePermission(...)` remains the sole guard.
- [ ] On reads: case by case — for pure admin lists (`/admins`, `/root-users`), `@Roles('admin', 'root')` may stay.
- [ ] Add creator bypass in the service if the feature has ownership (`authorId`/`createdById`).
- [ ] Integration test: employee-team-lead can create/update/delete (via the `@RequirePermission` path).
- [ ] Integration test: admin without hasFullAccess and without a lead position CANNOT.

### Prioritized Backlog

Sorted by "blast radius" — where an outdated `isAdmin` gate causes the most pain:

1. **Blackboard** — reference migration (this ADR was triggered by the concrete bug).
2. **Others to be identified** (grep scan as part of the Blackboard migration).

---

## References

- [ADR-010: Roles & hierarchy](./ADR-010-user-role-assignment-permissions.md) — `has_full_access`, area/dept/team leads, inheritance rules.
- [ADR-012: Route Security Groups](./ADR-012-frontend-route-security-groups.md) — SvelteKit `(root)/(admin)/(shared)` fail-closed.
- [ADR-020: Per-User Feature Permissions](./ADR-020-per-user-feature-permissions.md) — `user_addon_permissions`, decentralized registry, delegated management (2026-03-14 extension).
- [ADR-024: Frontend Feature Guards](./ADR-024-frontend-feature-guards.md) — `hasFeature()`, addon gates.
- [ADR-033: Addon-based SaaS model](./ADR-033-addon-based-saas-model.md) — `tenant_addons`, subscription gate (Layer 0).
- [ADR-035: Organizational Hierarchy](./ADR-035-organizational-hierarchy-and-assignment-architecture.md) — `orgScope` API, lead-position resolution.
- [ADR-036: Organizational Scope Access](./ADR-036-organizational-scope-access-control.md) — scope delegation, deputy role.
- [ADR-039: Per-Tenant Deputy-Scope Toggle](./ADR-039-per-tenant-deputy-scope-toggle.md) — merge logic deputy → lead, tenant setting.
- [CODE-OF-CONDUCT.md](../../CODE-OF-CONDUCT.md) — KISS, no quick fixes.
- Canonical reference implementation: `backend/src/nest/surveys/surveys.controller.ts` + `frontend/src/routes/(app)/(shared)/manage-surveys/+page.server.ts`.
