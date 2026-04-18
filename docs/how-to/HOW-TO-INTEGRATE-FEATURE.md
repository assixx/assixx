# HOW-TO-INTEGRATE-FEATURE.md

> Checkliste für die vollständige Integration eines neuen Features in das Assixx-Ökosystem.
> Referenz-Implementation: **Vacation Module** (`backend/src/nest/vacation/`, `frontend/src/routes/(app)/**/vacation/`)

---

## Definition of Done

Ein Feature ist **DONE** wenn alle zutreffenden Checkboxen abgehakt sind.
Nicht jedes Feature braucht alles — z.B. braucht ein reines Admin-Feature keine Employee-Routes.
Aber: **Nichts vergessen ist besser als nachträglich flicken.**

---

## 1. DATABASE

### 1.1 Addon Registration

- [ ] Migration: `INSERT INTO addons (code, name, description, is_core, base_price, sort_order)`
- [ ] Core oder kaufbar? `is_core = true` (immer aktiv) oder `is_core = false` (à la carte)

> **Ref:** `database/migrations/20260212000027_vacation-feature-flag.ts`

### 1.2 Core Tables

- [ ] Migration mit `pgm.sql()` (raw SQL nötig für RLS, Triggers, GRANTs)
- [ ] Jede Tabelle hat:
  - `id UUID PRIMARY KEY` (UUIDv7, application-generated)
  - `tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE`
  - `is_active INTEGER NOT NULL DEFAULT 1` (0=inaktiv, 1=aktiv, 3=archiv, 4=gelöscht)
  - `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- [ ] RLS aktiviert + erzwungen:

```sql
ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
ALTER TABLE my_table FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON my_table
  USING (NULLIF(current_setting('app.tenant_id', true), '') IS NULL
         OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);
```

- [ ] GRANTs für `app_user`:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON my_table TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
```

- [ ] Sinnvolle Indexes (tenant_id, FK-Spalten, häufige WHERE-Bedingungen)
- [ ] CHECK Constraints für Business Rules direkt in der DB
- [ ] `down()` Migration implementiert (Rollback)

> **Ref:** `database/migrations/20260212000029_vacation-core-tables.ts`
> **Guide:** `docs/DATABASE-MIGRATION-GUIDE.md`

### 1.3 Nach Migration

- [ ] `doppler run -- ./scripts/run-migrations.sh up --dry-run` erfolgreich
- [ ] Backup erstellt vor Ausführung
- [ ] `doppler run -- ./scripts/sync-customer-migrations.sh` ausgeführt

---

## 2. BACKEND MODULE

### 2.1 Modul-Struktur

```
backend/src/nest/<feature>/
├── <feature>.module.ts
├── <feature>.controller.ts
├── <feature>.service.ts              # Core Mutations
├── <feature>-queries.service.ts      # Read-only Queries (optional, bei Komplexität)
├── <feature>.types.ts                # DB-Row + API Types
├── <feature>.permissions.ts          # ADR-020 Permission Definition
├── <feature>-permission.registrar.ts # Auto-Registration
├── <feature>-notification.service.ts # SSE + Persistent Notifications (optional)
├── dto/
│   ├── common.dto.ts                 # Shared Zod Schemas
│   ├── create-<feature>.dto.ts
│   ├── update-<feature>.dto.ts
│   └── index.ts                      # Barrel Export
└── __tests__/ oder *.test.ts
```

### 2.2 Module Registration

- [ ] `<feature>.module.ts` erstellt:

```typescript
@Module({
  imports: [FeatureCheckModule],
  controllers: [FeatureController],
  providers: [
    FeaturePermissionRegistrar,
    // Services in Dependency-Reihenfolge
    FeatureService,
    FeatureQueriesService,
  ],
  exports: [FeatureService, FeatureQueriesService],
})
export class FeatureModule {}
```

- [ ] In `app.module.ts` importiert (`imports: [..., FeatureModule]`)

