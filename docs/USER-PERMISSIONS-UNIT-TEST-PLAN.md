# User Feature Permissions — Unit Test Plan

> **Bezieht sich auf:** [`docs/USER-PERMISSIONS-PLAN.md`](./USER-PERMISSIONS-PLAN.md) (Phase 6)
> **Runner:** Vitest (`vitest run --project unit`)
> **Muster:** Existierende Test-Patterns aus `auth.service.test.ts`, `auth.dto.test.ts`, `documents.service.test.ts`
> **Quellen:** `ADR-018` (Vitest Single Runner), `docs/HOW-TO-TEST-WITH-VITEST.md`

---

## Scope

Drei Test-Dateien, die alle Backend-Logik des Permission-Features abdecken:

| #   | Test-Datei                            | SUT (System Under Test)           | Geschätzter Umfang |
| --- | ------------------------------------- | --------------------------------- | ------------------ |
| 1   | `permission-registry.service.test.ts` | PermissionRegistryService         | ~20 Tests          |
| 2   | `user-permissions.dto.test.ts`        | UpsertUserPermissionsSchema (Zod) | ~18 Tests          |
| 3   | `user-permissions.service.test.ts`    | UserPermissionsService            | ~28 Tests          |

**Gesamt: ~66 Unit Tests**

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
    feature_code: 'blackboard',
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

| #   | Test                                                       | Mock-Setup                                                                                                                                    | Erwartung                                                    |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 1   | should return full category tree with default false values | Registry: 1 Kategorie mit 1 Modul. DB: UUID → userId resolved. tenant_features: `['blackboard']`. user_feature_permissions: `[]` (keine Rows) | Tree mit `canRead: false, canWrite: false, canDelete: false` |
| 2   | should return saved permission values from DB              | DB: 1 Permission-Row mit `can_read: true`                                                                                                     | Tree mit `canRead: true, canWrite: false, canDelete: false`  |
| 3   | should merge multiple modules correctly                    | Registry: 1 Kategorie mit 3 Modulen. DB: 2 von 3 haben Rows                                                                                   | 2 Module mit DB-Werten, 1 Modul mit Default false            |
| 4   | should merge multiple categories                           | Registry: 3 Kategorien. DB: Rows für 2 von 3                                                                                                  | Alle 3 Kategorien im Tree, korrekte Werte                    |

#### Tenant-Feature-Filtering

| #   | Test                                                              | Mock-Setup                                                                                            | Erwartung                                         |
| --- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 5   | should filter categories by tenant's active features              | Registry: 3 Kategorien (blackboard, calendar, kvp). tenant_features: nur `['blackboard', 'calendar']` | Tree enthält NUR blackboard + calendar, NICHT kvp |
| 6   | should return empty tree when tenant has no active features       | tenant_features: `[]`                                                                                 | Leerer Tree (keine Kategorien)                    |
| 7   | should return empty tree when no categories match tenant features | Registry: `['blackboard']`. tenant_features: `['calendar']`                                           | Leerer Tree                                       |

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

| #   | Test                                                       | Mock-Setup                    | Erwartung                                                                     |
| --- | ---------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| 12  | should query user_feature_permissions with correct user_id | UUID resolves to `userId: 42` | `mockClient.query` Call enthält `42` als Parameter                            |
| 13  | should query tenant_features for active features           | tenantId = 1                  | `mockClient.query` Call enthält SQL mit `tenant_features` und `is_active = 1` |

### describe('upsertPermissions()')

#### Happy Path

| #   | Test                                           | Mock-Setup                                                                                                              | Erwartung                                                                                |
| --- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 14  | should execute UPSERT SQL with ON CONFLICT     | Registry: `isValidModule` → `true`, `getAllowedPermissions` → `['canRead', 'canWrite', 'canDelete']`. DB: UUID resolves | `mockClient.query` Call enthält `INSERT INTO user_feature_permissions` und `ON CONFLICT` |
| 15  | should pass correct values to UPSERT           | Input: `featureCode: 'blackboard', moduleCode: 'blackboard-posts', canRead: true`                                       | SQL-Params enthalten `'blackboard'`, `'blackboard-posts'`, `true`                        |
| 16  | should set assignedBy from caller              | `assignedBy: 99`                                                                                                        | SQL-Params enthalten `99`                                                                |
| 17  | should handle multiple permissions in one call | Array mit 3 Entries                                                                                                     | `mockClient.query` wird 3x für INSERT aufgerufen (oder 1x mit Bulk)                      |
| 18  | should handle empty permissions array          | `permissions: []`                                                                                                       | Kein INSERT, kein Error                                                                  |

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

---

## Zusammenfassung

| Test-Datei                            | Tests  | Fokus                                     |
| ------------------------------------- | ------ | ----------------------------------------- |
| `permission-registry.service.test.ts` | 20     | In-Memory-Registry, keine DB              |
| `user-permissions.dto.test.ts`        | 18     | Zod-Schema-Validierung                    |
| `user-permissions.service.test.ts`    | 28     | Service-Logik mit gemocktem DB + Registry |
| **GESAMT**                            | **66** |                                           |

---

## Ausführung

```bash
# Alle Unit Tests (inkl. Permission Tests)
vitest run --project unit

# Nur Permission Tests
vitest run --project unit backend/src/nest/common/permission-registry/permission-registry.service.test.ts
vitest run --project unit backend/src/nest/user-permissions/dto/user-permissions.dto.test.ts
vitest run --project unit backend/src/nest/user-permissions/user-permissions.service.test.ts

# Verbose (jeder Test einzeln)
vitest run --project unit --reporter verbose backend/src/nest/user-permissions/
```

---

## Definition of Done

- [ ] Alle 66 Tests grün: `vitest run --project unit`
- [ ] Keine `any`-Types in Test-Files (außer mit eslint-disable + Begründung)
- [ ] Mock-Pattern konsistent mit existierenden Tests (`createMockDb`, `vi.fn()`, `as unknown as`)
- [ ] Factory-Functions für Test-Daten (`createCategory`, `createPermissionRow`)
- [ ] Jeder Error-Pfad getestet (NotFoundException, BadRequestException, Error)
- [ ] `tenantTransaction`-Nutzung verifiziert (ADR-019 — kein `db.query()` für tenant-scoped)
- [ ] allowedPermissions-Enforcement getestet (nicht-erlaubte Permissions → `false`)
- [ ] Atomarität getestet (ungültiger Entry → kein DB-Write)
- [ ] ESLint 0 Errors auf allen 3 Test-Dateien

---

**Erstellt:** 2026-02-07
**Bezieht sich auf:** [`docs/USER-PERMISSIONS-PLAN.md`](./USER-PERMISSIONS-PLAN.md) — Phase 6
**Status:** Umsetzen wenn Phasen 1–5 fertig
