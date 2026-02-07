# User Feature Permissions — Implementation Plan

## Overview

Bottom-Up implementation: **DB → Backend → Enforcement → Frontend**
Per-user, per-feature/module permission control (canRead, canWrite, canDelete).

### Zwei Säulen: Management + Enforcement

| Säule                         | Was                                          | Status  |
| ----------------------------- | -------------------------------------------- | ------- |
| **Management** (Phase 1–5, 7) | CRUD: Permissions in DB speichern/lesen, UI  | ✅ Done |
| **Enforcement** (Phase 5b)    | Guard: Permissions bei jedem Request prüfen  | ✅ Done |
| **Notification Coupling** (9) | Kein Permission → Kein Badge, kein SSE-Event | ✅ Done |

Ohne Enforcement ist das System nur ein Notizbuch — Permissions werden gespeichert,
aber niemand prüft sie. Phase 5b schließt diese Lücke.

### Guard Execution Order (alle global)

```
Request → JwtAuthGuard → RolesGuard → PermissionGuard → Controller
              ↓              ↓              ↓
          ADR-005        ADR-012        ADR-020
       Authenticate    Check Role    Check Feature
                                     Permission
```

### Architektur-Entscheidung: Dezentrales Registry Pattern

**Warum:** Jedes Feature-Modul besitzt seine eigenen Permission-Definitionen.
Kein zentrales God-Object, kein Single-Point-of-Change.
Neue Kategorie = **2 Files im eigenen Modul**, kein zentrales File editieren.
Feature-Modul löschen = Permissions verschwinden automatisch.

```
common/permission-registry/
  ├── permission.types.ts               ← Shared Interfaces
  ├── permission-registry.service.ts    ← register() + getAll() (Singleton)
  └── permission-registry.module.ts     ← @Global()

common/decorators/
  └── require-permission.decorator.ts   ← @RequirePermission(feature, module, action)

common/guards/
  └── permission.guard.ts              ← Global Guard, liest @RequirePermission Metadata

blackboard/
  ├── blackboard.permissions.ts         ← const BLACKBOARD_PERMISSIONS
  └── blackboard-permission.registrar.ts ← OnModuleInit → register()

calendar/
  ├── calendar.permissions.ts           ← const CALENDAR_PERMISSIONS
  └── calendar-permission.registrar.ts  ← OnModuleInit → register()

user-permissions/
  ├── user-permissions.service.ts       ← CRUD + hasPermission() — kennt KEINE Features
  ├── user-permissions.controller.ts
  └── user-permissions.module.ts
```

## Referenzen

### Projekt-Dokumentation

| Dokument                                | Relevant für                                                     |
| --------------------------------------- | ---------------------------------------------------------------- |
| `docs/DATABASE-MIGRATION-GUIDE.md`      | Phase 1: Migration-Format, RLS-Pattern, NULLIF, GRANTs           |
| `docs/TYPESCRIPT-STANDARDS.md`          | Alle Phasen: `$1,$2,$3`, `??`, kein `any`, explicit return types |
| `docs/CODE-OF-CONDUCT.md`               | Alle Phasen: KISS, Power-of-Ten, max 60 Zeilen/Funktion          |
| `docs/CODE-OF-CONDUCT-SVELTE.md`        | Phase 7: Svelte 5 Runes, $state/$derived/$props                  |
| `docs/HOW-TO-TEST-WITH-VITEST.md`       | Phase 5+8: Test-Setup, Mocking, Projekt-Konfiguration            |
| `backend/docs/ZOD-INTEGRATION-GUIDE.md` | Phase 3: Zod + nestjs-zod DTO-Pattern                            |

### ADRs

| ADR                                  | Relevant für                                                                        |
| ------------------------------------ | ----------------------------------------------------------------------------------- |
| `ADR-005` Custom JWT Guard           | Phase 5: `@CurrentUser()`, `@TenantId()` Decorators                                 |
| `ADR-006` ClsService Tenant Context  | Phase 4+5b: Tenant-Isolation, CLS → `tenantTransaction()`                           |
| `ADR-007` ResponseInterceptor        | Phase 5: Controller gibt Raw-Data zurück, KEIN `{ success, data }` wrapping         |
| `ADR-012` Fail-Closed RBAC           | Phase 5: `@Roles('admin')` Guard                                                    |
| `ADR-014` node-pg-migrate            | Phase 1: Migration-Runner, `up`/`down` Pattern                                      |
| `ADR-018` Vitest Single Runner       | Phase 6+8: `--project unit` vs `--project api`                                      |
| `ADR-019` Multi-Tenant RLS Isolation | Phase 1+4+5b: RLS-Policy, `tenantTransaction()`, Dual-User-Model                    |
| `ADR-020` Per-User Feature Perms     | Phase 2-5b: Dezentrales Registry, Guard-Enforcement, `@RequirePermission` Decorator |
| `ADR-003` Notification System        | Phase 9: SSE-Handler filtern nach readable Features                                 |
| `ADR-004` Persistent Notification    | Phase 9: Dashboard Counts filtern nach readable Features                            |

### Pattern-Vorlagen (existierender Code)

| Datei                                                                | Dient als Vorlage für                                      |
| -------------------------------------------------------------------- | ---------------------------------------------------------- |
| `database/migrations/20260202000016_kvp-categories-custom.ts`        | Phase 1: Migration-Struktur, RLS, GRANTs                   |
| `backend/src/nest/admin-permissions/admin-permissions.service.ts`    | Phase 4: DatabaseService-Inject, `$1,$2,$3`, PermissionSet |
| `backend/src/nest/admin-permissions/admin-permissions.controller.ts` | Phase 5: Decorators, Roles, Param-Handling                 |
| `backend/src/nest/admin-permissions/admin-permissions.module.ts`     | Phase 5: Module-Struktur, DatabaseModule-Import            |

---

## Extensibility Design

### Kern-Prinzip: Dezentral — Feature besitzt seine Permissions

Neue Berechtigungs-Kategorie hinzufügen = **2 Files im Feature-Modul erstellen**.
Kein zentrales File, kein Service, kein Endpoint ändern.

### Beispiel: KVP-Berechtigungen hinzufügen

**File 1:** `backend/src/nest/kvp/kvp.permissions.ts`

```typescript
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types';

export const KVP_PERMISSIONS: PermissionCategoryDef = {
  code: 'kvp', // ← muss mit features.code matchen
  label: 'KVP',
  icon: 'fa-lightbulb',
  modules: [
    {
      code: 'kvp-suggestions',
      label: 'Vorschläge',
      icon: 'fa-comment',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    {
      code: 'kvp-review',
      label: 'Bewertung',
      icon: 'fa-check-circle',
      allowedPermissions: ['canRead', 'canWrite'],
    },
  ],
};
```

**File 2:** `backend/src/nest/kvp/kvp-permission.registrar.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service';
import { KVP_PERMISSIONS } from './kvp.permissions';

@Injectable()
export class KvpPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(KVP_PERMISSIONS);
  }
}
```

**File 3:** `backend/src/nest/kvp/kvp.module.ts` — **nur** `KvpPermissionRegistrar` zu `providers` hinzufügen.

**File 4:** Controller-Endpoints mit `@RequirePermission()` annotieren:

```typescript
// In kvp.controller.ts:
import { RequirePermission } from '../common/decorators/require-permission.decorator';

const KVP_FEATURE = 'kvp';
const KVP_SUGGESTIONS = 'kvp-suggestions';

@Get('suggestions')
@RequirePermission(KVP_FEATURE, KVP_SUGGESTIONS, 'canRead')
listSuggestions() { ... }

@Post('suggestions')
@RequirePermission(KVP_FEATURE, KVP_SUGGESTIONS, 'canWrite')
createSuggestion() { ... }
```

**Warum funktioniert das automatisch?**

1. **Registry:** `KvpPermissionRegistrar.onModuleInit()` registriert die Permissions beim Start
2. **DB:** `feature_code` + `module_code` sind VARCHAR-Strings — keine FK, neue Codes = neue Rows
3. **GET Endpoint:** Fragt `PermissionRegistryService.getAll()` → bekommt alle registrierten Kategorien
4. **PUT Endpoint:** Validiert gegen Registry → neue Kategorie wird akzeptiert
5. **Frontend:** Rendert dynamisch aus SSR-Daten — keine Hardcoded UI
6. **Enforcement:** `PermissionGuard` liest `@RequirePermission` Metadata → prüft `hasPermission()` in DB

### Existierende Feature-Codes (features-Tabelle)

Die `code` in Permission-Definitionen **muss** mit `features.code` übereinstimmen:

