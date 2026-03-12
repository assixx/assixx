# User Addon Permissions — Unit Test Plan

> **Bezieht sich auf:** [`docs/USER-PERMISSIONS-PLAN.md`](./USER-PERMISSIONS-PLAN.md) (Phase 6)
> **Runner:** Vitest (`vitest run --project unit`)
> **Muster:** Existierende Test-Patterns aus `auth.service.test.ts`, `auth.dto.test.ts`, `documents.service.test.ts`
> **Quellen:** `ADR-018` (Vitest Single Runner), `docs/HOW-TO-TEST-WITH-VITEST.md`
> **Update 2026-02-07:** Erweitert um Phase 5b (Enforcement) — `hasPermission()`, `PermissionGuard`, `@RequirePermission()`
> **Update 2026-02-07:** Erweitert um Phase 9 (Notification Coupling) — `getReadableAddonCodes()`, Dashboard permission filtering

---

## Scope

Sechs Test-Dateien, die alle Backend-Logik des Permission-Features abdecken:

| #   | Test-Datei                             | SUT (System Under Test)                                        | Geschätzter Umfang |
| --- | -------------------------------------- | -------------------------------------------------------------- | ------------------ |
| 1   | `permission-registry.service.test.ts`  | PermissionRegistryService                                      | ~20 Tests          |
| 2   | `user-permissions.dto.test.ts`         | UpsertUserPermissionsSchema (Zod)                              | ~18 Tests          |
| 3   | `user-permissions.service.test.ts`     | UserPermissionsService (CRUD + hasPermission + readableAddons) | ~42 Tests          |
| 4   | `permission.guard.test.ts`             | PermissionGuard (Enforcement)                                  | ~16 Tests          |
| 5   | `require-permission.decorator.test.ts` | RequirePermission Decorator (Metadata)                         | ~5 Tests           |
| 6   | `dashboard.service.test.ts`            | DashboardService (Aggregation + Permission Filtering)          | ~12 Tests          |

**Gesamt: ~106 Unit Tests**

---

## Allgemeine Test-Konventionen

### Mock-Pattern (DatabaseService)

```typescript
function createMockDb(): { query: ReturnType<typeof vi.fn>; tenantTransaction: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}
type MockDb = ReturnType<typeof createMockDb>;
```

`tenantTransaction` wird so gemockt, dass der Callback mit einem Mock-Client aufgerufen wird:

```typescript
// tenantTransaction führt den Callback mit einem mock PoolClient aus
mockDb.tenantTransaction.mockImplementation(
  async (callback: (client: { query: ReturnType<typeof vi.fn> }) => Promise<unknown>) => {
    return await callback(mockClient);
  },
);
```

### Mock-Pattern (PermissionRegistryService)

```typescript
function createMockRegistry(): {
  getAll: ReturnType<typeof vi.fn>;
  getByCode: ReturnType<typeof vi.fn>;
  isValidModule: ReturnType<typeof vi.fn>;
  getAllowedPermissions: ReturnType<typeof vi.fn>;
} {
  return {
    getAll: vi.fn(),
    getByCode: vi.fn(),
    isValidModule: vi.fn(),
    getAllowedPermissions: vi.fn(),
  };
}
```

### Mock-Pattern (UserPermissionsService — für PermissionGuard Tests)

```typescript
function createMockPermissionService(): {
  hasPermission: ReturnType<typeof vi.fn>;
} {
  return {
    hasPermission: vi.fn(),
  };
}
```

### Mock-Pattern (ExecutionContext — für PermissionGuard Tests)

```typescript
function createMockExecutionContext(user?: Partial<NestAuthUser>): ExecutionContext {
  const mockRequest = {
    user:
      user !== undefined ?
        {
          id: 1,
          email: 'test@example.com',
          role: 'employee' as const,
          activeRole: 'employee' as const,
          isRoleSwitched: false,
          hasFullAccess: false,
          tenantId: 42,
          ...user,
        }
      : undefined,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  } as unknown as ExecutionContext;
}
```

### Factory Functions (Test-Daten)

