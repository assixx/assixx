# HOW-TO-INTEGRATE-FEATURE.md

> Checklist for the complete integration of a new feature into the Assixx ecosystem.
> Reference implementation: **Vacation module** (`backend/src/nest/vacation/`, `frontend/src/routes/(app)/**/vacation/`)

---

## Definition of Done

A feature is **DONE** when all applicable boxes are checked.
Not every feature needs everything — e.g. a pure admin feature does not need employee routes.
But: **forgetting nothing is better than patching it later.**

---

## 1. DATABASE

### 1.1 Addon registration

- [ ] Migration: `INSERT INTO addons (code, name, description, is_core, base_price, sort_order)`
- [ ] Core or purchasable? `is_core = true` (always active) or `is_core = false` (à la carte)

> **Ref:** `database/migrations/20260212000027_vacation-feature-flag.ts`

### 1.2 Core tables

- [ ] Migration with `pgm.sql()` (raw SQL is required for RLS, triggers, GRANTs)
- [ ] Every table has:
  - `id UUID PRIMARY KEY` (UUIDv7, application-generated)
  - `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
  - `is_active INTEGER NOT NULL DEFAULT 1` (0=inactive, 1=active, 3=archive, 4=deleted)
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] RLS enabled + forced:

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_table FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON my_table
  USING (NULLIF(current_setting('app.tenant_id', true), '') IS NULL
         OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);
```

- [ ] GRANTs for `app_user`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON my_table TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

- [ ] Sensible indexes (tenant_id, FK columns, frequent WHERE conditions)
- [ ] CHECK constraints for business rules directly in the DB
- [ ] `down()` migration implemented (rollback)

> **Ref:** `database/migrations/20260212000029_vacation-core-tables.ts`
> **Guide:** `docs/DATABASE-MIGRATION-GUIDE.md`

### 1.3 After the migration

- [ ] `doppler run -- ./scripts/run-migrations.sh up --dry-run` succeeds
- [ ] Backup taken before execution
- [ ] `doppler run -- ./scripts/sync-customer-migrations.sh` executed

---

## 2. BACKEND MODULE

### 2.1 Module structure

```
backend/src/nest/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts              # core mutations
├── <feature>-queries.service.ts      # read-only queries (optional, for complexity)
├── <feature>.types.ts                # DB-row + API types
├── <feature>.permissions.ts          # ADR-020 permission definition
├── <feature>-permission.registrar.ts # auto-registration
├── <feature>-notification.service.ts # SSE + persistent notifications (optional)
├── dto/
│   ├── common.dto.ts                 # shared Zod schemas
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── index.ts                      # barrel export
└── __tests__/ or *.test.ts
```

### 2.2 Module registration

- [ ] `<feature>.module.ts` created:

```typescript
@Module({
  imports: [FeatureCheckModule],
  controllers: [FeatureController],
  providers: [
    FeaturePermissionRegistrar,
    // services in dependency order
    FeatureService,
    FeatureQueriesService,
  ],
  exports: [FeatureService, FeatureQueriesService],
})
export class FeatureModule {}
```

- [ ] Imported into `app.module.ts` (`imports: [..., FeatureModule]`)

> **Ref:** `backend/src/nest/vacation/vacation.module.ts`, `backend/src/nest/app.module.ts` (line ~173)

### 2.3 Controller

- [ ] Class-level guards: `@UseGuards(JwtAuthGuard, RolesGuard)`
- [ ] Per endpoint: `@RequirePermission(FEAT, MODULE, 'canRead' | 'canWrite' | 'canDelete')`
- [ ] Role restriction where needed: `@Roles('admin', 'root')`
- [ ] Addon gate in **every** endpoint:

```typescript
private async ensureAddonEnabled(tenantId: number): Promise<void> {
  const isEnabled = await this.addonCheck.checkTenantAccess(tenantId, ADDON_CODE);
  if (!isEnabled) {
    throw new ForbiddenException('Addon is not enabled for this tenant');
  }
}
```

- [ ] Return data directly — do **NOT** wrap manually (`ResponseInterceptor` handles that)
- [ ] `@HttpCode()` set correctly (201 for POST, 204 for DELETE/withdraw)
- [ ] Parameterized routes **after** static routes (`:id` after `/incoming`)
- [ ] **If the endpoint creates a user** (`INSERT INTO users`): the service method MUST call `await this.tenantVerification.assertVerified(tenantId)` as the first call in the AST-enclosing helper (ADR-049 KISS gate). Otherwise CI fails through `shared/src/architectural.test.ts`. Allowlist extension only in the SAME PR + ADR update if the new bootstrap path creates the first user for a tenant (before any `tenant_domains` row).