| code           | name                  | category   |
| -------------- | --------------------- | ---------- |
| blackboard     | Schwarzes Brett       | basic      |
| calendar       | Kalender              | basic      |
| dashboard      | Dashboard             | basic      |
| settings       | Einstellungen         | basic      |
| teams          | Teams                 | core       |
| documents      | Dokumente             | core       |
| employees      | Mitarbeiterverwaltung | core       |
| departments    | Abteilungen           | core       |
| shift_planning | Schichtplanung        | premium    |
| surveys        | Umfragen              | premium    |
| chat           | Chat                  | premium    |
| kvp            | KVP                   | enterprise |

### DTO-Validierung gegen Registry

Der Upsert-DTO validiert `featureCode` + `moduleCode` gegen `PermissionRegistryService`:

- Unbekannter `featureCode` → 400 Bad Request
- Unbekannter `moduleCode` innerhalb eines Features → 400 Bad Request
- Kein Müll in der DB, selbstdokumentierend

### Permission-Typen pro Modul (ENTSCHIEDEN: JA)

Jedes Modul definiert welche Permissions es unterstützt. Z.B. "Dashboard" → nur `canRead`.

```typescript
interface PermissionModuleDef {
  code: string;
  label: string;
  icon: string;
  allowedPermissions: ('canRead' | 'canWrite' | 'canDelete')[];
  // Explizit gesetzt. Z.B. ['canRead'] oder ['canRead', 'canWrite', 'canDelete']
}
```

- Frontend rendert **nur** die erlaubten Checkboxes pro Modul
- Backend **setzt nicht-erlaubte Permissions auf `false`** beim Speichern (Sicherheitsnetz)

### Tenant-Feature-Gating (ENTSCHIEDEN: JA)

Der GET Endpoint filtert registrierte Kategorien gegen `tenant_features`:

- Tenant hat KVP nicht gebucht → KVP-Kategorie wird **nicht** zurückgegeben
- Kein Feature-Zugriff = keine Permission-UI dafür
- Query: `SELECT feature_code FROM tenant_features WHERE tenant_id = $1 AND is_active = 1`

---

## Phase 1: Database Migration

**File:** `database/migrations/20260207000019_user-feature-permissions.ts`
**Quellen:** `docs/DATABASE-MIGRATION-GUIDE.md`, `ADR-014`, Vorlage: `20260202000016_kvp-categories-custom.ts`

```sql
-- Table
CREATE TABLE user_feature_permissions (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_code VARCHAR(50) NOT NULL,
    module_code VARCHAR(50) NOT NULL,
    can_read BOOLEAN NOT NULL DEFAULT FALSE,
    can_write BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete BOOLEAN NOT NULL DEFAULT FALSE,
    assigned_by INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_feature_module UNIQUE (tenant_id, user_id, feature_code, module_code)
);

-- Index
CREATE INDEX idx_ufp_user_tenant ON user_feature_permissions (tenant_id, user_id);

-- RLS (PFLICHT per ADR-019)
ALTER TABLE user_feature_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feature_permissions FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON user_feature_permissions
    FOR ALL
    USING (
        NULLIF(current_setting('app.tenant_id', true), '') IS NULL
        OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer
    );

-- GRANTs for app_user (PFLICHT per ADR-019)
GRANT SELECT, INSERT, UPDATE, DELETE ON user_feature_permissions TO app_user;
GRANT USAGE, SELECT ON SEQUENCE user_feature_permissions_id_seq TO app_user;

COMMENT ON TABLE user_feature_permissions IS 'Per-user, per-feature/module permission control (canRead, canWrite, canDelete)';
```

**Definition of Done:**

- [x] Migration runs without errors (`up` + `down`) ✅ 2026-02-07
- [x] RLS policy `tenant_isolation` existiert auf `user_feature_permissions` ✅ verified
- [x] `FORCE ROW LEVEL SECURITY` aktiv (auch Table Owner gefiltert) ✅ verified
- [x] GRANTs für `app_user` gesetzt (SELECT, INSERT, UPDATE, DELETE + Sequence) ✅ verified
- [x] Table visible in `\dt` ✅ verified
- [x] Unique constraint prevents duplicate (tenant_id, user_id, feature_code, module_code) ✅ `uq_user_feature_module`
- [ ] Cross-Tenant-Test: `SET app.tenant_id = '1'; SELECT ... WHERE tenant_id = 2;` → 0 Rows

---

## Phase 2: Permission Registry (Global Singleton)

**Quellen:** NestJS OnModuleInit, `@Global()` Pattern (wie DatabaseModule)
**Files:**

- `backend/src/nest/common/permission-registry/permission.types.ts`
- `backend/src/nest/common/permission-registry/permission-registry.service.ts`
- `backend/src/nest/common/permission-registry/permission-registry.module.ts`

### Types (`permission.types.ts`)

```typescript
export interface PermissionModuleDef {
  code: string;
  label: string;
  icon: string;
  allowedPermissions: ('canRead' | 'canWrite' | 'canDelete')[];
}

export interface PermissionCategoryDef {
  code: string; // MUSS mit features.code matchen
  label: string;
  icon: string;
  modules: PermissionModuleDef[];
}
```

### Service (`permission-registry.service.ts`)

```typescript
@Injectable()
export class PermissionRegistryService {
  private readonly categories = new Map<string, PermissionCategoryDef>();

  register(category: PermissionCategoryDef): void {
    if (this.categories.has(category.code)) {
      throw new Error(`Permission category "${category.code}" already registered`);
    }
    this.categories.set(category.code, category);
  }

  getAll(): PermissionCategoryDef[] {
    return Array.from(this.categories.values());
  }

  getByCode(code: string): PermissionCategoryDef | undefined {
    return this.categories.get(code);
  }

  isValidModule(featureCode: string, moduleCode: string): boolean {
    const category = this.categories.get(featureCode);
    if (!category) return false;
    return category.modules.some((m) => m.code === moduleCode);
  }

  getAllowedPermissions(featureCode: string, moduleCode: string): ('canRead' | 'canWrite' | 'canDelete')[] {
    const category = this.categories.get(featureCode);
    if (!category) return [];
    const mod = category.modules.find((m) => m.code === moduleCode);
    return mod?.allowedPermissions ?? [];
  }
}
```

### Module (`permission-registry.module.ts`)

```typescript
@Global()
@Module({
  providers: [PermissionRegistryService],
  exports: [PermissionRegistryService],
})
export class PermissionRegistryModule {}
```

**Registration:** Import `PermissionRegistryModule` in `app.module.ts` (einmalig).

**Definition of Done:**

- [x] PermissionRegistryService ist @Injectable() Singleton ✅ 2026-02-07
- [x] register() wirft Error bei doppelter Registrierung (fail-fast) ✅ implemented
- [x] getAll(), getByCode(), isValidModule(), getAllowedPermissions() funktionieren ✅ implemented
- [x] @Global() Modul in app.module.ts registriert ✅ verified in backend logs
- [x] Kein Feature-spezifisches Wissen im Registry ✅ pure registry, no feature imports

---

## Phase 3: Feature Permission Definitions + Zod DTOs

**Quellen:** `backend/docs/ZOD-INTEGRATION-GUIDE.md`, `docs/TYPESCRIPT-STANDARDS.md`

### Feature Permission Files (pro Feature-Modul)

Jedes Feature-Modul bekommt 2 Files:

**Beispiel Blackboard:**

`backend/src/nest/blackboard/blackboard.permissions.ts`

```typescript
import type { PermissionCategoryDef } from '../common/permission-registry/permission.types';

export const BLACKBOARD_PERMISSIONS: PermissionCategoryDef = {
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
};
```

`backend/src/nest/blackboard/blackboard-permission.registrar.ts`

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';

import { PermissionRegistryService } from '../common/permission-registry/permission-registry.service';
import { BLACKBOARD_PERMISSIONS } from './blackboard.permissions';