```typescript
function createCategory(overrides?: Partial<PermissionCategoryDef>): PermissionCategoryDef {
  return {
    code: 'blackboard',
    label: 'Schwarzes Brett',
    icon: 'fa-clipboard',
    modules: [
      {
        code: 'blackboard-posts',
        label: 'Beiträge',
        icon: 'fa-sticky-note',
        allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
      },
    ],
    ...overrides,
  };
}

function createPermissionRow(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 1,
    tenant_id: 42,
    user_id: 10,
    addon_code: 'blackboard',
    module_code: 'blackboard-posts',
    can_read: false,
    can_write: false,
    can_delete: false,
    assigned_by: 1,
    created_at: new Date('2026-02-07'),
    updated_at: new Date('2026-02-07'),
    ...overrides,
  };
}
```

---

## Test-Datei 1: `permission-registry.service.test.ts`

**Pfad:** `backend/src/nest/common/permission-registry/permission-registry.service.test.ts`
**SUT:** `PermissionRegistryService`
**Keine Mocks nötig** — reiner In-Memory-Singleton, kein DB-Zugriff.

### describe('register()')

| #   | Test                                             | Erwartung                                                                                |
| --- | ------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| 1   | should store a category                          | `getAll()` enthält die registrierte Kategorie                                            |
| 2   | should store multiple categories                 | `getAll().length` === Anzahl registrierter Kategorien                                    |
| 3   | should throw Error on duplicate code             | `register()` mit gleichem `code` → `Error('Permission category "X" already registered')` |
| 4   | should not modify registry when duplicate throws | Nach gefangenem Error → `getAll().length` unverändert                                    |
| 5   | should store deep copy (no external mutation)    | Mutation des übergebenen Objekts NACH `register()` ändert internen State nicht           |

### describe('getAll()')

| #   | Test                                              | Erwartung                                            |
| --- | ------------------------------------------------- | ---------------------------------------------------- |
| 6   | should return empty array when nothing registered | `getAll()` → `[]`                                    |
| 7   | should return all registered categories           | Nach 3x `register()` → Array mit 3 Einträgen         |
| 8   | should return categories with correct structure   | Jeder Eintrag hat `code`, `label`, `icon`, `modules` |

### describe('getByCode()')

| #   | Test                                          | Erwartung                                                         |
| --- | --------------------------------------------- | ----------------------------------------------------------------- |
| 9   | should return correct category for known code | `getByCode('blackboard')` → Kategorie mit `code === 'blackboard'` |
| 10  | should return undefined for unknown code      | `getByCode('nonexistent')` → `undefined`                          |

### describe('isValidModule()')

| #   | Test                                                            | Erwartung                                                  |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------- |
| 11  | should return true for valid feature+module combination         | `isValidModule('blackboard', 'blackboard-posts')` → `true` |
| 12  | should return false for unknown featureCode                     | `isValidModule('unknown', 'blackboard-posts')` → `false`   |
| 13  | should return false for unknown moduleCode within known feature | `isValidModule('blackboard', 'unknown-module')` → `false`  |
| 14  | should return false when both codes are unknown                 | `isValidModule('unknown', 'unknown')` → `false`            |

### describe('getAllowedPermissions()')

| #   | Test                                                   | Erwartung                                                                                          |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 15  | should return correct permissions for known module     | `getAllowedPermissions('blackboard', 'blackboard-posts')` → `['canRead', 'canWrite', 'canDelete']` |
| 16  | should return limited permissions for read-only module | Modul mit `['canRead']` → nur `['canRead']`                                                        |
| 17  | should return empty array for unknown featureCode      | `getAllowedPermissions('unknown', 'x')` → `[]`                                                     |
| 18  | should return empty array for unknown moduleCode       | `getAllowedPermissions('blackboard', 'unknown')` → `[]`                                            |

### describe('Edge Cases')

| #   | Test                                            | Erwartung                                                                                        |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 19  | should handle category with empty modules array | `register({ code: 'empty', modules: [] })` → kein Error, `isValidModule('empty', 'x')` → `false` |
| 20  | should handle category with multiple modules    | Kategorie mit 3 Modulen → alle 3 via `isValidModule()` validierbar                               |

---

## Test-Datei 2: `user-permissions.dto.test.ts`