> **Ref:** `backend/src/nest/vacation/vacation.controller.ts`, `backend/src/nest/users/users.service.ts:insertUserRecord` (ADR-049 KISS-gate example)

### 2.4 DTOs with Zod

- [ ] Every endpoint has a DTO with a Zod schema
- [ ] DTO class: `export class CreateFeatureDto extends createZodDto(CreateFeatureSchema) {}`
- [ ] Shared schemas extracted into `dto/common.dto.ts`
- [ ] Cross-field validation via `.refine()`
- [ ] Barrel export in `dto/index.ts`
- [ ] HTTP params: `z.coerce.number()` for numeric query/path parameters

> **Ref:** `backend/src/nest/vacation/dto/create-vacation-request.dto.ts`
> **Guide:** `backend/docs/ZOD-INTEGRATION-GUIDE.md`

### 2.5 Types

- [ ] DB-row types (snake_case, 1:1 to the table): `interface FeatureRow { tenant_id: number; ... }`
- [ ] API types (camelCase, response shape): `interface Feature { tenantId: number; ... }`
- [ ] Enums as string unions: `type FeatureStatus = 'active' | 'archived';`
- [ ] `mapRowToFeature()` mapping function

> **Ref:** `backend/src/nest/vacation/vacation.types.ts`

### 2.6 Permissions (ADR-020)

- [ ] `<feature>.permissions.ts`:

```typescript
export const FEATURE_PERMISSIONS: PermissionCategoryDef = {
  code: 'feature-code', // MUST match addons.code in DB
  label: 'Feature Name',
  icon: 'fa-icon-name',
  modules: [
    {
      code: 'module-code',
      label: 'Module Name',
      icon: 'fa-icon',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
  ],
};
```

- [ ] `<feature>-permission.registrar.ts`:

```typescript
@Injectable()
export class FeaturePermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}
  onModuleInit(): void {
    this.registry.register(FEATURE_PERMISSIONS);
  }
}
```

- [ ] Registrar declared as a provider in the module

> **Ref:** `backend/src/nest/vacation/vacation.permissions.ts`, `vacation-permission.registrar.ts`

### 2.7 Activity logging (root dashboard)

- [ ] `ActivityLoggerService` injected
- [ ] Called after every mutation (fire-and-forget with `void`):

```typescript
void this.activityLogger.logCreate(tenantId, userId, 'feature-entity', entityId, `Feature created: ${name}`, {
  relevantFields,
});
```

- [ ] `entityType` added to the `ActivityEntityType` union if it is new

> **Ref:** `backend/src/nest/common/services/activity-logger.service.ts`
> **Audit trail** (`audit_trail` table) is automatic via the global interceptor — no manual code required.

### 2.8 Notifications (optional, when the user is to be notified)

- [ ] `<feature>-notification.service.ts` created
- [ ] **SSE (real-time):** add the event in `utils/eventBus.ts`:

```typescript
// In eventBus.ts:
emitFeatureEvent(tenantId: number, payload: FeaturePayload): void {
  this.emit('feature.created', { tenantId, ...payload });
}
```

- [ ] **Persistent (badge counts):** via `NotificationsService.createAddonNotification()`
- [ ] Frontend notification store: SSE event mapping in `notification.store.svelte.ts`:

```typescript
// In SSE_EVENT_TO_COUNT map:
['NEW_FEATURE_EVENT', 'featureType'],
```

- [ ] Extend `NotificationCounts` interface (add the new counter)

> **Ref:** `backend/src/nest/vacation/vacation-notification.service.ts`, `utils/eventBus.ts`
> **Frontend ref:** `frontend/src/lib/stores/notification.store.svelte.ts`

### 2.9 Service patterns

- [ ] Mutations via `this.db.tenantTransaction()` (tenant isolation)
- [ ] `FOR UPDATE` lock on status transitions (avoid race conditions)
- [ ] UUIDv7: `import { v7 as uuidv7 } from 'uuid';`
- [ ] Notification calls **after** transaction commit (not inside)
- [ ] Parameterized queries: `$1, $2, $3` — **NEVER** string concatenation