@Injectable()
export class BlackboardPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}

  onModuleInit(): void {
    this.registry.register(BLACKBOARD_PERMISSIONS);
  }
}
```

**Dann in `blackboard.module.ts`:** `BlackboardPermissionRegistrar` zu `providers` hinzufügen.

### Initiale Feature-Module mit Permissions (Phase 3 Scope)

Nur Features die **jetzt schon** Backend-Module haben:

| Feature-Modul | Permissions-File            | Registrar-File                       |
| ------------- | --------------------------- | ------------------------------------ |
| blackboard    | `blackboard.permissions.ts` | `blackboard-permission.registrar.ts` |

Weitere Feature-Module (calendar, documents, etc.) bekommen ihre Permissions erst wenn sie implementiert werden. **YAGNI** — keine leeren Hüllen.

### DTOs (Zod)

**Files:**

- `backend/src/nest/user-permissions/dto/upsert-user-permissions.dto.ts`
- `backend/src/nest/user-permissions/dto/index.ts`

- `UpsertUserPermissionsDto`: array of `{ featureCode, moduleCode, canRead, canWrite, canDelete }`
- Validation:
  - featureCode/moduleCode must be non-empty strings
  - booleans required
  - **Hinweis:** Validierung gegen Registry passiert im Service, nicht im DTO
  - DTO validiert nur Struktur (Typen, Format), Service validiert Business-Logik (gibt es den Code?)

**Warum Validierung im Service statt DTO?**
Der DTO hat keinen Zugriff auf den `PermissionRegistryService` (Zod-Schemas sind plain functions, keine Injectable classes). Die Business-Validierung (existiert der featureCode?) macht der Service.

**Definition of Done:**

- [x] Blackboard-Permissions registriert sich via OnModuleInit ✅ logs: `Registered permission category "blackboard" with 1 module(s)`
- [x] blackboard.module.ts enthält BlackboardPermissionRegistrar als Provider ✅ 2026-02-07
- [x] Zod DTO validiert Struktur (Typen, Non-Empty Strings, Booleans) ✅ UpsertUserPermissionsSchema
- [x] DTO barrel export via index.ts ✅ with `export type` for PermissionEntry
- [x] Kein Feature-spezifisches Wissen im DTO ✅ pure structure validation

---

## Phase 4: Backend Service

**Quellen:** `ADR-006` (ClsService), `ADR-019` (RLS + `tenantTransaction()`), Vorlage: `admin-permissions.service.ts`
**File:** `backend/src/nest/user-permissions/user-permissions.service.ts`

### RLS-Konformität (ADR-019)

**KRITISCH:** NICHT `db.query()` mit manueller `WHERE tenant_id = $X` verwenden!
Stattdessen `db.tenantTransaction()` verwenden — setzt `set_config('app.tenant_id', ...)` GUC per Transaction.
PostgreSQL RLS filtert dann automatisch. `WHERE tenant_id = $X` zusätzlich als Belt-and-Suspenders.

```typescript
// ✅ ADR-019 konform: tenantTransaction() + RLS
async getPermissions(tenantId: number, userUuid: string): Promise<...> {
  return this.db.tenantTransaction(async (client) => {
    // RLS filtert automatisch via set_config('app.tenant_id', ...)
    const rows = await client.query(
      'SELECT ... FROM user_feature_permissions WHERE user_id = $1',
      [userId]
    );
    // ...
  });
}

// ❌ NICHT SO: db.query() ohne GUC — RLS Policy fällt auf "allow all" (Root-Modus)
async getPermissions(tenantId: number, userUuid: string): Promise<...> {
  const rows = await this.db.query(
    'SELECT ... FROM user_feature_permissions WHERE tenant_id = $1 AND user_id = $2',
    [tenantId, userId]
  );
}
```

### Vier Methoden:

1. **`getPermissions(tenantId, userUuid)`** — via `tenantTransaction()`
   - Resolve UUID → user_id
   - Query `tenant_features` to get active feature codes for this tenant
   - Get all categories from `PermissionRegistryService.getAll()`
   - Filter categories to only include tenant-active features
   - SELECT all permission rows for user from `user_feature_permissions` (RLS filtert tenant)
   - Merge DB rows with filtered categories → full category tree with current boolean values
   - Modules with `allowedPermissions` set: only include those permission types

2. **`upsertPermissions(tenantId, userUuid, permissions[], assignedBy)`** — via `tenantTransaction()`
   - Resolve UUID → user_id
   - Validate each entry against `PermissionRegistryService.isValidModule()` → BadRequestException
   - For modules with `allowedPermissions`: force non-allowed permissions to `false` via `getAllowedPermissions()`
   - INSERT ... ON CONFLICT DO UPDATE (RLS sichert tenant_id automatisch ab)

3. **`hasPermission(userId, featureCode, moduleCode, action)`** — via `tenantTransaction()` _(Phase 5b)_
   - Used by `PermissionGuard` for endpoint enforcement
   - Takes numeric userId (already resolved by JwtAuthGuard, no UUID resolution needed)
   - SELECT single row from `user_feature_permissions` (RLS filtert tenant via CLS)
   - Returns `boolean`: `true` if permission granted, `false` if denied or no row exists
   - **Fail-closed:** No row in DB = `false` (denied). Explicit grant required.
   - No `tenantId` param — CLS already set by JwtAuthGuard before guard executes

4. **`getActiveFeaturesForTenant(tenantId)`** — (private helper, innerhalb der Transaction)
   - `SELECT feature_code FROM tenant_features WHERE is_active = 1` (RLS filtert tenant)
   - Returns `Set<string>` for O(1) lookup

5. **`getReadableFeatureCodes(userId)`** — via `tenantTransaction()` _(Phase 9)_
   - Used by `DashboardService` and `NotificationsController` to filter counts/events
   - `SELECT DISTINCT feature_code FROM user_feature_permissions WHERE user_id = $1 AND can_read = true`
   - Returns `Set<string>` of feature codes the user can read
   - No permission row = not in Set → feature counts/events suppressed

Uses: `DatabaseService.tenantTransaction()`, `PermissionRegistryService`, `Logger`, `NotFoundException`, `BadRequestException`.

**Definition of Done:**

- [x] Alle DB-Zugriffe via `tenantTransaction()` (NICHT `db.query()`) ✅ both methods use tenantTransaction
- [x] RLS GUC wird gesetzt via `set_config('app.tenant_id', ...)` (automatisch durch `tenantTransaction`) ✅
- [x] getPermissions returns full category tree filtered by tenant's active features ✅ JOINs tenant_features + features
- [x] upsertPermissions uses UPSERT (INSERT ON CONFLICT UPDATE) ✅ ON CONFLICT (tenant_id, user_id, feature_code, module_code)
- [x] Validierung gegen PermissionRegistryService (nicht gegen hardcoded Constants) ✅ isValidModule() + getAllowedPermissions()
- [x] Non-allowed permission types forced to `false` on save ✅ checked per entry
- [x] NotFoundException if UUID doesn't resolve ✅ resolveUserIdFromUuid()
- [x] BadRequestException if featureCode/moduleCode unknown ✅ isValidModule() check
- [x] hasPermission() returns boolean for guard enforcement ✅ fail-closed, no row = false
- [x] hasPermission() uses tenantTransaction() for RLS compliance ✅ CLS tenantId from JwtAuthGuard
- [x] getReadableFeatureCodes() returns Set of readable feature codes ✅ used by DashboardService + NotificationsController

---

## Phase 5: Backend Controller + Module

**Quellen:** `ADR-005` (JWT Guard), `ADR-007` (kein Double-Wrap), `ADR-012` (RBAC), Vorlage: `admin-permissions.controller.ts`
**Files:**

- `backend/src/nest/user-permissions/user-permissions.controller.ts`
- `backend/src/nest/user-permissions/user-permissions.module.ts`

### Controller

```
GET  /user-permissions/:uuid  → getPermissions
PUT  /user-permissions/:uuid  → upsertPermissions
```

- `@Controller('user-permissions')`
- `@Roles('admin', 'root')` on class level (admin + root manage user permissions)
- `@CurrentUser()` for assignedBy
- `@TenantId()` for tenant context
- UUID param validated as string (UUIDv7 format)
- PUT body validated with `UpsertUserPermissionsDto`
- `assertFullAccess()`: Root always passes; Admin needs `hasFullAccess = true`
- Returns raw data — ResponseInterceptor wraps automatically (ADR-007, NO double-wrapping)
- **KEIN** `@RequirePermission` hier — das sind Management-Endpoints, geschützt durch `@Roles` + `assertFullAccess()`

### Module

- Imports: DatabaseModule
- Providers: UserPermissionsService
- Controllers: UserPermissionsController

### Registration

- Modify `backend/src/nest/app.module.ts`: add import + register UserPermissionsModule

**Definition of Done:**

- [x] GET endpoint returns permission tree for user ✅ `GET /api/v2/user-permissions/:uuid` mapped
- [x] PUT endpoint saves permissions via UPSERT ✅ `PUT /api/v2/user-permissions/:uuid` mapped
- [x] @Roles('admin', 'root') protects both endpoints ✅ class-level decorator
- [x] assertFullAccess() checks admin has `hasFullAccess = true` ✅ Root always passes
- [x] Module registered in AppModule ✅ UserPermissionsModule + PermissionRegistryModule
- [x] No double-wrapping (controller returns raw, interceptor wraps) ✅ returns raw data

---

## Phase 5b: Permission Enforcement (PermissionGuard)

**Quellen:** `ADR-020` (Per-User Feature Permissions), `ADR-005` (JWT Guard Pattern), `ADR-012` (Fail-Closed RBAC)
**Problem:** Phasen 1–5 bauen nur CRUD (Speichern/Lesen). Ohne Enforcement ist das System wirkungslos — Permissions werden in DB geschrieben, aber kein Guard prüft sie an den Feature-Endpoints. Ergebnis: User hat `canRead=false` für Blackboard, kann aber trotzdem alle Entries lesen.

### Architektur: 3 Bausteine

**1. `@RequirePermission()` Decorator** — markiert Endpoints mit benötigter Permission

```typescript
@RequirePermission('blackboard', 'blackboard-posts', 'canRead')
@Get('entries')
listEntries() { ... }
```

Speichert `RequiredPermission { featureCode, moduleCode, action }` als NestJS Metadata.
Exakt gleiches Pattern wie `@Roles()` — nur mit 3 statt 1 Parameter.

**2. `hasPermission()` Service-Methode** — prüft DB

```typescript
// In UserPermissionsService (Phase 4 erweitert):
async hasPermission(userId: number, featureCode: string, moduleCode: string, action: PermissionType): Promise<boolean> {
  return this.db.tenantTransaction(async (client) => {
    const result = await client.query(
      'SELECT can_read, can_write, can_delete FROM user_feature_permissions WHERE user_id = $1 AND feature_code = $2 AND module_code = $3',
      [userId, featureCode, moduleCode]
    );
    const row = result.rows[0];
    if (!row) return false; // Fail-closed: no row = denied
    switch (action) {
      case 'canRead':  return row.can_read;
      case 'canWrite': return row.can_write;
      case 'canDelete': return row.can_delete;
    }
  });
}
```

- `tenantTransaction()` für RLS-Compliance (ADR-019)
- CLS tenantId bereits gesetzt durch JwtAuthGuard
- Kein `tenantId` Parameter nötig — Guard läuft NACH JwtAuthGuard

**3. `PermissionGuard`** — Globaler NestJS Guard (3. in der Kette)

```
Request → JwtAuthGuard → RolesGuard → PermissionGuard → Controller
             (1.)           (2.)          (3. NEU)