> **Ref:** `backend/src/nest/vacation/vacation.module.ts`, `backend/src/nest/app.module.ts` (Zeile ~173)

### 2.3 Controller

- [ ] Class-Level Guards: `@UseGuards(JwtAuthGuard, RolesGuard)`
- [ ] Pro Endpoint: `@RequirePermission(FEAT, MODULE, 'canRead' | 'canWrite' | 'canDelete')`
- [ ] Rolleneinschränkung wo nötig: `@Roles('admin', 'root')`
- [ ] Addon-Gate in **jedem** Endpoint:

```typescript
private async ensureAddonEnabled(tenantId: number): Promise<void> {
  const isEnabled = await this.addonCheck.checkTenantAccess(tenantId, ADDON_CODE);
  if (!isEnabled) {
    throw new ForbiddenException('Addon is not enabled for this tenant');
  }
}
```

- [ ] Daten direkt zurückgeben — **NICHT** manuell wrappen (`ResponseInterceptor` macht das)
- [ ] `@HttpCode()` korrekt gesetzt (201 für POST, 204 für DELETE/Withdraw)
- [ ] Parametrisierte Routes **nach** statischen Routes (`:id` nach `/incoming`)
- [ ] **Wenn der Endpoint einen User anlegt** (`INSERT INTO users`): Service-Methode MUSS `await this.tenantVerification.assertVerified(tenantId)` als ersten Aufruf im AST-enclosing Helper haben (ADR-049 KISS-Gate). Sonst CI-Fail durch `shared/src/architectural.test.ts`. Allowlist-Erweiterung nur im SELBEN PR + ADR-Update wenn der neue Bootstrap-Pfad den ersten User für einen Tenant erstellt (vor jeder `tenant_domains`-Zeile).

> **Ref:** `backend/src/nest/vacation/vacation.controller.ts`, `backend/src/nest/users/users.service.ts:insertUserRecord` (ADR-049 KISS-Gate-Beispiel)

### 2.4 DTOs mit Zod

- [ ] Jeder Endpoint hat ein DTO mit Zod-Schema
- [ ] DTO-Klasse: `export class CreateFeatureDto extends createZodDto(CreateFeatureSchema) {}`
- [ ] Shared Schemas in `dto/common.dto.ts` extrahiert
- [ ] Cross-Field Validation via `.refine()`
- [ ] Barrel Export in `dto/index.ts`
- [ ] HTTP-Params: `z.coerce.number()` für numerische Query/Path-Parameter

> **Ref:** `backend/src/nest/vacation/dto/create-vacation-request.dto.ts`
> **Guide:** `backend/docs/ZOD-INTEGRATION-GUIDE.md`

### 2.5 Types

- [ ] DB-Row Types (snake_case, 1:1 Tabelle): `interface FeatureRow { tenant_id: number; ... }`
- [ ] API Types (camelCase, Response-Shape): `interface Feature { tenantId: number; ... }`
- [ ] Enums als String Unions: `type FeatureStatus = 'active' | 'archived';`
- [ ] `mapRowToFeature()` Mapping-Funktion

> **Ref:** `backend/src/nest/vacation/vacation.types.ts`

### 2.6 Permissions (ADR-020)

- [ ] `<feature>.permissions.ts`:

```typescript
export const FEATURE_PERMISSIONS: PermissionCategoryDef = {
  code: 'feature-code', // MUSS addons.code in DB matchen
  label: 'Feature Name',
  icon: 'fa-icon-name',
  modules: [
    {
      code: 'module-code',
      label: 'Modul Name',
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

- [ ] Registrar als Provider im Module deklariert

> **Ref:** `backend/src/nest/vacation/vacation.permissions.ts`, `vacation-permission.registrar.ts`

### 2.7 Activity Logging (Root Dashboard)

- [ ] `ActivityLoggerService` injiziert
- [ ] Nach jeder Mutation aufgerufen (fire-and-forget mit `void`):

```typescript
void this.activityLogger.logCreate(tenantId, userId, 'feature-entity', entityId, `Feature erstellt: ${name}`, {
  relevantFields,
});
```

- [ ] `entityType` zum `ActivityEntityType` Union hinzugefügt falls neu

> **Ref:** `backend/src/nest/common/services/activity-logger.service.ts`
> **Audit Trail** (`audit_trail` Tabelle) ist automatisch via Global Interceptor — kein manueller Code nötig.

### 2.8 Notifications (optional, wenn User benachrichtigt werden soll)

- [ ] `<feature>-notification.service.ts` erstellt
- [ ] **SSE (real-time):** Event in `utils/eventBus.ts` hinzufügen:

```typescript
// In eventBus.ts:
emitFeatureEvent(tenantId: number, payload: FeaturePayload): void {
  this.emit('feature.created', { tenantId, ...payload });
}
```

- [ ] **Persistent (Badge Counts):** Via `NotificationsService.createAddonNotification()`
- [ ] Frontend Notification Store: SSE Event Mapping in `notification.store.svelte.ts`:

```typescript
// In SSE_EVENT_TO_COUNT Map:
['NEW_FEATURE_EVENT', 'featureType'],
```

- [ ] `NotificationCounts` Interface erweitern (neuen Counter hinzufügen)

> **Ref:** `backend/src/nest/vacation/vacation-notification.service.ts`, `utils/eventBus.ts`
> **Ref Frontend:** `frontend/src/lib/stores/notification.store.svelte.ts`

### 2.9 Service Patterns

- [ ] Mutations via `this.db.tenantTransaction()` (Tenant-Isolation)
- [ ] `FOR UPDATE` Lock bei Status-Transitions (Race Conditions verhindern)
- [ ] UUIDv7: `import { v7 as uuidv7 } from 'uuid';`
- [ ] Notification-Calls **nach** Transaction-Commit (nicht innerhalb)
- [ ] Parametrisierte Queries: `$1, $2, $3` — **NIEMALS** String-Concatenation

---

## 3. FRONTEND

### 3.1 Route-Struktur (ADR-012)

- [ ] Richtige Route Group gewählt:

| Gruppe     | Pfad                                            | Zugriff                     |
| ---------- | ----------------------------------------------- | --------------------------- |
| `(root)`   | `frontend/src/routes/(app)/(root)/<feature>/`   | Nur Root                    |
| `(admin)`  | `frontend/src/routes/(app)/(admin)/<feature>/`  | Admin + Root                |
| `(shared)` | `frontend/src/routes/(app)/(shared)/<feature>/` | Alle authentifizierten User |

- [ ] Neuer Ordner in der richtigen Gruppe erstellt
- [ ] **Kein** eigener Guard nötig — Layout Guards der Gruppe schützen automatisch

> **Ref:** `frontend/src/routes/(app)/(root)/+layout.server.ts` (role check)

### 3.2 SSR Data Loading (`+page.server.ts`)

- [ ] `import { apiFetch } from '$lib/server/api-fetch'` — **keine lokale Kopie!**
- [ ] Auth-Check: `cookies.get('accessToken')` → redirect wenn fehlt
- [ ] `await parent()` für User-Daten aus Parent-Layout
- [ ] Parallele API-Calls mit `Promise.all()`:

```typescript
import { apiFetch } from '$lib/server/api-fetch';