---

## 3. FRONTEND

### 3.1 Route structure (ADR-012)

- [ ] Right route group chosen:

| Group      | Path                                            | Access                  |
| ---------- | ----------------------------------------------- | ----------------------- |
| `(root)`   | `frontend/src/routes/(app)/(root)/<feature>/`   | Root only               |
| `(admin)`  | `frontend/src/routes/(app)/(admin)/<feature>/`  | Admin + root            |
| `(shared)` | `frontend/src/routes/(app)/(shared)/<feature>/` | All authenticated users |

- [ ] New folder created in the right group
- [ ] **No** custom guard needed — the group's layout guards protect automatically

> **Ref:** `frontend/src/routes/(app)/(root)/+layout.server.ts` (role check)

### 3.2 SSR data loading (`+page.server.ts`)

- [ ] `import { apiFetch } from '$lib/server/api-fetch'` — **no local copy!**
- [ ] Auth check: `cookies.get('accessToken')` → redirect when missing
- [ ] `await parent()` for user data from the parent layout
- [ ] Parallel API calls with `Promise.all()`:

```typescript
import { apiFetch } from '$lib/server/api-fetch';

const [items, stats] = await Promise.all([
  apiFetch<PaginatedResult<Item>>('/feature/items?page=1&limit=20', token, fetch),
  apiFetch<FeatureStats>('/feature/stats', token, fetch),
]);
```

- [ ] Fallback for failed calls (empty defaults, do not crash)

> **Ref:** `frontend/src/routes/(app)/(shared)/vacation/+page.server.ts`
> **Shared utility:** `frontend/src/lib/server/api-fetch.ts` (auth headers, envelope unwrapping, error logging)

### 3.3 Page component (`+page.svelte`)

- [ ] Svelte 5 runes: `$props()`, `$derived()`, `$state()`, `$effect()`
- [ ] Sync SSR data into the state store via `$effect()`
- [ ] `invalidateAll()` after mutations (triggers an SSR reload)
- [ ] Extract sub-components into the `_lib/` folder

> **Ref:** `frontend/src/routes/(app)/(shared)/vacation/+page.svelte`

### 3.4 `_lib/` folder (collocated module files)

- [ ] `types.ts` — frontend's own interfaces (mirror of the backend API types)
- [ ] `api.ts` — typed API functions via `getApiClient()`
- [ ] `state.svelte.ts` — facade for `state-data.svelte.ts` + `state-ui.svelte.ts`
- [ ] `state-data.svelte.ts` — `$state` runes for data
- [ ] `state-ui.svelte.ts` — `$state` runes for UI (modals, filters, tabs, loading)
- [ ] `constants.ts` — labels, badge classes, filter options
- [ ] `*.svelte` — sub-components (cards, forms, indicators)

> **Ref:** `frontend/src/routes/(app)/(shared)/vacation/_lib/`

### 3.5 Sidebar navigation

- [ ] File: `frontend/src/routes/(app)/_lib/navigation-config.ts`
- [ ] Add the NavItem to **all relevant role arrays**:
  - `rootMenuItems` (root sees everything)
  - `adminMenuItems` (admin-relevant items)
  - `employeeMenuItems` (employee-relevant items)
- [ ] Pick an icon from the `ICONS` record (or add a new one)
- [ ] For submenus: extract a shared submenu constant when several roles use it
- [ ] Set `badgeType` if a notification badge is wanted (must exist in `NotificationCounts`)
- [ ] Adjust `filterMenuByAccess()` if feature-specific access control is required

```typescript
// Example NavItem:
{
  id: 'feature-name',
  icon: ICONS.iconName,
  label: 'Feature Label',
  url: '/feature',                          // direct link
  badgeType: 'featureType',                 // optional: notification badge
  submenu: [                                // optional: submenu
    { id: 'feature-list', icon: ICONS.list, label: 'Overview', url: '/feature' },
    { id: 'feature-admin', icon: ICONS.cog, label: 'Settings', url: '/feature/settings' },
  ],
}
```

> **Ref:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

### 3.6 Breadcrumb

- [ ] File: `frontend/src/lib/components/Breadcrumb.svelte`
- [ ] **Static route:** add an entry to `urlMappings`:

```typescript
'/feature': { label: 'Feature Name', icon: 'fa-icon' },
'/feature/settings': { label: 'Settings', icon: 'fa-cog' },
```