```

Logik:

1. Kein `@RequirePermission()` Metadata → **pass through** (Endpoint hat keine Feature-Permission)
2. User ist Root → **pass** (Root hat immer Vollzugriff, DB-Trigger erzwingt dies)
3. User ist Admin mit `hasFullAccess=true` → **pass** (Admins die Permissions verwalten)
4. Alle anderen → **DB-Check** via `hasPermission()`, bei `false` → `ForbiddenException`

### Bypass-Logik (WICHTIG)

| User-Typ                 | Verhalten  | Begründung                                                    |
| ------------------------ | ---------- | ------------------------------------------------------------- |
| Root                     | Immer pass | Vollzugriff per Design, DB-Trigger (Migration 20260207000020) |
| Admin + hasFullAccess    | Immer pass | Permission-Verwalter, muss alles sehen können                 |
| Admin ohne hasFullAccess | DB-Check   | Eingeschränkter Admin, Permissions gelten                     |
| Employee                 | DB-Check   | Standard-User, Permissions gelten                             |
| Role-Switched Admin      | DB-Check   | Wenn Admin als Employee agiert, Employee-Regeln gelten        |

### Fail-Closed Design

**Kein Row in DB = Zugriff verweigert.**

- Neuer User ohne Permissions → kann nichts
- Admin muss explizit Permissions vergeben
- Konsistent mit Security-Best-Practice: Deny by default, allow explicitly

### Files

**Neue Files:**

| File                                                                 | Zweck                                         |
| -------------------------------------------------------------------- | --------------------------------------------- |
| `backend/src/nest/common/decorators/require-permission.decorator.ts` | `@RequirePermission(feature, module, action)` |
| `backend/src/nest/common/guards/permission.guard.ts`                 | Globaler Guard, Enforcement-Logik             |

**Modifizierte Files:**

| File                                                            | Änderung                                       |
| --------------------------------------------------------------- | ---------------------------------------------- |
| `backend/src/nest/user-permissions/user-permissions.service.ts` | `hasPermission()` Methode hinzugefügt          |
| `backend/src/nest/app.module.ts`                                | `PermissionGuard` als 3. APP_GUARD registriert |
| `backend/src/nest/blackboard/blackboard.controller.ts`          | `@RequirePermission` auf alle 22 Endpoints     |

### Blackboard Endpoint-Mapping

Erstes Feature mit vollständigem Enforcement:

| Permission  | Endpoints                                                                                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canRead`   | GET entries, GET dashboard, GET unconfirmed-count, GET entries/:id, GET entries/:id/full, POST entries/:id/confirm, DELETE entries/:id/confirm, GET entries/:id/confirmations, GET entries/:id/comments, GET entries/:id/attachments, GET attachments/:attachmentId, GET attachments/:attachmentId/preview, GET attachments/:fileUuid/download |
| `canWrite`  | POST entries, PUT entries/:id, POST entries/:id/archive, POST entries/:id/unarchive, POST entries/:id/comments, POST entries/:id/attachments                                                                                                                                                                                                   |
| `canDelete` | DELETE entries/:id, DELETE comments/:commentId, DELETE attachments/:attachmentId                                                                                                                                                                                                                                                               |

**Konstanten:** `BB_FEATURE = 'blackboard'`, `BB_MODULE = 'blackboard-posts'` (sonarjs/no-duplicate-string compliant)

### Definition of Done

- [x] `@RequirePermission()` Decorator erstellt, folgt exakt `@Roles()` Pattern ✅ 2026-02-07
- [x] `hasPermission()` in UserPermissionsService, nutzt `tenantTransaction()` (ADR-019) ✅ 2026-02-07
- [x] `PermissionGuard` erstellt, global registriert als 3. APP_GUARD ✅ 2026-02-07
- [x] Root bypass ✅ `user.activeRole === 'root'` → return true
- [x] Admin + hasFullAccess bypass ✅ `user.activeRole === 'admin' && user.hasFullAccess` → return true
- [x] Fail-closed: no row = ForbiddenException ✅ `hasPermission()` returns false if no DB row
- [x] Blackboard: alle 22 Endpoints mit `@RequirePermission` annotiert ✅ canRead/canWrite/canDelete
- [x] Logger.warn bei Permission-Denied (User-ID, Role, Feature, Module, Action) ✅
- [x] ESLint 0 Errors ✅ TSDoc escaping, import order, no-duplicate-string
- [x] Backend TypeScript type-check 0 Errors ✅ `tsc --noEmit -p backend`
- [x] Backend startet fehlerfrei nach Restart ✅ `Nest application successfully started`
- [x] Guard-Kette korrekt: JWT → Roles → Permission (in dieser Reihenfolge) ✅ APP_GUARD Reihenfolge in app.module.ts

---

## Phase 6: Backend Unit Tests

> **Ausgelagert in separaten Plan:** [`docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md`](./USER-PERMISSIONS-UNIT-TEST-PLAN.md)
>
> **106 Unit Tests** in 6 Dateien (Management + Enforcement + Notification Coupling):
>
> | Test-Datei                             | Tests | Fokus                                                                |
> | -------------------------------------- | ----- | -------------------------------------------------------------------- |
> | `permission-registry.service.test.ts`  | 20    | In-Memory-Registry, keine DB                                         |
> | `user-permissions.dto.test.ts`         | 18    | Zod-Schema-Validierung                                               |
> | `user-permissions.service.test.ts`     | 42    | Service-Logik mit gemocktem DB + Registry + hasPermission + readable |
> | `permission.guard.test.ts`             | 16    | Guard-Enforcement: Bypass, DB-Check, Logging                         |
> | `require-permission.decorator.test.ts` | 5     | Decorator-Metadata (SetMetadata)                                     |
> | `dashboard.service.test.ts`            | 12    | Dashboard Aggregation + Permission Filtering (Phase 9)               |
>
> **Abweichungen vom Plan (ehrliche Anpassungen):**
>
> 1. **DTO Test #5:** Schema hat `.min(1)` → leeres Array wird abgelehnt (nicht akzeptiert)
> 2. **Registry Test #5:** `register()` speichert Referenz (kein Deep Copy) — Mutation nach Registration sichtbar
> 3. **Service Test #24 (Atomarität):** Implementierung validiert per-entry (nicht pre-validation). Atomarität via DB Transaction Rollback.

**Definition of Done:**

- [x] Alle 106 Unit Tests grün: `vitest run --project unit` ✅ 2026-02-07
- [x] ESLint 0 Errors auf allen 5 Test-Dateien ✅ 2026-02-07
- [x] Siehe [`USER-PERMISSIONS-UNIT-TEST-PLAN.md`](./USER-PERMISSIONS-UNIT-TEST-PLAN.md) für vollständige DoD

---

## Phase 7: Frontend Integration

**Quellen:** `docs/CODE-OF-CONDUCT-SVELTE.md`, Svelte 5 Runes (`$state`, `$derived`, `$props`)

### Architecture: Shared Component + Origin-Aware Routes

Statt Permission-UI in einer Route zu duplizieren: **Shared Component + Shared Loader** für 2 Routen.