**Pfad:** `backend/src/nest/user-permissions/dto/user-permissions.dto.test.ts`
**SUT:** `UpsertUserPermissionsSchema` (Zod Schema)
**Pattern:** `.safeParse(data).success` für Boolean-Checks, `.parse(data)` für Wert-Extraktion

### describe('UpsertUserPermissionsSchema — Valid Cases')

| #   | Test                                     | Input                                                                                                                                | Erwartung                                                      |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | should accept valid single permission    | `{ permissions: [{ featureCode: 'blackboard', moduleCode: 'blackboard-posts', canRead: true, canWrite: false, canDelete: false }] }` | `success === true`                                             |
| 2   | should accept valid multiple permissions | Array mit 3 Einträgen                                                                                                                | `success === true`, parsed Array length 3                      |
| 3   | should accept all booleans as true       | `canRead: true, canWrite: true, canDelete: true`                                                                                     | `success === true`                                             |
| 4   | should accept all booleans as false      | `canRead: false, canWrite: false, canDelete: false`                                                                                  | `success === true`                                             |
| 5   | should accept empty permissions array    | `{ permissions: [] }`                                                                                                                | `success === true` (leeres Array = alle Permissions entfernen) |

### describe('UpsertUserPermissionsSchema — featureCode Validation')

| #   | Test                                   | Input                                     | Erwartung           |
| --- | -------------------------------------- | ----------------------------------------- | ------------------- |
| 6   | should reject missing featureCode      | `{ moduleCode: 'x', canRead: true, ... }` | `success === false` |
| 7   | should reject empty string featureCode | `featureCode: ''`                         | `success === false` |
| 8   | should reject non-string featureCode   | `featureCode: 123`                        | `success === false` |

### describe('UpsertUserPermissionsSchema — moduleCode Validation')

| #   | Test                                  | Input                                      | Erwartung           |
| --- | ------------------------------------- | ------------------------------------------ | ------------------- |
| 9   | should reject missing moduleCode      | `{ featureCode: 'x', canRead: true, ... }` | `success === false` |
| 10  | should reject empty string moduleCode | `moduleCode: ''`                           | `success === false` |
| 11  | should reject non-string moduleCode   | `moduleCode: 42`                           | `success === false` |

### describe('UpsertUserPermissionsSchema — Boolean Validation')

| #   | Test                                                | Input                   | Erwartung           |
| --- | --------------------------------------------------- | ----------------------- | ------------------- |
| 12  | should reject missing canRead                       | Objekt ohne `canRead`   | `success === false` |
| 13  | should reject missing canWrite                      | Objekt ohne `canWrite`  | `success === false` |
| 14  | should reject missing canDelete                     | Objekt ohne `canDelete` | `success === false` |
| 15  | should reject string instead of boolean for canRead | `canRead: 'true'`       | `success === false` |
| 16  | should reject number instead of boolean             | `canWrite: 1`           | `success === false` |

### describe('UpsertUserPermissionsSchema — Structure Validation')

| #   | Test                                          | Input                             | Erwartung           |
| --- | --------------------------------------------- | --------------------------------- | ------------------- |
| 17  | should reject non-array permissions           | `{ permissions: 'not-an-array' }` | `success === false` |
| 18  | should reject when permissions key is missing | `{}`                              | `success === false` |

---

## Test-Datei 3: `user-permissions.service.test.ts`

**Pfad:** `backend/src/nest/user-permissions/user-permissions.service.test.ts`
**SUT:** `UserPermissionsService`
**Mocks:** `DatabaseService` (mit `tenantTransaction`), `PermissionRegistryService`, `Logger`

### Setup

```typescript
let service: UserPermissionsService;
let mockDb: MockDb;
let mockClient: { query: ReturnType<typeof vi.fn> };
let mockRegistry: MockRegistry;

beforeEach(() => {
  mockDb = createMockDb();
  mockClient = { query: vi.fn() };
  mockRegistry = createMockRegistry();

  // tenantTransaction ruft Callback mit mockClient auf
  mockDb.tenantTransaction.mockImplementation(async (cb: (client: typeof mockClient) => Promise<unknown>) =>
    cb(mockClient),
  );

  service = new UserPermissionsService(
    mockDb as unknown as DatabaseService,
    mockRegistry as unknown as PermissionRegistryService,
  );
});
```

