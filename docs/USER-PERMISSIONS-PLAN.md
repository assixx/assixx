# User Feature Permissions — Implementation Plan

## Overview

Bottom-Up implementation: **DB → Backend → Frontend**
Per-user, per-feature/module permission control (canRead, canWrite, canDelete).

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

blackboard/
  ├── blackboard.permissions.ts         ← const BLACKBOARD_PERMISSIONS
  └── blackboard-permission.registrar.ts ← OnModuleInit → register()

calendar/
  ├── calendar.permissions.ts           ← const CALENDAR_PERMISSIONS
  └── calendar-permission.registrar.ts  ← OnModuleInit → register()

user-permissions/
  ├── user-permissions.service.ts       ← Injects PermissionRegistry, kennt KEINE Features
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

| ADR                                  | Relevant für                                                                |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `ADR-005` Custom JWT Guard           | Phase 5: `@CurrentUser()`, `@TenantId()` Decorators                         |
| `ADR-006` ClsService Tenant Context  | Phase 4: Tenant-Isolation, CLS → `tenantTransaction()`                      |
| `ADR-007` ResponseInterceptor        | Phase 5: Controller gibt Raw-Data zurück, KEIN `{ success, data }` wrapping |
| `ADR-012` Fail-Closed RBAC           | Phase 5: `@Roles('admin')` Guard                                            |
| `ADR-014` node-pg-migrate            | Phase 1: Migration-Runner, `up`/`down` Pattern                              |
| `ADR-018` Vitest Single Runner       | Phase 6+8: `--project unit` vs `--project api`                              |
| `ADR-019` Multi-Tenant RLS Isolation | Phase 1+4: RLS-Policy, `tenantTransaction()`, Dual-User-Model               |

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

**Warum funktioniert das automatisch?**

1. **Registry:** `KvpPermissionRegistrar.onModuleInit()` registriert die Permissions beim Start
2. **DB:** `feature_code` + `module_code` sind VARCHAR-Strings — keine FK, neue Codes = neue Rows
3. **GET Endpoint:** Fragt `PermissionRegistryService.getAll()` → bekommt alle registrierten Kategorien
4. **PUT Endpoint:** Validiert gegen Registry → neue Kategorie wird akzeptiert
5. **Frontend:** Rendert dynamisch aus SSR-Daten — keine Hardcoded UI

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

- [ ] Migration runs without errors (`up` + `down`)
- [ ] RLS policy `tenant_isolation` existiert auf `user_feature_permissions`
- [ ] `FORCE ROW LEVEL SECURITY` aktiv (auch Table Owner gefiltert)
- [ ] GRANTs für `app_user` gesetzt (SELECT, INSERT, UPDATE, DELETE + Sequence)
- [ ] Table visible in `\dt`
- [ ] Unique constraint prevents duplicate (tenant_id, user_id, feature_code, module_code)
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

- [ ] PermissionRegistryService ist @Injectable() Singleton
- [ ] register() wirft Error bei doppelter Registrierung (fail-fast)
- [ ] getAll(), getByCode(), isValidModule(), getAllowedPermissions() funktionieren
- [ ] @Global() Modul in app.module.ts registriert
- [ ] Kein Feature-spezifisches Wissen im Registry

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

- [ ] Blackboard-Permissions registriert sich via OnModuleInit
- [ ] blackboard.module.ts enthält BlackboardPermissionRegistrar als Provider
- [ ] Zod DTO validiert Struktur (Typen, Non-Empty Strings, Booleans)
- [ ] DTO barrel export via index.ts
- [ ] Kein Feature-spezifisches Wissen im DTO

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

### Drei Methoden:

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

3. **`getActiveFeaturesForTenant(tenantId)`** — (private helper, innerhalb der Transaction)
   - `SELECT feature_code FROM tenant_features WHERE is_active = 1` (RLS filtert tenant)
   - Returns `Set<string>` for O(1) lookup

Uses: `DatabaseService.tenantTransaction()`, `PermissionRegistryService`, `Logger`, `NotFoundException`, `BadRequestException`.

**Definition of Done:**

- [ ] Alle DB-Zugriffe via `tenantTransaction()` (NICHT `db.query()`)
- [ ] RLS GUC wird gesetzt via `set_config('app.tenant_id', ...)` (automatisch durch `tenantTransaction`)
- [ ] getPermissions returns full category tree filtered by tenant's active features
- [ ] upsertPermissions uses UPSERT (INSERT ON CONFLICT UPDATE)
- [ ] Validierung gegen PermissionRegistryService (nicht gegen hardcoded Constants)
- [ ] Non-allowed permission types forced to `false` on save
- [ ] NotFoundException if UUID doesn't resolve
- [ ] BadRequestException if featureCode/moduleCode unknown

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
- `@Roles('admin')` on class level (only admins manage user permissions)
- `@CurrentUser()` for assignedBy
- `@TenantId()` for tenant context
- UUID param validated as string (UUIDv7 format)
- PUT body validated with `UpsertUserPermissionsDto`
- Returns raw data — ResponseInterceptor wraps automatically (ADR-007, NO double-wrapping)