**Shared Files (DRY):**

- `frontend/src/lib/components/PermissionSettings.svelte` — Shared UI (categories, checkboxes, save)
- `frontend/src/lib/server/load-permission-data.ts` — Shared server-side loader

**2 Origin-Aware Routes (thin wrappers):**

- `frontend/src/routes/(app)/(admin)/manage-employees/permission/[uuid]/+page.server.ts`
- `frontend/src/routes/(app)/(admin)/manage-admins/permission/[uuid]/+page.server.ts`

> **Root Users ausgenommen:** Root hat per Design immer Vollzugriff (DB-Trigger `root_must_have_full_access`).
> Permission-Management für Root ist sinnlos und wurde entfernt (Button, Route, Loader).

Each `+page.svelte` passes its origin-specific `backUrl` + `backLabel` to `PermissionSettings.svelte`.

### PermissionSettings.svelte

- Props: `employee`, `permissionData`, `error`, `backUrl`, `backLabel`
- `$state` initialized from `structuredClone(permissionData)` (intentional one-time clone for form editing)
- `svelte-ignore state_referenced_locally` comment documents this is deliberate
- Uses `empty-state` design system pattern for error + empty states
- Save button: `PUT /api/v2/user-permissions/${uuid}` via client-side fetch
- Toast notifications on toggle (showSuccessAlert / showWarningAlert)

### load-permission-data.ts

- Fetches employee + permissions in parallel: `GET /api/v2/users/${uuid}` + `GET /api/v2/user-permissions/${uuid}`
- Returns `{ employee, permissionData, error }` for SSR consumption

**Definition of Done:**

- [x] Permission categories loaded from API (not hardcoded) ✅ `GET /api/v2/user-permissions/${uuid}` via shared loader
- [x] Save button persists permissions to DB ✅ `PUT /api/v2/user-permissions/${uuid}` via client-side fetch
- [x] Saved permissions survive page reload ✅ SSR loads from DB on every page load
- [x] Error handling for API failures ✅ graceful fallback + showErrorAlert
- [x] Loading state during save ✅ `isSaving` state + spinner icon + disabled button
- [x] Shared component for 2 routes (DRY) ✅ PermissionSettings.svelte + load-permission-data.ts (Root excluded — always full access)
- [x] Empty-state design system pattern ✅ `empty-state__icon`, `empty-state__title`, `empty-state__description`
- [x] Svelte `$state` warning resolved ✅ `svelte-ignore state_referenced_locally` (intentional one-time clone)
- [x] `validate:all` passes clean ✅ 0 errors, 0 warnings (TypeScript + Svelte + Stylelint)

---

## Phase 8: API Integration Test

**Quellen:** `ADR-018` (Vitest), `docs/HOW-TO-TEST-WITH-VITEST.md`
**File:** `api-tests/vitest/user-permissions.api.test.ts`

**16 Tests in 7 Describe-Blöcken:**

| #   | Describe-Block           | Tests | Szenarien                                                             |
| --- | ------------------------ | ----- | --------------------------------------------------------------------- |
| 1   | GET Default Permissions  | 4     | 200 OK, Array-Struktur, Category-Struktur, Module boolean fields      |
| 2   | Tenant Feature Filtering | 2     | blackboard vorhanden, allowedPermissions metadata                     |
| 3   | PUT + GET Roundtrip      | 3     | PUT 200 + updated count, GET returns saved values, UPSERT overwrite   |
| 4   | PUT Unknown Feature      | 1     | unbekannter featureCode → 400                                         |
| 5   | PUT Invalid Body         | 3     | missing permissions array, missing booleans, non-boolean values → 400 |
| 6   | GET Non-Existent UUID    | 1     | fake UUID → 404                                                       |
| 7   | Employee Access Denied   | 2     | Employee GET → 403, Employee PUT → 403                                |

**Definition of Done:**

- [x] All 7 test scenarios pass (16 Tests) ✅ 2026-02-07
- [x] Tests run: `vitest run --project api` ✅ 16 passed, 0 failed

---

## File Summary

### New Files (21)

1. `database/migrations/20260207000019_user-feature-permissions.ts`
2. `database/migrations/20260207000020_root-must-have-full-access.ts`
3. `backend/src/nest/common/permission-registry/permission.types.ts`
4. `backend/src/nest/common/permission-registry/permission-registry.service.ts`
5. `backend/src/nest/common/permission-registry/permission-registry.module.ts`
6. `backend/src/nest/common/decorators/require-permission.decorator.ts` _(Phase 5b)_
7. `backend/src/nest/common/guards/permission.guard.ts` _(Phase 5b)_
8. `backend/src/nest/common/permission-registry/permission-registry.service.test.ts` _(Phase 6)_
9. `backend/src/nest/user-permissions/user-permissions.service.test.ts` _(Phase 6)_
10. `backend/src/nest/user-permissions/dto/user-permissions.dto.test.ts` _(Phase 6)_
11. `backend/src/nest/common/guards/permission.guard.test.ts` _(Phase 6)_
12. `backend/src/nest/common/decorators/require-permission.decorator.test.ts` _(Phase 6)_
13. `backend/src/nest/blackboard/blackboard.permissions.ts`
14. `backend/src/nest/blackboard/blackboard-permission.registrar.ts`
15. `backend/src/nest/user-permissions/user-permissions.service.ts`
16. `backend/src/nest/user-permissions/user-permissions.controller.ts`
17. `backend/src/nest/user-permissions/user-permissions.module.ts`
18. `backend/src/nest/user-permissions/dto/upsert-user-permissions.dto.ts`
19. `backend/src/nest/user-permissions/dto/index.ts`
20. `api-tests/vitest/user-permissions.api.test.ts` _(Phase 8)_
21. `frontend/src/lib/components/PermissionSettings.svelte` — Shared permission UI component
22. `frontend/src/lib/server/load-permission-data.ts` — Shared server-side loader

### Modified Files (11)

1. `backend/src/nest/app.module.ts` — add PermissionRegistryModule + UserPermissionsModule + PermissionGuard (APP_GUARD)
2. `backend/src/nest/user-permissions/user-permissions.service.ts` — add `hasPermission()` _(Phase 5b)_ + `getReadableFeatureCodes()` _(Phase 9)_
3. `backend/src/nest/blackboard/blackboard.controller.ts` — add `@RequirePermission` to all 22 endpoints _(Phase 5b)_
4. `backend/src/nest/common/interfaces/auth.interface.ts` — add `hasFullAccess: boolean` to NestAuthUser
5. `backend/src/nest/common/guards/jwt-auth.guard.ts` — add `has_full_access` to DB query + buildAuthUser
6. `frontend/.../manage-employees/permission/[uuid]/+page.server.ts` — uses shared loader
7. `frontend/.../manage-admins/permission/[uuid]/+page.server.ts` — uses shared loader
8. `backend/src/nest/dashboard/dashboard.service.ts` — permission-aware `getCounts()` _(Phase 9)_
9. `backend/src/nest/dashboard/dashboard.module.ts` — import UserPermissionsModule _(Phase 9)_
10. `backend/src/nest/notifications/notifications.controller.ts` — permission-filtered SSE _(Phase 9)_
11. `backend/src/nest/notifications/notifications.module.ts` — import UserPermissionsModule _(Phase 9)_

### Modified Files (Feature-Module, nur Provider hinzufügen)

1. `backend/src/nest/blackboard/blackboard.module.ts` — add BlackboardPermissionRegistrar to providers

---

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 5b → Phase 6 → Phase 7 → Phase 8 → Phase 9

```
Phase 1: DB Migration (Table + RLS)               ✅
Phase 2: Permission Registry (Global Singleton)    ✅
Phase 3: Feature Definitions + Zod DTOs            ✅
Phase 4: Backend Service (CRUD + hasPermission)    ✅
Phase 5: Backend Controller + Module               ✅
Phase 5b: Enforcement (PermissionGuard)            ✅  ← CRITICAL: macht Permissions wirksam
Phase 6: Backend Unit Tests (106/106 grün)  ✅
Phase 7: Frontend Integration                      ✅
Phase 8: API Integration Tests (16/16 grün)   ✅
Phase 9: Notification-Permission Coupling          ✅  ← Kein Permission = Kein Badge/SSE
```

Each phase is self-contained and testable before moving to the next.

---

## Definition of Done — Plan Teil 1 (Infrastruktur + Blackboard + Enforcement)

**Status: Infrastruktur + Enforcement komplett. Blackboard ist erstes Feature mit vollständigem Permission-Enforcement. Plan Teil 2 fügt alle 7 Features hinzu.**

### Management Layer (Phase 1–5, 7)