const [items, stats] = await Promise.all([
  apiFetch<PaginatedResult<Item>>('/feature/items?page=1&limit=20', token, fetch),
  apiFetch<FeatureStats>('/feature/stats', token, fetch),
]);
```

- [ ] Fallback für fehlgeschlagene Calls (leere Defaults, nicht crashen)

> **Ref:** `frontend/src/routes/(app)/(shared)/vacation/+page.server.ts`
> **Shared Utility:** `frontend/src/lib/server/api-fetch.ts` (auth headers, envelope unwrapping, error logging)

### 3.3 Page Component (`+page.svelte`)

- [ ] Svelte 5 Runes: `$props()`, `$derived()`, `$state()`, `$effect()`
- [ ] SSR-Daten via `$effect()` in State-Store synchronisieren
- [ ] `invalidateAll()` nach Mutations (triggert SSR-Reload)
- [ ] Sub-Components in `_lib/` Ordner auslagern

> **Ref:** `frontend/src/routes/(app)/(shared)/vacation/+page.svelte`

### 3.4 `_lib/` Ordner (Collocated Module Files)

- [ ] `types.ts` — Frontend-eigene Interfaces (Mirror der Backend-API-Types)
- [ ] `api.ts` — Typisierte API-Funktionen via `getApiClient()`
- [ ] `state.svelte.ts` — Facade für `state-data.svelte.ts` + `state-ui.svelte.ts`
- [ ] `state-data.svelte.ts` — `$state` Runes für Daten
- [ ] `state-ui.svelte.ts` — `$state` Runes für UI (Modals, Filter, Tabs, Loading)
- [ ] `constants.ts` — Labels, Badge-Klassen, Filter-Optionen
- [ ] `*.svelte` — Sub-Components (Cards, Forms, Indicators)

> **Ref:** `frontend/src/routes/(app)/(shared)/vacation/_lib/`

### 3.5 Sidebar Navigation

- [ ] Datei: `frontend/src/routes/(app)/_lib/navigation-config.ts`
- [ ] NavItem zu **allen relevanten Rollen-Arrays** hinzufügen:
  - `rootMenuItems` (Root sieht alles)
  - `adminMenuItems` (Admin-relevante Items)
  - `employeeMenuItems` (Employee-relevante Items)
- [ ] Icon aus `ICONS` Record wählen (oder neues hinzufügen)
- [ ] Bei Submenu: Shared Submenu-Konstante extrahieren wenn mehrere Rollen es brauchen
- [ ] `badgeType` setzen wenn Notification-Badge gewünscht (muss in `NotificationCounts` existieren)
- [ ] `filterMenuByAccess()` anpassen falls Feature-spezifische Zugangskontrolle nötig

```typescript
// Beispiel NavItem:
{
  id: 'feature-name',
  icon: ICONS.iconName,
  label: 'Feature Label',
  url: '/feature',                          // Direkt-Link
  badgeType: 'featureType',                 // Optional: Notification Badge
  submenu: [                                // Optional: Untermenü
    { id: 'feature-list', icon: ICONS.list, label: 'Übersicht', url: '/feature' },
    { id: 'feature-admin', icon: ICONS.cog, label: 'Einstellungen', url: '/feature/settings' },
  ],
}
```

> **Ref:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

### 3.6 Breadcrumb

- [ ] Datei: `frontend/src/lib/components/Breadcrumb.svelte`
- [ ] **Statische Route:** Eintrag in `urlMappings` hinzufügen:

```typescript
'/feature': { label: 'Feature Name', icon: 'fa-icon' },
'/feature/settings': { label: 'Einstellungen', icon: 'fa-cog' },
```

- [ ] **Dynamische Route** (mit Parameter): Eintrag in `dynamicRoutes`:

```typescript
{ pattern: /^\/feature\/[^/]+$/, label: 'Feature Details', icon: 'fa-info-circle' },
```

- [ ] **Parent-Breadcrumb** (Zwischenschritt): Eintrag in `intermediateBreadcrumbs`:

```typescript
'/feature/settings': { label: 'Feature Name', url: '/feature', icon: 'fa-icon' },
```

- [ ] Fullscreen-Pages (z.B. Chat-ähnlich) in `fullscreenPages` Array aufnehmen

> **Ref:** `frontend/src/lib/components/Breadcrumb.svelte` (urlMappings ab Zeile ~42)

---

## 4. TESTING

### 4.1 Unit Tests (Services)

- [ ] Pro Service mindestens eine `*.test.ts` Datei
- [ ] Mock-Factory Pattern:

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

- [ ] Happy Path + Edge Cases + Error Cases getestet
- [ ] `mockResolvedValueOnce()` Chains für sequenzielle DB-Queries

> **Ref:** `backend/src/nest/kvp/kvp.service.test.ts`

### 4.2 Permission Tests

- [ ] Guard-Verhalten für alle Rollen getestet (root, admin, employee)
- [ ] Unauthenticated → 403
- [ ] Root Bypass verifiziert
- [ ] Admin `hasFullAccess` Bypass verifiziert
- [ ] Employee DB-Permission-Check verifiziert

> **Ref:** `backend/src/nest/common/guards/permission.guard.test.ts`

### 4.3 API Integration Tests

- [ ] Datei: `backend/test/<feature>.api.test.ts`
- [ ] Pattern:

```typescript
let auth: AuthState;
beforeAll(async () => {
  auth = await loginApitest();
});