### Module

- Imports: DatabaseModule
- Providers: UserPermissionsService
- Controllers: UserPermissionsController

### Registration

- Modify `backend/src/nest/app.module.ts`: add import + register UserPermissionsModule

**Definition of Done:**

- [ ] GET endpoint returns permission tree for user
- [ ] PUT endpoint saves permissions via UPSERT
- [ ] @Roles('admin') protects both endpoints
- [ ] Module registered in AppModule
- [ ] No double-wrapping (controller returns raw, interceptor wraps)

---

## Phase 6: Backend Unit Tests

> **Ausgelagert in separaten Plan:** [`docs/USER-PERMISSIONS-UNIT-TEST-PLAN.md`](./USER-PERMISSIONS-UNIT-TEST-PLAN.md)
>
> Der Unit-Test-Plan definiert **66 gründliche Tests** in 3 Dateien:
>
> - `permission-registry.service.test.ts` (20 Tests)
> - `user-permissions.dto.test.ts` (18 Tests)
> - `user-permissions.service.test.ts` (28 Tests)
>
> **Umsetzen wenn Phasen 1–5 fertig.**

**Definition of Done:**

- [ ] Alle 66 Unit Tests grün: `vitest run --project unit`
- [ ] Siehe [`USER-PERMISSIONS-UNIT-TEST-PLAN.md`](./USER-PERMISSIONS-UNIT-TEST-PLAN.md) für vollständige DoD

---

## Phase 7: Frontend Integration

**Quellen:** `docs/CODE-OF-CONDUCT-SVELTE.md`, Svelte 5 Runes (`$state`, `$derived`, `$props`)
**Files to modify:**

- `frontend/src/routes/(app)/(admin)/manage-employees/permission/[uuid]/+page.server.ts`
- `frontend/src/routes/(app)/(admin)/manage-employees/permission/[uuid]/+page.svelte`

### +page.server.ts Changes

- Add second fetch: `GET /api/v2/user-permissions/${uuid}`
- Return `{ employee, permissions, error }` where permissions = full category tree from API

### +page.svelte Changes

- Replace hardcoded `categories` $state with SSR data from `data.permissions`
- Add `isSaving` state and `savePermissions()` function
- Add "Speichern" (Save) button that calls `PUT /api/v2/user-permissions/${uuid}`
- Add loading/error states for save operation
- Keep existing toast notifications on toggle (immediate feedback)
- Save button sends current state to backend (batch save, not per-toggle)

**Definition of Done:**

- [ ] Permission categories loaded from API (not hardcoded)
- [ ] Save button persists permissions to DB
- [ ] Saved permissions survive page reload
- [ ] Error handling for API failures
- [ ] Loading state during save

---

## Phase 8: API Integration Test

**Quellen:** `ADR-018` (Vitest), `docs/HOW-TO-TEST-WITH-VITEST.md`
**File:** `api-tests/vitest/user-permissions.api.test.ts`

- GET returns default permissions (all false) for new user
- GET only returns categories for tenant's active features
- PUT saves permissions, GET returns saved values
- PUT with unknown featureCode returns 400
- PUT with invalid body returns 400
- GET with non-existent UUID returns 404
- Non-admin role gets 403

**Definition of Done:**

- [ ] All 7 test scenarios pass
- [ ] Tests run: `vitest run --project api`

---

## File Summary

### New Files (14)

1. `database/migrations/20260207000019_user-feature-permissions.ts`
2. `backend/src/nest/common/permission-registry/permission.types.ts`
3. `backend/src/nest/common/permission-registry/permission-registry.service.ts`
4. `backend/src/nest/common/permission-registry/permission-registry.module.ts`
5. `backend/src/nest/common/permission-registry/permission-registry.service.test.ts`
6. `backend/src/nest/blackboard/blackboard.permissions.ts`
7. `backend/src/nest/blackboard/blackboard-permission.registrar.ts`
8. `backend/src/nest/user-permissions/user-permissions.service.ts`
9. `backend/src/nest/user-permissions/user-permissions.controller.ts`
10. `backend/src/nest/user-permissions/user-permissions.module.ts`
11. `backend/src/nest/user-permissions/dto/upsert-user-permissions.dto.ts`
12. `backend/src/nest/user-permissions/dto/index.ts`
13. `backend/src/nest/user-permissions/user-permissions.service.test.ts`
14. `api-tests/vitest/user-permissions.api.test.ts`

### Modified Files (3)

1. `backend/src/nest/app.module.ts` — add PermissionRegistryModule + UserPermissionsModule imports
2. `frontend/.../permission/[uuid]/+page.server.ts` — fetch permissions from API
3. `frontend/.../permission/[uuid]/+page.svelte` — SSR data + Save button