- [x] Migration läuft fehlerfrei, Tabelle + RLS + FORCE + Policy + GRANTs + Index existieren ✅
- [ ] RLS Cross-Tenant-Test bestanden (Tenant 1 sieht keine Tenant 2 Daten)
- [x] PermissionRegistryModule ist @Global() Singleton, register()/getAll() funktionieren ✅
- [x] Blackboard registriert seine Permissions via OnModuleInit ✅
- [x] Zod DTO validiert Struktur, Service validiert gegen Registry ✅
- [x] Service nutzt `tenantTransaction()` für ALLE DB-Zugriffe (ADR-019) ✅
- [x] GET Endpoint: gibt Permissions-Tree zurück, gefiltert nach Tenant-Features ✅
- [x] PUT Endpoint: speichert Permissions per UPSERT, erzwingt allowedPermissions ✅
- [x] Frontend lädt Permissions aus API, Save-Button persistiert in DB ✅
- [x] Permissions überleben Page-Reload ✅
- [x] Shared Component Pattern: 3 Routen teilen `PermissionSettings.svelte` + `load-permission-data.ts` ✅
- [x] Empty-State Design System Pattern korrekt verwendet ✅
- [x] Erweiterbarkeit: neue Kategorie = 2 Files im Feature-Modul, kein zentrales File ✅
- [x] `validate:all` passes clean: 0 Errors, 0 Warnings (TypeScript + Svelte + Stylelint) ✅
- [x] Svelte `$state` Warning resolved (svelte-ignore, intentional one-time clone) ✅
- [x] Backend routes mapped: `GET /api/v2/user-permissions/:uuid` + `PUT /api/v2/user-permissions/:uuid` ✅
- [x] Frontend 200 OK: manage-employees, manage-admins, manage-root permission routes work ✅
- [x] `pnpm test` — 3374 Tests grün, 0 Failures ✅

### Enforcement Layer (Phase 5b)

- [x] `@RequirePermission()` Decorator erstellt (folgt `@Roles()` Pattern) ✅
- [x] `hasPermission()` Service-Methode, `tenantTransaction()`, fail-closed ✅
- [x] `PermissionGuard` global registriert als 3. APP_GUARD (nach JWT + Roles) ✅
- [x] Root-Bypass: `activeRole === 'root'` → immer pass ✅
- [x] Admin-Full-Access-Bypass: `activeRole === 'admin' && hasFullAccess` → immer pass ✅
- [x] Fail-Closed: kein DB-Row = ForbiddenException (Deny by default) ✅
- [x] Blackboard: alle 22 Endpoints mit `@RequirePermission` annotiert ✅
- [x] Logger.warn bei Permission-Denied mit User-ID, Role, Feature, Module, Action ✅
- [x] ESLint 0 Errors + Backend TypeScript type-check 0 Errors ✅
- [x] Backend startet fehlerfrei, Guard-Kette: JWT → Roles → Permission ✅

### Notification Coupling Layer (Phase 9)

- [x] `getReadableFeatureCodes()` in UserPermissionsService ✅
- [x] DashboardService: Feature-Counts gefiltert nach User-Permissions ✅
- [x] NotificationsController: SSE-Events gefiltert nach User-Permissions ✅
- [x] Bypass-Logik identisch mit PermissionGuard (Root, Admin+fullAccess) ✅
- [x] 10 neue Unit Tests (5 Dashboard + 5 getReadableFeatureCodes) ✅

### Noch Offen

- [x] Unit Tests grün (106/106: Registry + DTO + Service + Guard + Decorator + Dashboard) ✅ 2026-02-07
- [ ] RLS Cross-Tenant-Test bestanden (Phase 1 DoD)
- [x] API Integration Tests grün (16 Tests, 7 Szenarien) ✅ 2026-02-07
- [ ] Frontend: allowedPermissions-Checkboxes pro Modul korrekt gefiltert
- [ ] Frontend: alle 17 Module im Permission-Tree angezeigt
- [ ] Enforcement-Test: User ohne Permission → 403 Forbidden

### Bugfixes während Implementation (2026-02-07)

| Bug                                | Root Cause                                                                                                                                                                                                                                                                            | Fix                                                                                                                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 403 für root User                  | `@Roles('admin')` schloss root aus                                                                                                                                                                                                                                                    | `@Roles('admin', 'root')`                                                                                                                                                        |
| Admin ohne `has_full_access` Check | `hasFullAccess` fehlte in `NestAuthUser` + JWT Guard                                                                                                                                                                                                                                  | `has_full_access` zu Guard-Query + `NestAuthUser` hinzugefügt, `assertFullAccess()` im Controller                                                                                |
| Leere Permissions-Liste            | Tenant 2 hatte keine `tenant_features` Einträge                                                                                                                                                                                                                                       | `INSERT INTO tenant_features` für Tenant 2 (12 Features)                                                                                                                         |
| Toast-Spam bei Checkbox-Toggle     | `showSuccessAlert`/`showWarningAlert` bei jedem Toggle                                                                                                                                                                                                                                | Handler entleert, Feedback nur noch beim Speichern                                                                                                                               |
| **Permissions wirken nicht**       | **KEIN Enforcement-Layer vorhanden** — Permissions wurden gespeichert aber nie geprüft. Kein Guard, kein Interceptor, kein Middleware las `user_feature_permissions` bei Feature-Requests. Alle Feature-Controller (Blackboard etc.) prüften nur `@Roles()`, nie Feature-Permissions. | **Phase 5b:** `@RequirePermission()` Decorator + `PermissionGuard` (globaler APP_GUARD) + `hasPermission()` Service-Methode. Blackboard als erstes Feature vollständig enforced. |

### Zusätzlich modifizierte Files (Bugfixes)

- `backend/src/nest/common/interfaces/auth.interface.ts` — `hasFullAccess: boolean` zu `NestAuthUser`
- `backend/src/nest/common/guards/jwt-auth.guard.ts` — `has_full_access` in DB-Query + `UserRow` + `buildAuthUser()`
- `frontend/src/lib/components/PermissionSettings.svelte` — Toast-Spam entfernt, unused import entfernt

### Zusätzlich erstellte/modifizierte Files (Enforcement, Phase 5b)

- `backend/src/nest/common/decorators/require-permission.decorator.ts` — **NEU** `@RequirePermission()` Decorator
- `backend/src/nest/common/guards/permission.guard.ts` — **NEU** Globaler PermissionGuard
- `backend/src/nest/user-permissions/user-permissions.service.ts` — `hasPermission()` Methode hinzugefügt
- `backend/src/nest/app.module.ts` — `PermissionGuard` als 3. APP_GUARD registriert
- `backend/src/nest/blackboard/blackboard.controller.ts` — `@RequirePermission` auf alle 22 Endpoints + `BB_FEATURE`/`BB_MODULE` Konstanten

---

## Phase 9: Notification-Permission Coupling

**Quellen:** `ADR-003` (Real-Time Notifications), `ADR-004` (Persistent Notification Counts), `ADR-020` (Permissions)
**Problem:** Ohne Kopplung sieht ein User ohne Blackboard-Permission trotzdem Badge-Count `4` und bekommt SSE-Events. Permissions werden enforced (403), aber die UI zeigt irrelevante Badges.

### Architektur: Zwei-Punkt-Filterung im Backend

```
                             Permission-Check
                                    │
              ┌─────────────────────┼───────────────────────┐
              ▼                                             ▼
    DashboardService.getCounts()              NotificationsController.stream()
    (ADR-004: Initial Counts)                 (ADR-003: SSE Events)
              │                                             │
    canAccess('blackboard')                   if (readable.has('blackboard'))
    ? fetchBlackboardCount()                    → register SSE handler
    : Promise.resolve({ count: 0 })           else → skip handler registration
```

**Keine Frontend-Änderung nötig** — Backend liefert bereits 0 / keine Events.

### Bypass-Logik (identisch mit PermissionGuard)

| User-Typ              | Verhalten            | canAccess() return |
| --------------------- | -------------------- | ------------------ |
| Root                  | Alle Counts + Events | `() => true`       |
| Admin + hasFullAccess | Alle Counts + Events | `() => true`       |
| Admin ohne fullAccess | DB-Check             | `readable.has()`   |
| Employee              | DB-Check             | `readable.has()`   |

### DashboardService — Permission-aware Counts

```typescript
// buildFeatureAccessCheck(): Closure über readable Features
private async buildFeatureAccessCheck(user: NestAuthUser): Promise<(code: string) => boolean> {
  if (user.activeRole === 'root') return () => true;
  if (user.activeRole === 'admin' && user.hasFullAccess) return () => true;
  const readable = await this.permissionsService.getReadableFeatureCodes(user.id);
  return (code: string) => readable.has(code);
}

// fetchAllCounts(): Ternary pro Feature — skip oder fetch
canAccess('blackboard') ? this.fetchBlackboardCount(...) : Promise.resolve(EMPTY_COUNT)
canAccess('calendar') ? this.fetchCalendarCount(...) : Promise.resolve(EMPTY_COUNT)
// ... etc. Notifications immer fetched (system-level)
```