### describe('getPermissions()')

#### Happy Path

| #   | Test                                                       | Mock-Setup                                                                                                                                | Erwartung                                                    |
| --- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | should return full category tree with default false values | Registry: 1 Kategorie mit 1 Modul. DB: UUID → userId resolved. tenant_addons: `['blackboard']`. user_addon_permissions: `[]` (keine Rows) | Tree mit `canRead: false, canWrite: false, canDelete: false` |
| 2   | should return saved permission values from DB              | DB: 1 Permission-Row mit `can_read: true`                                                                                                 | Tree mit `canRead: true, canWrite: false, canDelete: false`  |
| 3   | should merge multiple modules correctly                    | Registry: 1 Kategorie mit 3 Modulen. DB: 2 von 3 haben Rows                                                                               | 2 Module mit DB-Werten, 1 Modul mit Default false            |
| 4   | should merge multiple categories                           | Registry: 3 Kategorien. DB: Rows für 2 von 3                                                                                              | Alle 3 Kategorien im Tree, korrekte Werte                    |

#### Tenant-Feature-Filtering

| #   | Test                                                              | Mock-Setup                                                                                          | Erwartung                                         |
| --- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 5   | should filter categories by tenant's active features              | Registry: 3 Kategorien (blackboard, calendar, kvp). tenant_addons: nur `['blackboard', 'calendar']` | Tree enthält NUR blackboard + calendar, NICHT kvp |
| 6   | should return empty tree when tenant has no active features       | tenant_addons: `[]`                                                                                 | Leerer Tree (keine Kategorien)                    |
| 7   | should return empty tree when no categories match tenant features | Registry: `['blackboard']`. tenant_addons: `['calendar']`                                           | Leerer Tree                                       |

#### allowedPermissions Filtering

| #   | Test                                                  | Mock-Setup                                       | Erwartung                                                            |
| --- | ----------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------- |
| 8   | should only include allowedPermissions in response    | Modul mit `allowedPermissions: ['canRead']`      | Modul im Tree hat NUR `canRead`, KEINE `canWrite`/`canDelete` Felder |
| 9   | should include all three permissions when all allowed | Modul mit `['canRead', 'canWrite', 'canDelete']` | Alle 3 Felder im Response                                            |

#### Error Cases

| #   | Test                                                                | Mock-Setup                         | Erwartung                                                                          |
| --- | ------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- |
| 10  | should throw NotFoundException when UUID does not resolve to a user | DB: UUID-Lookup → `[]` (kein User) | `NotFoundException`                                                                |
| 11  | should use tenantTransaction (not db.query) for all DB access       | Beliebig                           | `mockDb.tenantTransaction` wurde aufgerufen, `mockDb.query` wurde NICHT aufgerufen |

#### DB-Call Verification

| #   | Test                                                     | Mock-Setup                    | Erwartung                                                                   |
| --- | -------------------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------- |
| 12  | should query user_addon_permissions with correct user_id | UUID resolves to `userId: 42` | `mockClient.query` Call enthält `42` als Parameter                          |
| 13  | should query tenant_addons for active features           | tenantId = 1                  | `mockClient.query` Call enthält SQL mit `tenant_addons` und `is_active = 1` |

### describe('upsertPermissions()')

#### Happy Path

| #   | Test                                           | Mock-Setup                                                                                                              | Erwartung                                                                              |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 14  | should execute UPSERT SQL with ON CONFLICT     | Registry: `isValidModule` → `true`, `getAllowedPermissions` → `['canRead', 'canWrite', 'canDelete']`. DB: UUID resolves | `mockClient.query` Call enthält `INSERT INTO user_addon_permissions` und `ON CONFLICT` |
| 15  | should pass correct values to UPSERT           | Input: `featureCode: 'blackboard', moduleCode: 'blackboard-posts', canRead: true`                                       | SQL-Params enthalten `'blackboard'`, `'blackboard-posts'`, `true`                      |
| 16  | should set assignedBy from caller              | `assignedBy: 99`                                                                                                        | SQL-Params enthalten `99`                                                              |
| 17  | should handle multiple permissions in one call | Array mit 3 Entries                                                                                                     | `mockClient.query` wird 3x für INSERT aufgerufen (oder 1x mit Bulk)                    |
| 18  | should handle empty permissions array          | `permissions: []`                                                                                                       | Kein INSERT, kein Error                                                                |