describe('Unauthenticated → 401', () => {
  /* ohne Token */
});
describe('Create', () => {
  /* POST mit authHeaders(token) */
});
describe('Read', () => {
  /* GET mit authOnly(token) */
});
describe('Update', () => {
  /* PUT mit authHeaders(token) */
});
describe('Delete/Cleanup', () => {
  /* DELETE mit authOnly(token) */
});
```

- [ ] **KRITISCH:** `authHeaders(token)` für Requests MIT Body, `authOnly(token)` für Requests OHNE Body (Fastify!)
- [ ] Cleanup am Ende (erstellte Testdaten aufräumen)

> **Ref:** `backend/test/vacation.api.test.ts`, `backend/test/helpers.ts`
> **Guide:** `docs/how-to/HOW-TO-TEST-WITH-VITEST.md`

---

## 5. DOKUMENTATION

- [ ] `docs/FEATURES.md` — Feature mit Preis und Beschreibung hinzufügen
- [ ] `docs/PROJEKTSTRUKTUR.md` — Neue Verzeichnisse dokumentieren
- [ ] `TODO.md` — Feature-Status aktualisieren
- [ ] `docs/DAILY-PROGRESS.md` — Fortschritt dokumentieren
- [ ] ADR erstellen falls architektonische Entscheidungen getroffen wurden (`docs/infrastructure/adr/ADR-0XX-*.md`)

---

## 6. QUICK REFERENCE: GUARD-STACK PRO REQUEST

```
HTTP Request
  │
  ├─ 1. JwtAuthGuard (global)         → Authentifiziert? Token gültig? User aktiv?
  ├─ 2. RolesGuard (global)           → @Roles() Decorator → Rolle erlaubt?
  ├─ 3. PermissionGuard (global)      → @RequirePermission() → DB-Check user_addon_permissions
  ├─ 4. ensureAddonEnabled() (manuell) → tenant_addons → Feature für Tenant aktiv?
  │
  └─ Controller Method ausgeführt
       │
       ├─ ResponseInterceptor          → Wraps: { success: true, data: T }
       └─ AuditTrailInterceptor        → Automatisch in audit_trail geloggt
```

---

## 7. VERGESSENE INTEGRATION = TECH DEBT

| Vergessen            | Konsequenz                                             |
| -------------------- | ------------------------------------------------------ |
| RLS Policy           | **Datenleck zwischen Tenants**                         |
| GRANT für app_user   | Feature funktioniert in Prod nicht (Permission Denied) |
| Addon Registration   | Addon ist für niemanden sichtbar                       |
| Sidebar Entry        | User findet das Feature nicht                          |
| Breadcrumb           | Verwirrende Navigation                                 |
| Permission Registrar | Admin kann keine User-Permissions vergeben             |
| Activity Logging     | Root Dashboard zeigt keine Aktivität                   |
| ensureAddonEnabled() | Addon ist für alle Tenants offen (Bypass!)             |
| API Test             | Regression bleibt unbemerkt                            |
| Notification Badge   | User sieht keine neuen Einträge                        |
| Route Group          | Falsche Rolle hat Zugriff                              |