### NotificationsController — Permission-filtered SSE

```typescript
// resolveReadableFeatures(): null = bypass, Set = filter
private async resolveReadableFeatures(user: NestAuthUser): Promise<Set<string> | null> {
  if (user.activeRole === 'root') return null;
  if (user.activeRole === 'admin' && user.hasFullAccess) return null;
  return await this.permissionsService.getReadableFeatureCodes(user.id);
}

// registerSSEHandlers(): nur für readable Features
if (canAccess('blackboard')) registerBlackboardHandler(...);
if (canAccess('calendar')) registerCalendarHandler(...);
// ... etc.
```

### Modifizierte Files

| File                                                                 | Änderung                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `backend/src/nest/user-permissions/user-permissions.service.ts`      | `getReadableFeatureCodes()` Methode hinzugefügt                    |
| `backend/src/nest/dashboard/dashboard.service.ts`                    | `buildFeatureAccessCheck()` + `fetchAllCounts()`, permission-aware |
| `backend/src/nest/dashboard/dashboard.module.ts`                     | `UserPermissionsModule` importiert                                 |
| `backend/src/nest/notifications/notifications.controller.ts`         | `resolveReadableFeatures()`, filtered SSE handler registration     |
| `backend/src/nest/notifications/notifications.module.ts`             | `UserPermissionsModule` importiert                                 |
| `backend/src/nest/dashboard/dashboard.service.test.ts`               | 5 neue Tests: Permission-Filterung + Root/Admin Bypass             |
| `backend/src/nest/user-permissions/user-permissions.service.test.ts` | 5 neue Tests: `getReadableFeatureCodes()` Abfragen                 |

### Definition of Done

- [x] `getReadableFeatureCodes()` in UserPermissionsService, via `tenantTransaction()` (ADR-019) ✅
- [x] DashboardService: `getCounts()` skippt Features ohne Permission (count = 0) ✅
- [x] DashboardService: Root + Admin+fullAccess bypass, Employee → DB-Check ✅
- [x] NotificationsController: SSE-Handler nur für readable Features registriert ✅
- [x] NotificationsController: Root + Admin+fullAccess bypass (null = all) ✅
- [x] Notifications immer fetched (system-level, kein Feature-Gate) ✅
- [x] DashboardModule + NotificationsModule importieren UserPermissionsModule ✅
- [x] 5 neue Dashboard-Tests (permission filtering, bypass, no-permission → 0) ✅
- [x] 5 neue UserPermissionsService-Tests (getReadableFeatureCodes) ✅
- [x] ESLint 0 Errors, TypeScript type-check 0 Errors ✅
- [x] Backend startet fehlerfrei nach Restart ✅

---

---

# Plan Teil 2: Vollständige Permission-Definitionen aller Feature-Module

> **Voraussetzung:** Plan Teil 1 Infrastruktur (Phasen 1–5, 7) ist umgesetzt. ✅
> **Status:** ✅ KOMPLETT — 7 Features, 17 Module registriert + enforced (2026-02-07).
> **Zweck:** Alle Feature-Module erhalten ihre Permission-Definitionen (`.permissions.ts` + `.registrar.ts`).
> **Prinzip:** Dezentrales Registry Pattern — jedes Feature besitzt seine Permissions, kein zentrales File.
> **Aufwand:** Pro Feature: 2 neue Files + 1 Zeile in `.module.ts`. Kein Frontend-Change nötig.

## Übersicht: 7 Features, 17 Module

Aktuell registriert (Plan 1): Nur **Blackboard** mit 1 Modul (`blackboard-posts`).
Plan 2 erweitert auf **7 Features** mit insgesamt **17 Modulen**.

---

## 1. Blackboard (code: `blackboard`) — ERWEITERT

> Plan 1 definiert nur `blackboard-posts`. Plan 2 erweitert auf 3 Module.

| Modul-Code            | Label      | Icon             | allowedPermissions           |
| --------------------- | ---------- | ---------------- | ---------------------------- |
| `blackboard-posts`    | Beiträge   | `fa-sticky-note` | canRead, canWrite, canDelete |
| `blackboard-comments` | Kommentare | `fa-comments`    | canRead, canWrite, canDelete |
| `blackboard-archive`  | Archiv     | `fa-archive`     | canRead, canWrite            |

**Bedeutung:**

- Beiträge: R=Beiträge sehen, W=Beiträge erstellen/bearbeiten, D=Beiträge löschen
- Kommentare: R=Kommentare lesen, W=Kommentare schreiben, D=Kommentare löschen
- Archiv: R=Archivierte Beiträge sehen, W=Archivieren/Wiederherstellen

**File:** `backend/src/nest/blackboard/blackboard.permissions.ts` — **AKTUALISIEREN** (existiert aus Plan 1)

---

## 2. Calendar (code: `calendar`)

| Modul-Code        | Label   | Icon              | allowedPermissions           |
| ----------------- | ------- | ----------------- | ---------------------------- |
| `calendar-events` | Termine | `fa-calendar-day` | canRead, canWrite, canDelete |

**Bedeutung:**

- R=Termine sehen, W=Termine erstellen/bearbeiten, D=Termine löschen

**Neue Files:**

- `backend/src/nest/calendar/calendar.permissions.ts`
- `backend/src/nest/calendar/calendar-permission.registrar.ts`

**Modify:** `backend/src/nest/calendar/calendar.module.ts` — `CalendarPermissionRegistrar` zu providers

---

## 3. Documents (code: `documents`)

| Modul-Code          | Label     | Icon          | allowedPermissions           |
| ------------------- | --------- | ------------- | ---------------------------- |
| `documents-files`   | Dokumente | `fa-file-alt` | canRead, canWrite, canDelete |
| `documents-archive` | Archiv    | `fa-archive`  | canRead, canWrite            |

**Bedeutung:**

- Dokumente: R=Ansehen/Herunterladen, W=Hochladen/Bearbeiten, D=Löschen
- Archiv: R=Archivierte sehen, W=Archivieren/Wiederherstellen

**Neue Files:**

- `backend/src/nest/documents/documents.permissions.ts`
- `backend/src/nest/documents/documents-permission.registrar.ts`

**Modify:** `backend/src/nest/documents/documents.module.ts` — `DocumentsPermissionRegistrar` zu providers

---

## 4. Chat (code: `chat`)

| Modul-Code           | Label       | Icon              | allowedPermissions           |
| -------------------- | ----------- | ----------------- | ---------------------------- |
| `chat-conversations` | Gespräche   | `fa-comment-dots` | canRead, canWrite, canDelete |
| `chat-messages`      | Nachrichten | `fa-envelope`     | canRead, canWrite, canDelete |

**Bedeutung:**

- Gespräche: R=Chats sehen, W=Neue Gespräche eröffnen, D=Gespräche löschen
- Nachrichten: R=Nachrichten lesen, W=Nachrichten senden/bearbeiten, D=Nachrichten löschen

**Neue Files:**

- `backend/src/nest/chat/chat.permissions.ts`
- `backend/src/nest/chat/chat-permission.registrar.ts`

**Modify:** `backend/src/nest/chat/chat.module.ts` — `ChatPermissionRegistrar` zu providers

---

## 5. KVP (code: `kvp`)

| Modul-Code        | Label       | Icon           | allowedPermissions           |
| ----------------- | ----------- | -------------- | ---------------------------- |
| `kvp-suggestions` | Vorschläge  | `fa-lightbulb` | canRead, canWrite, canDelete |
| `kvp-comments`    | Kommentare  | `fa-comments`  | canRead, canWrite            |
| `kvp-reviews`     | Bewertungen | `fa-star`      | canRead, canWrite            |

**Bedeutung:**

- Vorschläge: R=Vorschläge sehen, W=Erstellen/Bearbeiten, D=Löschen
- Kommentare: R=Kommentare lesen, W=Kommentare schreiben
- Bewertungen: R=Bewertungen sehen, W=Bewerten

**Neue Files:**

- `backend/src/nest/kvp/kvp.permissions.ts`
- `backend/src/nest/kvp/kvp-permission.registrar.ts`

**Modify:** `backend/src/nest/kvp/kvp.module.ts` — `KvpPermissionRegistrar` zu providers

---

## 6. Shift Planning (code: `shift_planning`)

| Modul-Code       | Label       | Icon              | allowedPermissions           |
| ---------------- | ----------- | ----------------- | ---------------------------- |
| `shift-plan`     | Schichtplan | `fa-calendar-alt` | canRead, canWrite, canDelete |
| `shift-swap`     | Tauschbörse | `fa-exchange-alt` | canRead, canWrite            |
| `shift-rotation` | Rotation    | `fa-sync-alt`     | canRead                      |