### Modified Files (Feature-Module, nur Provider hinzufügen)

1. `backend/src/nest/blackboard/blackboard.module.ts` — add BlackboardPermissionRegistrar to providers

---

## Execution Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8

Each phase is self-contained and testable before moving to the next.

---

## Definition of Done — Gesamtes Feature

- [ ] Migration läuft fehlerfrei, Tabelle + RLS + FORCE + Policy + GRANTs + Index existieren
- [ ] RLS Cross-Tenant-Test bestanden (Tenant 1 sieht keine Tenant 2 Daten)
- [ ] PermissionRegistryModule ist @Global() Singleton, register()/getAll() funktionieren
- [ ] Blackboard registriert seine Permissions via OnModuleInit
- [ ] Zod DTO validiert Struktur, Service validiert gegen Registry
- [ ] Service nutzt `tenantTransaction()` für ALLE DB-Zugriffe (ADR-019)
- [ ] GET Endpoint: gibt Permissions-Tree zurück, gefiltert nach Tenant-Features
- [ ] PUT Endpoint: speichert Permissions per UPSERT, erzwingt allowedPermissions
- [ ] Unit Tests grün (Registry + DTO + Service)
- [ ] API Integration Tests grün (7 Szenarien)
- [ ] Frontend lädt Permissions aus API, Save-Button persistiert in DB
- [ ] Permissions überleben Page-Reload
- [ ] Erweiterbarkeit: neue Kategorie = 2 Files im Feature-Modul, kein zentrales File
- [ ] ESLint 0 Errors, Type-Check 0 Errors

---

---

# Plan Teil 2: Vollständige Permission-Definitionen aller Feature-Module

> **Voraussetzung:** Plan Teil 1 (Phasen 1–8) ist vollständig umgesetzt.
> **Zweck:** Alle Feature-Module erhalten ihre Permission-Definitionen (`.permissions.ts` + `.registrar.ts`).
> **Prinzip:** Dezentrales Registry Pattern — jedes Feature besitzt seine Permissions, kein zentrales File.

## Übersicht: 7 Features, 18 Module

Aktuell registriert (Plan 1): Nur **Blackboard** mit 1 Modul.
Plan 2 erweitert auf **7 Features** mit insgesamt **18 Modulen**.

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
|     | **TOTAL**      |                                     | **18 Module** |

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

### Modifizierte Files (7)

1. `backend/src/nest/blackboard/blackboard.permissions.ts` — erweitert um Kommentare + Archiv
2. `backend/src/nest/calendar/calendar.module.ts` — CalendarPermissionRegistrar zu providers
3. `backend/src/nest/documents/documents.module.ts` — DocumentsPermissionRegistrar zu providers
4. `backend/src/nest/chat/chat.module.ts` — ChatPermissionRegistrar zu providers
5. `backend/src/nest/kvp/kvp.module.ts` — KvpPermissionRegistrar zu providers
6. `backend/src/nest/shifts/shifts.module.ts` — ShiftsPermissionRegistrar zu providers
7. `backend/src/nest/surveys/surveys.module.ts` — SurveysPermissionRegistrar zu providers

---

## Definition of Done — Plan Teil 2

- [ ] Blackboard erweitert: 3 Module (Beiträge, Kommentare, Archiv) registriert
- [ ] Calendar: 1 Modul (Termine) registriert via OnModuleInit
- [ ] Documents: 2 Module (Dokumente, Archiv) registriert via OnModuleInit
- [ ] Chat: 2 Module (Gespräche, Nachrichten) registriert via OnModuleInit
- [ ] KVP: 3 Module (Vorschläge, Kommentare, Bewertungen) registriert via OnModuleInit
- [ ] Shift Planning: 3 Module (Schichtplan, Tauschbörse, Rotation) registriert via OnModuleInit
- [ ] Surveys: 3 Module (Verwaltung, Teilnahme, Ergebnisse) registriert via OnModuleInit
- [ ] `PermissionRegistryService.getAll()` gibt alle 7 Features mit 18 Modulen zurück
- [ ] GET `/user-permissions/:uuid` zeigt alle 18 Module in der UI (gefiltert nach Tenant-Features)
- [ ] Jedes Modul zeigt NUR seine `allowedPermissions`-Checkboxes (z.B. Rotation nur canRead)
- [ ] `feature_code` matcht exakt mit `features.code` aus Seed-Daten
- [ ] Alle 7 `.module.ts` Files enthalten den Registrar als Provider
- [ ] Backend startet fehlerfrei (kein doppelter `register()` Call)
- [ ] ESLint 0 Errors, Type-Check 0 Errors
- [ ] Frontend zeigt Permission-Tree mit allen 7 Kategorien + 18 Modulen korrekt an