- [ ] **Dynamic route** (with parameter): entry in `dynamicRoutes`:

```typescript
{ pattern: /^\/feature\/[^/]+$/, label: 'Feature Details', icon: 'fa-info-circle' },
```

- [ ] **Parent breadcrumb** (intermediate step): entry in `intermediateBreadcrumbs`:

```typescript
'/feature/settings': { label: 'Feature Name', url: '/feature', icon: 'fa-icon' },
```

- [ ] Add fullscreen pages (e.g. chat-style) to the `fullscreenPages` array

> **Ref:** `frontend/src/lib/components/Breadcrumb.svelte` (urlMappings from line ~42)

---

## 4. TESTING

### 4.1 Unit tests (services)

- [ ] At least one `*.test.ts` file per service
- [ ] Mock factory pattern:

```typescript
function createMockDb() {
  return { query: vi.fn() };
}
function createService() {
  const mockDb = createMockDb();
  const service = new FeatureService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
}
```

- [ ] Happy path + edge cases + error cases tested
- [ ] `mockResolvedValueOnce()` chains for sequential DB queries

> **Ref:** `backend/src/nest/kvp/kvp.service.test.ts`

### 4.2 Permission tests

- [ ] Guard behaviour tested for all roles (root, admin, employee)
- [ ] Unauthenticated → 403
- [ ] Root bypass verified
- [ ] Admin `hasFullAccess` bypass verified
- [ ] Employee DB permission check verified

> **Ref:** `backend/src/nest/common/guards/permission.guard.test.ts`

### 4.3 API integration tests

- [ ] File: `backend/test/<feature>.api.test.ts`
- [ ] Pattern:

```typescript
let auth: AuthState;
beforeAll(async () => {
  auth = await loginApitest();
});

describe('Unauthenticated → 401', () => {
  /* without token */
});
describe('Create', () => {
  /* POST with authHeaders(token) */
});
describe('Read', () => {
  /* GET with authOnly(token) */
});
describe('Update', () => {
  /* PUT with authHeaders(token) */
});
describe('Delete/Cleanup', () => {
  /* DELETE with authOnly(token) */
});
```

- [ ] **CRITICAL:** `authHeaders(token)` for requests WITH a body, `authOnly(token)` for requests WITHOUT a body (Fastify!)
- [ ] Cleanup at the end (clean up created test data)

> **Ref:** `backend/test/vacation.api.test.ts`, `backend/test/helpers.ts`
> **Guide:** `docs/how-to/HOW-TO-TEST.md`

---

## 5. DOCUMENTATION

- [ ] `docs/FEATURES.md` — add the feature with price and description
- [ ] `docs/PROJEKTSTRUKTUR.md` — document new directories
- [ ] `TODO.md` — update feature status
- [ ] `docs/DAILY-PROGRESS.md` — document progress
- [ ] Create an ADR if architectural decisions were made (`docs/infrastructure/adr/ADR-0XX-*.md`)

---

## 6. QUICK REFERENCE: GUARD STACK PER REQUEST

```
HTTP request
  │
  ├─ 1. JwtAuthGuard (global)         → authenticated? token valid? user active?
  ├─ 2. RolesGuard (global)           → @Roles() decorator → role allowed?
  ├─ 3. PermissionGuard (global)      → @RequirePermission() → DB check user_addon_permissions
  ├─ 4. ensureAddonEnabled() (manual) → tenant_addons → feature active for the tenant?
  │
  └─ Controller method executed
       │
       ├─ ResponseInterceptor          → wraps: { success: true, data: T }
       └─ AuditTrailInterceptor        → automatically logged in audit_trail
```

---

## 7. FORGOTTEN INTEGRATION = TECH DEBT

| Forgot               | Consequence                                       |
| -------------------- | ------------------------------------------------- |
| RLS policy           | **Data leak between tenants**                     |
| GRANT for app_user   | Feature does not work in prod (permission denied) |
| Addon registration   | Addon is not visible to anyone                    |
| Sidebar entry        | User cannot find the feature                      |
| Breadcrumb           | Confusing navigation                              |
| Permission registrar | Admin cannot grant user permissions               |
| Activity logging     | Root dashboard shows no activity                  |
| ensureAddonEnabled() | Addon is open to all tenants (bypass!)            |
| API test             | Regression goes unnoticed                         |
| Notification badge   | User does not see new entries                     |
| Route group          | Wrong role has access                             |