**Bedeutung:**

- Schichtplan: R=Schichten sehen, W=Schichten erstellen/bearbeiten, D=Schichten löschen
- Tauschbörse: R=Tausch-Anfragen sehen, W=Tausch beantragen
- Rotation: R=Rotationsmuster einsehen (nur Lesezugriff, Admin verwaltet)

**Neue Files:**

- `backend/src/nest/shifts/shifts.permissions.ts`
- `backend/src/nest/shifts/shifts-permission.registrar.ts`

**Modify:** `backend/src/nest/shifts/shifts.module.ts` — `ShiftsPermissionRegistrar` zu providers

---

## 7. Surveys (code: `surveys`)

| Modul-Code            | Label      | Icon                 | allowedPermissions           |
| --------------------- | ---------- | -------------------- | ---------------------------- |
| `surveys-manage`      | Verwaltung | `fa-poll`            | canRead, canWrite, canDelete |
| `surveys-participate` | Teilnahme  | `fa-clipboard-check` | canRead, canWrite            |
| `surveys-results`     | Ergebnisse | `fa-chart-bar`       | canRead                      |

**Bedeutung:**

- Verwaltung: R=Umfragen sehen, W=Erstellen/Bearbeiten, D=Löschen
- Teilnahme: R=Verfügbare Umfragen sehen, W=Antwort abgeben
- Ergebnisse: R=Ergebnisse/Statistiken einsehen (nur Lesezugriff)

**Neue Files:**

- `backend/src/nest/surveys/surveys.permissions.ts`
- `backend/src/nest/surveys/surveys-permission.registrar.ts`

**Modify:** `backend/src/nest/surveys/surveys.module.ts` — `SurveysPermissionRegistrar` zu providers

---

## Gesamtübersicht: Module pro Feature

| #   | Feature        | Module                              | Gesamt        |
| --- | -------------- | ----------------------------------- | ------------- |
| 1   | Blackboard     | Beiträge, Kommentare, Archiv        | 3             |
| 2   | Calendar       | Termine                             | 1             |
| 3   | Documents      | Dokumente, Archiv                   | 2             |
| 4   | Chat           | Gespräche, Nachrichten              | 2             |
| 5   | KVP            | Vorschläge, Kommentare, Bewertungen | 3             |
| 6   | Shift Planning | Schichtplan, Tauschbörse, Rotation  | 3             |
| 7   | Surveys        | Verwaltung, Teilnahme, Ergebnisse   | 3             |
|     | **TOTAL**      |                                     | **17 Module** |

---

## File Summary — Plan Teil 2

### Neue Files (12)

1. `backend/src/nest/calendar/calendar.permissions.ts`
2. `backend/src/nest/calendar/calendar-permission.registrar.ts`
3. `backend/src/nest/documents/documents.permissions.ts`
4. `backend/src/nest/documents/documents-permission.registrar.ts`
5. `backend/src/nest/chat/chat.permissions.ts`
6. `backend/src/nest/chat/chat-permission.registrar.ts`
7. `backend/src/nest/kvp/kvp.permissions.ts`
8. `backend/src/nest/kvp/kvp-permission.registrar.ts`
9. `backend/src/nest/shifts/shifts.permissions.ts`
10. `backend/src/nest/shifts/shifts-permission.registrar.ts`
11. `backend/src/nest/surveys/surveys.permissions.ts`
12. `backend/src/nest/surveys/surveys-permission.registrar.ts`

### Modifizierte Files (16)

**Permission Definitions:**

1. `backend/src/nest/blackboard/blackboard.permissions.ts` — erweitert um Kommentare + Archiv

**Module Registrations:**

2. `backend/src/nest/calendar/calendar.module.ts` — CalendarPermissionRegistrar zu providers
3. `backend/src/nest/documents/documents.module.ts` — DocumentsPermissionRegistrar zu providers
4. `backend/src/nest/chat/chat.module.ts` — ChatPermissionRegistrar zu providers
5. `backend/src/nest/kvp/kvp.module.ts` — KvpPermissionRegistrar zu providers
6. `backend/src/nest/shifts/shifts.module.ts` — ShiftsPermissionRegistrar zu providers
7. `backend/src/nest/surveys/surveys.module.ts` — SurveysPermissionRegistrar zu providers

**Controller Enforcement (`@RequirePermission` auf alle Endpoints):**

8. `backend/src/nest/blackboard/blackboard.controller.ts` — erweitert: BB_POSTS + BB_COMMENTS + BB_ARCHIVE
9. `backend/src/nest/calendar/calendar.controller.ts` — 12 Endpoints mit CAL_EVENTS
10. `backend/src/nest/documents/documents.controller.ts` — 22 Endpoints mit DOC_FILES + DOC_ARCHIVE
11. `backend/src/nest/chat/chat.controller.ts` — 26 Endpoints mit CHAT_CONV + CHAT_MSG
12. `backend/src/nest/kvp/kvp.controller.ts` — 24 Endpoints mit KVP_SUGGESTIONS + KVP_COMMENTS
13. `backend/src/nest/shifts/shifts.controller.ts` — 22 Endpoints mit SHIFT_PLAN + SHIFT_SWAP
14. `backend/src/nest/surveys/surveys.controller.ts` — 14 Endpoints mit SURVEY_MANAGE + SURVEY_PARTICIPATE + SURVEY_RESULTS
15. `backend/src/nest/shifts/rotation.controller.ts` — 4 GET Endpoints mit SHIFT_ROTATION (canRead only)

---

## Definition of Done — Plan Teil 2

**Status: ✅ KOMPLETT — Alle 7 Features mit 17 Modulen registriert + enforced (2026-02-07)**

### Registration (Registry + DB)

- [x] Blackboard erweitert: 3 Module (Beiträge, Kommentare, Archiv) registriert ✅
- [x] Calendar: 1 Modul (Termine) registriert via OnModuleInit ✅
- [x] Documents: 2 Module (Dokumente, Archiv) registriert via OnModuleInit ✅
- [x] Chat: 2 Module (Gespräche, Nachrichten) registriert via OnModuleInit ✅
- [x] KVP: 3 Module (Vorschläge, Kommentare, Bewertungen) registriert via OnModuleInit ✅
- [x] Shift Planning: 3 Module (Schichtplan, Tauschbörse, Rotation) registriert via OnModuleInit ✅
- [x] Surveys: 3 Module (Verwaltung, Teilnahme, Ergebnisse) registriert via OnModuleInit ✅
- [x] `PermissionRegistryService.getAll()` gibt alle 7 Features mit 17 Modulen zurück ✅

### Enforcement (`@RequirePermission` auf Controller-Endpoints)

- [x] Blackboard Controller: `@RequirePermission` auf alle Endpoints (BB_POSTS + BB_COMMENTS + BB_ARCHIVE) ✅
- [x] Calendar Controller: `@RequirePermission` auf alle 12 Endpoints (CAL_EVENTS) ✅
- [x] Documents Controller: `@RequirePermission` auf alle 22 Endpoints (DOC_FILES + DOC_ARCHIVE) ✅
- [x] Chat Controller: `@RequirePermission` auf alle 26 Endpoints (CHAT_CONV + CHAT_MSG) ✅
- [x] KVP Controller: `@RequirePermission` auf alle 24 Endpoints (KVP_SUGGESTIONS + KVP_COMMENTS) ✅
- [x] Shifts Controller: `@RequirePermission` auf alle 22 Endpoints (SHIFT_PLAN + SHIFT_SWAP) ✅
- [x] Surveys Controller: `@RequirePermission` auf alle 14 Endpoints (SURVEY_MANAGE + SURVEY_PARTICIPATE + SURVEY_RESULTS) ✅
- [x] Rotation Controller: `@RequirePermission` auf 4 GET Endpoints (SHIFT_ROTATION canRead only) ✅
- [x] Konstanten-Pattern: `const FEATURE = '...'`, `const MODULE = '...'` pro Controller (sonarjs compliant) ✅

### Verifikation

- [x] GET `/user-permissions/:uuid` zeigt alle 17 Module in der UI (gefiltert nach Tenant-Features) ✅
- [ ] Jedes Modul zeigt NUR seine `allowedPermissions`-Checkboxes (z.B. Rotation nur canRead)
- [x] `feature_code` matcht exakt mit `features.code` aus Seed-Daten ✅
- [x] Alle 7 `.module.ts` Files enthalten den Registrar als Provider ✅
- [x] Backend startet fehlerfrei (kein doppelter `register()` Call) ✅
- [x] ESLint 0 Errors, Type-Check 0 Errors ✅
- [ ] Frontend zeigt Permission-Tree mit allen 7 Kategorien + 17 Modulen korrekt an
- [ ] Enforcement-Test: User ohne Permission → 403 Forbidden auf jedem Feature-Controller