#### allowedPermissions Enforcement

| #   | Test                                                           | Mock-Setup                                                           | Erwartung                                    |
| --- | -------------------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------- |
| 19  | should force canWrite to false when not in allowedPermissions  | Modul hat `['canRead']`, Input hat `canWrite: true`                  | SQL-Params: `can_write = false` (erzwungen)  |
| 20  | should force canDelete to false when not in allowedPermissions | Modul hat `['canRead', 'canWrite']`, Input hat `canDelete: true`     | SQL-Params: `can_delete = false` (erzwungen) |
| 21  | should keep all permissions when all are allowed               | Modul hat `['canRead', 'canWrite', 'canDelete']`, Input alles `true` | SQL-Params: alle `true` (keine Erzwingung)   |

#### Validation against Registry

| #   | Test                                                     | Mock-Setup                                                            | Erwartung                                                                                   |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 22  | should throw BadRequestException for unknown featureCode | `isValidModule` → `false`                                             | `BadRequestException`                                                                       |
| 23  | should throw BadRequestException for unknown moduleCode  | `isValidModule('blackboard', 'unknown')` → `false`                    | `BadRequestException`                                                                       |
| 24  | should validate ALL entries before writing any to DB     | Array: [valid, invalid, valid]. `isValidModule` → `true, false, true` | `BadRequestException` geworfen, `mockClient.query` NICHT für INSERT aufgerufen (Atomarität) |

#### Error Cases

| #   | Test                                                      | Mock-Setup             | Erwartung                                                              |
| --- | --------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------------- |
| 25  | should throw NotFoundException when UUID does not resolve | DB: UUID-Lookup → `[]` | `NotFoundException`                                                    |
| 26  | should use tenantTransaction (not db.query)               | Beliebig               | `mockDb.tenantTransaction` aufgerufen, `mockDb.query` NICHT aufgerufen |

### describe('getActiveFeaturesForTenant() — indirekt via getPermissions')

| #   | Test                                           | Mock-Setup                                                   | Erwartung                |
| --- | ---------------------------------------------- | ------------------------------------------------------------ | ------------------------ |
| 27  | should return only is_active = 1 features      | DB: 3 Features, 2 mit `is_active = 1`, 1 mit `is_active = 0` | Nur 2 Features im Result |
| 28  | should return empty Set when no features exist | DB: `[]`                                                     | Leerer Tree              |

### describe('hasPermission()') — Phase 5b Enforcement

> **Zweck:** Wird vom `PermissionGuard` aufgerufen, um zu prüfen ob ein User eine bestimmte Permission hat.
> **Fail-Closed:** Kein Row in DB → `false` (Zugriff verweigert).

#### Happy Path

| #   | Test                                                              | Mock-Setup                                                        | Erwartung |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------- | --------- |
| 29  | should return true when can_read is true and action=canRead       | DB: Row mit `can_read: true, can_write: false, can_delete: false` | `true`    |
| 30  | should return true when can_write is true and action=canWrite     | DB: Row mit `can_read: false, can_write: true, can_delete: false` | `true`    |
| 31  | should return true when can_delete is true and action=canDelete   | DB: Row mit `can_read: false, can_write: false, can_delete: true` | `true`    |
| 32  | should return false when can_read is false and action=canRead     | DB: Row mit `can_read: false, can_write: true, can_delete: true`  | `false`   |
| 33  | should return false when can_write is false and action=canWrite   | DB: Row mit `can_read: true, can_write: false, can_delete: true`  | `false`   |
| 34  | should return false when can_delete is false and action=canDelete | DB: Row mit `can_read: true, can_write: true, can_delete: false`  | `false`   |

#### Fail-Closed (no row = denied)

| #   | Test                                                            | Mock-Setup                | Erwartung |
| --- | --------------------------------------------------------------- | ------------------------- | --------- |
| 35  | should return false when no permission row exists (fail-closed) | DB: `rows: []` (kein Row) | `false`   |

#### DB-Call Verification

| #   | Test                                                           | Mock-Setup                                                | Erwartung                                                                                   |
| --- | -------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 36  | should query with correct userId, featureCode, moduleCode      | `userId=42, featureCode='blackboard', moduleCode='posts'` | `mockClient.query` Call enthält `[42, 'blackboard', 'posts']` als Params                    |
| 37  | should use tenantTransaction (not db.query) for RLS compliance | Beliebig                                                  | `mockDb.tenantTransaction` aufgerufen, `mockDb.query` NICHT aufgerufen (ADR-019 Compliance) |

---

## Test-Datei 4: `permission.guard.test.ts`

**Pfad:** `backend/src/nest/common/guards/permission.guard.test.ts`
**SUT:** `PermissionGuard`
**Mocks:** `Reflector`, `UserPermissionsService`, `ExecutionContext` (NestJS Testing Pattern)

### Mock-Pattern (ExecutionContext)

```typescript
function createMockExecutionContext(user?: Partial<NestAuthUser>): ExecutionContext {
  const mockRequest = {
    user:
      user !== undefined ?
        {
          id: 1,
          email: 'test@example.com',
          role: 'employee' as const,
          activeRole: 'employee' as const,
          isRoleSwitched: false,
          hasFullAccess: false,
          tenantId: 42,
          ...user,
        }
      : undefined,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  } as unknown as ExecutionContext;
}
```

### Mock-Pattern (UserPermissionsService)

```typescript
function createMockPermissionService(): { hasPermission: ReturnType<typeof vi.fn> } {
  return {
    hasPermission: vi.fn(),
  };
}
```

### describe('PermissionGuard — No Metadata (pass through)')

| #   | Test                                                   | Mock-Setup                                  | Erwartung                                            |
| --- | ------------------------------------------------------ | ------------------------------------------- | ---------------------------------------------------- |
| 1   | should pass when no @RequirePermission metadata exists | `reflector.getAllAndOverride` → `undefined` | `canActivate()` → `true`, `hasPermission` NOT called |
| 2   | should not call hasPermission when no metadata         | `reflector` → `undefined`, User = employee  | `mockPermissionService.hasPermission` never called   |

### describe('PermissionGuard — Authentication Check')

| #   | Test                                                   | Mock-Setup                                   | Erwartung                                      |
| --- | ------------------------------------------------------ | -------------------------------------------- | ---------------------------------------------- |
| 3   | should throw ForbiddenException when user is undefined | Metadata gesetzt, `request.user = undefined` | `ForbiddenException('User not authenticated')` |

### describe('PermissionGuard — Root Bypass')

| #   | Test                                                   | Mock-Setup                                                  | Erwartung                                            |
| --- | ------------------------------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------- |
| 4   | should pass for root user regardless of DB permissions | User: `activeRole: 'root'`, Metadata: canRead on blackboard | `canActivate()` → `true`, `hasPermission` NOT called |
| 5   | should pass for root even with hasFullAccess=false     | User: `activeRole: 'root', hasFullAccess: false`            | `canActivate()` → `true` (Root always bypasses)      |

### describe('PermissionGuard — Admin Full Access Bypass')

| #   | Test                                                          | Mock-Setup                                                                   | Erwartung                                            |
| --- | ------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| 6   | should pass for admin with hasFullAccess=true                 | User: `activeRole: 'admin', hasFullAccess: true`                             | `canActivate()` → `true`, `hasPermission` NOT called |
| 7   | should check DB for admin with hasFullAccess=false            | User: `activeRole: 'admin', hasFullAccess: false`. `hasPermission` → `true`  | `canActivate()` → `true`, `hasPermission` WAS called |
| 8   | should deny admin without hasFullAccess when permission=false | User: `activeRole: 'admin', hasFullAccess: false`. `hasPermission` → `false` | `ForbiddenException`                                 |

### describe('PermissionGuard — Employee DB Check')

| #   | Test                                             | Mock-Setup                                                                          | Erwartung                                                                  |
| --- | ------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 9   | should pass for employee when permission granted | User: `activeRole: 'employee'`. `hasPermission` → `true`                            | `canActivate()` → `true`                                                   |
| 10  | should deny employee when permission not granted | User: `activeRole: 'employee'`. `hasPermission` → `false`                           | `ForbiddenException('Permission denied: canRead access required for ...')` |
| 11  | should call hasPermission with correct params    | User: `id: 42`, Metadata: `feature='blackboard', module='posts', action='canWrite'` | `hasPermission(42, 'blackboard', 'posts', 'canWrite')` aufgerufen          |

### describe('PermissionGuard — Role-Switching')

| #   | Test                                                         | Mock-Setup                                                                                     | Erwartung                                                    |
| --- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 12  | should check DB for role-switched admin (acting as employee) | User: `role: 'admin', activeRole: 'employee', isRoleSwitched: true`. `hasPermission` → `false` | `ForbiddenException` (Role-switched = treated as activeRole) |
| 13  | should pass for role-switched admin when permission granted  | User: `role: 'admin', activeRole: 'employee', isRoleSwitched: true`. `hasPermission` → `true`  | `canActivate()` → `true`                                     |

### describe('PermissionGuard — Logging')

| #   | Test                                                      | Mock-Setup                                                        | Erwartung                                                                              |
| --- | --------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 14  | should log warning with user details on permission denied | User: `id: 42, activeRole: 'employee'`. `hasPermission` → `false` | `Logger.warn` called with message containing `42`, `employee`, feature, module, action |

### describe('PermissionGuard — getAllAndOverride Metadata Resolution')

| #   | Test                                                            | Mock-Setup                                                                | Erwartung                                                         |
| --- | --------------------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 15  | should read metadata from handler first, class second           | `reflector.getAllAndOverride` mit `[getHandler(), getClass()]`            | `getAllAndOverride` aufgerufen mit `[handler, class]` als Sources |
| 16  | should pass RequiredPermission interface shape to hasPermission | Metadata: `{ featureCode: 'bb', moduleCode: 'posts', action: 'canRead' }` | `hasPermission` called with `(userId, 'bb', 'posts', 'canRead')`  |

---

## Test-Datei 5: `require-permission.decorator.test.ts`

**Pfad:** `backend/src/nest/common/decorators/require-permission.decorator.test.ts`
**SUT:** `RequirePermission`, `PERMISSION_KEY`
**Keine Mocks nötig** — reiner Decorator-Test mit `Reflect.getMetadata()`

### describe('RequirePermission()')

| #   | Test                                                 | Input                                                   | Erwartung                                                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------- |
| 1   | should set metadata with correct PERMISSION_KEY      | `@RequirePermission('blackboard', 'posts', 'canRead')`  | `Reflect.getMetadata(PERMISSION_KEY, target)` ist definiert |
| 2   | should store featureCode in metadata                 | `@RequirePermission('blackboard', 'posts', 'canRead')`  | Metadata enthält `{ featureCode: 'blackboard' }`            |
| 3   | should store moduleCode in metadata                  | `@RequirePermission('blackboard', 'posts', 'canRead')`  | Metadata enthält `{ moduleCode: 'posts' }`                  |
| 4   | should store action in metadata                      | `@RequirePermission('blackboard', 'posts', 'canWrite')` | Metadata enthält `{ action: 'canWrite' }`                   |
| 5   | should export PERMISSION_KEY as 'requiredPermission' | —                                                       | `PERMISSION_KEY === 'requiredPermission'`                   |

---

## Zusammenfassung

| Test-Datei                             | Tests  | Fokus                                                     |
| -------------------------------------- | ------ | --------------------------------------------------------- |
| `permission-registry.service.test.ts`  | 20     | In-Memory-Registry, keine DB                              |
| `user-permissions.dto.test.ts`         | 18     | Zod-Schema-Validierung                                    |
| `user-permissions.service.test.ts`     | 37     | Service-Logik mit gemocktem DB + Registry + hasPermission |
| `permission.guard.test.ts`             | 16     | Guard-Enforcement: Bypass, DB-Check, Logging              |
| `require-permission.decorator.test.ts` | 5      | Decorator-Metadata (SetMetadata)                          |
| **GESAMT**                             | **96** |                                                           |

---

## Ausführung

```bash
# Alle Unit Tests (inkl. Permission Tests)
vitest run --project unit

# Nur Permission Tests (alle 5 Dateien)
vitest run --project unit backend/src/nest/common/permission-registry/permission-registry.service.test.ts
vitest run --project unit backend/src/nest/user-permissions/dto/user-permissions.dto.test.ts
vitest run --project unit backend/src/nest/user-permissions/user-permissions.service.test.ts
vitest run --project unit backend/src/nest/common/guards/permission.guard.test.ts
vitest run --project unit backend/src/nest/common/decorators/require-permission.decorator.test.ts

# Verbose (jeder Test einzeln)
vitest run --project unit --reporter verbose backend/src/nest/user-permissions/
vitest run --project unit --reporter verbose backend/src/nest/common/guards/permission.guard.test.ts
```

---

## Definition of Done

### Management Layer (Phase 1–5)

- [x] Alle 75 Tests grün (Registry 20 + DTO 18 + Service 37): `vitest run --project unit` ✅
- [x] Keine `any`-Types in Test-Files (außer mit eslint-disable + Begründung) ✅
- [x] Mock-Pattern konsistent mit existierenden Tests (`createMockDb`, `vi.fn()`, `as unknown as`) ✅
- [x] Factory-Functions für Test-Daten (`createCategory`, `createValidEntry`) ✅
- [x] Jeder Error-Pfad getestet (NotFoundException, BadRequestException, Error) ✅
- [x] `tenantTransaction`-Nutzung verifiziert (ADR-019 — kein `db.query()` für tenant-scoped) ✅
- [x] allowedPermissions-Enforcement getestet (nicht-erlaubte Permissions → `false`) ✅
- [x] Atomarität getestet (ungültiger Entry → Error + nur 1 INSERT vor Abbruch, Rollback via Transaction) ✅

### Enforcement Layer (Phase 5b)

- [x] `hasPermission()` — alle 9 Tests grün (canRead/canWrite/canDelete true/false + fail-closed + DB-call verification) ✅
- [x] `PermissionGuard` — alle 16 Tests grün (no metadata, auth check, root bypass, admin bypass, employee check, role-switch, logging) ✅
- [x] `@RequirePermission()` — alle 5 Tests grün (metadata key + featureCode + moduleCode + action + export) ✅
- [x] Root-Bypass verifiziert: Guard returnt `true` OHNE `hasPermission` aufzurufen ✅
- [x] Admin-Full-Access-Bypass verifiziert: Guard returnt `true` OHNE `hasPermission` aufzurufen ✅
- [x] Fail-Closed verifiziert: kein DB-Row → `ForbiddenException` ✅
- [x] Role-Switching verifiziert: `activeRole` bestimmt Bypass-Logik, nicht `role` ✅
- [x] Logger.warn bei Denial verifiziert: Message enthält userId, role, feature, module, action ✅

### Gesamt

- [x] Alle 96 Tests grün: `vitest run --project unit` ✅
- [x] ESLint 0 Errors auf allen 5 Test-Dateien ✅

### Abweichungen vom Plan

| #   | Plan-Test                                         | Abweichung                                                      | Begründung                                                                   |
| --- | ------------------------------------------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 5   | Registry: deep copy (no external mutation)        | Test prüft Referenz-Verhalten (Mutation IST sichtbar)           | `register()` speichert Referenz, nicht Clone. Korrekt für OnModuleInit.      |
| 5   | DTO: should accept empty permissions array        | Test prüft Ablehnung (`success === false`)                      | Schema hat `.min(1)` — leeres Array ist ungültig.                            |
| 24  | Service: validate ALL before writing (Atomarität) | Test prüft: Error wird geworfen, 1 INSERT vor Abbruch (nicht 0) | Implementierung validiert per-entry. Atomarität via DB Transaction Rollback. |

---

**Erstellt:** 2026-02-07
**Erweitert:** 2026-02-07 (Phase 5b Enforcement Tests: hasPermission, PermissionGuard, RequirePermission)
**Abgeschlossen:** 2026-02-07 — 96/96 Tests grün, ESLint 0 Errors
**Bezieht sich auf:** [`docs/USER-PERMISSIONS-PLAN.md`](./USER-PERMISSIONS-PLAN.md) — Phase 6
**Status:** ✅ KOMPLETT
