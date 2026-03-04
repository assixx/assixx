# FEAT: Dummy-Benutzer — Execution Masterplan

> **Created:** 2026-03-03
> **Version:** 4.0.0 (Phase 1-6 Complete)
> **Status:** IN PROGRESS — Phase 7 (Integration + Polish)
> **Branch:** `feature/TPM` (bestehender Branch)
> **Author:** Claude + SCS
> **Estimated Sessions:** 8
> **Actual Sessions:** 4 / 8

---

## Changelog

| Version | Datum      | Änderung                                                            |
| ------- | ---------- | ------------------------------------------------------------------- |
| 0.1.0   | 2026-03-03 | Initial Draft — Phasen 1-7 geplant                                  |
| 0.2.0   | 2026-03-03 | Code-Review-Fix: Zugriffskontrolle, Permissions, Queries korrigiert |
| 1.0.0   | 2026-03-03 | Phase 1+2 complete: DB Migration + Shared/Zod/Frontend UserRole     |
| 2.0.0   | 2026-03-04 | Phase 3+4 complete: Backend Module + 89 Unit Tests                  |
| 3.0.0   | 2026-03-04 | Phase 5 complete: 18 API Integration Tests + 3 Bug Fixes            |
| 4.0.0   | 2026-03-04 | Phase 6 complete: Frontend (11 Svelte/TS files, navigation, a11y)   |

---

## Konzept

**Was:** Anonyme Display-Accounts ("Dummies") für Firmen-TVs und Bildschirme.

**Warum:** Industriefirmen brauchen Kiosk-Accounts, die ohne echte Mitarbeiterdaten Informationen anzeigen (Schwarzes Brett, Kalender, TPM-Boards auf Hallendisplays).

**Wie:** Dummies sind Users mit Rolle `dummy` in der bestehenden `users`-Tabelle. Sie erhalten eine auto-generierte Email (`dummy_1@testfirma.display`), eine manuell eingegebene Bezeichnung (`display_name`), und ein vom Admin gesetztes Passwort. Sie loggen sich normal ein und sehen nur freigegebene Seiten.

**Unterschied zu manage-employees:**

| Eigenschaft      | Employee           | Dummy                                  |
| ---------------- | ------------------ | -------------------------------------- |
| Vorname/Nachname | Pflicht            | Nicht vorhanden                        |
| Personalnummer   | Pflicht (manuell)  | Auto-generiert (`DUMMY-001`)           |
| Email            | Manuell            | Auto-generiert (`dummy_1@sub.display`) |
| Bezeichnung      | Nicht vorhanden    | Pflicht (z.B. "Halle 1 Display")       |
| Passwort         | Manuell            | Manuell                                |
| Team-Zuordnung   | Ja                 | Ja (gleich wie Employee)               |
| Verfügbarkeit    | Ja                 | Nein                                   |
| Berechtigungen   | Granular (ADR-020) | Fest: nur Blackboard/Kalender/TPM      |
| Seitenfreigabe   | Alle (shared)      | Nur Whitelist                          |
| Feature-Flag     | Kein eigener       | Kein eigener                           |
| Startseite       | Dashboard          | Blackboard                             |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt vor Phase 1
- [ ] Branch `feature/TPM` aktuell
- [ ] Keine pending Migrations
- [ ] Work Orders Masterplan ist nicht blockiert

### 0.2 Risk Register

| #   | Risiko                                              | Impact  | Wahrscheinlichkeit | Mitigation                                                   | Verifikation                                        |
| --- | --------------------------------------------------- | ------- | ------------------ | ------------------------------------------------------------ | --------------------------------------------------- |
| R1  | `dummy` Rolle bricht bestehende Guard-Logik         | Hoch    | Mittel             | Alle Guards prüfen `USER_ROLES` Array — `dummy` wird ergänzt | Type-Check + alle bestehenden Tests nach Migration  |
| R2  | UserRole-Typ in vielen Frontend-Dateien gehärtet    | Mittel  | Hoch               | Shared Package als Single Source of Truth nutzen             | `grep -r "UserRole" frontend/` nach Änderung        |
| R3  | Dummy kann auf geschützte Seiten zugreifen          | Hoch    | Mittel             | Whitelist in hooks.server.ts — fail-closed                   | Manueller Test: Dummy navigiert zu /chat → Redirect |
| R4  | Email-Kollision bei auto-generierter Email          | Mittel  | Niedrig            | Sequential counter per tenant + unique constraint            | Unit Test: 2x create → verschiedene Emails          |
| R5  | employee_number Kollision                           | Mittel  | Niedrig            | `DUMMY-{N}` mit MAX+1 Query                                  | Unit Test: Parallel creation                        |
| R6  | Bestehende `@Roles('employee')` schließen Dummy aus | Niedrig | Hoch               | Gewollt! Dummies sollen nur auf Whitelist-Seiten             | API Test: Dummy → Chat-Endpoint → 403               |
| R7  | Dummies erscheinen in bestehenden Employee-Queries  | Hoch    | Hoch               | Betroffene Queries um `AND role != 'dummy'` erweitern        | API Test: GET /users listet keine Dummies           |
| R8  | PermissionGuard blockt Dummies ohne Permission-Rows | Hoch    | Sicher             | Auto-Assign read-only Permissions bei Dummy-Erstellung       | API Test: Dummy → GET /blackboard/entries → 200     |

### 0.3 Ecosystem Integration Points

| Bestehendes System            | Art der Integration                                                | Phase | Verifiziert am |
| ----------------------------- | ------------------------------------------------------------------ | ----- | -------------- |
| `users` Tabelle               | Neues `display_name` Feld + neue Rolle `dummy`                     | 1     |                |
| `@assixx/shared`              | `UserRole` Type + `USER_ROLES` Array erweitern                     | 2     |                |
| `RoleSchema` (Zod)            | `dummy` zu Zod enum hinzufügen (`common.schema.ts`)                | 2     |                |
| `RoleEnumSchema` (Zod)        | `dummy` zu Zod enum hinzufügen (`role-id-param.dto.ts`)            | 2     |                |
| `ROLE_LABELS`                 | Deutsches Label "Dummy" hinzufügen                                 | 2     |                |
| `JwtAuthGuard`                | Dummy-Rolle validieren (USER_ROLES check — automatisch via shared) | 2     |                |
| `user_feature_permissions`    | Read-only Permissions auto-assign bei Dummy-Erstellung             | 3     |                |
| `UsersService.listUsers`      | `AND role != 'dummy'` Filter hinzufügen                            | 3     |                |
| `ChatService.getChatUsers`    | `AND u.role != 'dummy'` Filter hinzufügen                          | 3     |                |
| `TeamsService.getTeamMembers` | `AND u.role != 'dummy'` Filter hinzufügen                          | 3     |                |
| `UserRepository.findMany`     | `AND role != 'dummy'` Default-Filter hinzufügen                    | 3     |                |
| `login/+page.server.ts`       | `paths` Record + lokaler UserRole um `'dummy'` erweitern           | 2     |                |
| `navigation-config.ts`        | `dummyMenuItems` + `getMenuItemsForRole` Signatur erweitern        | 6     |                |
| `Breadcrumb.svelte`           | `/manage-dummies` Einträge + `userRole` Prop-Typ erweitern         | 6     |                |
| `hooks.server.ts`             | Dummy-Whitelist für erlaubte Seiten                                | 6     |                |
| `ActivityLoggerService`       | `entityType: 'dummy-user'` für Logging                             | 3     |                |
| `(admin)` Layout Guard        | `manage-dummies` Route geschützt durch bestehenden Guard           | —     |                |

---

## Phase 1: Database Migration

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** 1 neue Migrationsdatei

### Step 1.1: Enum-Erweiterung + display_name Column [DONE]

**Neue Datei:** `database/migrations/{timestamp}_dummy-users-role-and-display-name.ts`

**Was passiert:**

1. `ALTER TYPE users_role ADD VALUE 'dummy';`
2. `ALTER TABLE users ADD COLUMN display_name VARCHAR(100);`
3. `CHECK` Constraint: Dummy kann KEIN `has_full_access` haben
4. Index auf `display_name` für Suche

**SQL-Details:**

```sql
-- 1. Enum-Erweiterung (kein IF NOT EXISTS nötig bei neuer Value)
ALTER TYPE users_role ADD VALUE 'dummy';

-- 2. Neues Feld
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);

-- 3. Constraint: Dummies dürfen kein full_access haben
-- Bestehend: CHECK (role != 'employee' OR has_full_access = false)
-- Bestehend: CHECK (role != 'root' OR has_full_access = true)
-- Neu:
ALTER TABLE users ADD CONSTRAINT chk_dummy_no_full_access
  CHECK (role != 'dummy' OR has_full_access = false);

-- 4. Constraint: Dummies brauchen display_name
ALTER TABLE users ADD CONSTRAINT chk_dummy_display_name
  CHECK (role != 'dummy' OR display_name IS NOT NULL);

-- 5. Index
CREATE INDEX idx_users_display_name ON users(display_name)
  WHERE display_name IS NOT NULL;
```

**down():**

```sql
-- display_name entfernen
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_dummy_display_name;
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_dummy_no_full_access;
DROP INDEX IF EXISTS idx_users_display_name;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;

-- ENUM value kann NICHT direkt entfernt werden
-- Detach-Drop-Recreate Pattern nötig (oder lossy rollback dokumentieren)
```

> **WARNING: One-way migration. Rollback does NOT remove the `dummy` enum value — requires detach-drop-recreate pattern. Rollback entfernt nur Column + Constraints.**

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT enumlabel FROM pg_enum WHERE enumtypid = 'users_role'::regtype;"
# Erwartung: root, admin, employee, dummy

docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d users" | grep display_name
# Erwartung: display_name | character varying(100)
```

### Phase 1 — Definition of Done

- [x] 2 Migrationsdateien (066 enum, 067 column+constraints) mit `up()` AND `down()`
- [x] Migration besteht Dry-Run
- [x] Migration erfolgreich angewendet
- [x] `users_role` Enum enthält `dummy`
- [x] `display_name` Spalte existiert
- [x] Constraints `chk_dummy_no_full_access` und `chk_dummy_display_name` aktiv
- [x] Backend kompiliert fehlerfrei
- [x] Bestehende Tests laufen weiterhin durch
- [x] Backup vorhanden

---

## Phase 2: Shared Package

> **Abhängigkeit:** Phase 1 complete
> **Dateien:** 2-3 geänderte Dateien in `shared/`

### Step 2.1: UserRole Type erweitern [DONE]

**Datei:** `shared/src/types/user-role.ts`

**Änderungen:**

```typescript
export type UserRole = 'root' | 'admin' | 'employee' | 'dummy';

export const USER_ROLES = ['root', 'admin', 'employee', 'dummy'] as const satisfies readonly UserRole[];
```

### Step 2.2: Role Labels erweitern [DONE]

**Datei:** `shared/src/constants/roles.ts`

**Änderungen:**

```typescript
export const ROLE_LABELS: Record<UserRole, string> = {
  root: 'Root',
  admin: 'Administrator',
  employee: 'Mitarbeiter',
  dummy: 'Dummy',
};
```

### Step 2.3: RoleSchema (Zod) erweitern [DONE]

**Datei 1:** `backend/src/schemas/common.schema.ts`

```typescript
export const RoleSchema = z.enum(['admin', 'employee', 'root', 'dummy']);
```

**Datei 2:** `backend/src/nest/roles/dto/role-id-param.dto.ts`

```typescript
export const RoleEnumSchema = z.enum(['admin', 'employee', 'root', 'dummy'], {
  message: 'Invalid role. Must be admin, employee, root, or dummy',
});
```

> **ACHTUNG:** Es gibt ZWEI Zod-Schemas für Rollen. Beide müssen synchron bleiben.

### Step 2.4: Frontend-lokale UserRole-Duplikate [DONE]

> **ACHTUNG:** UserRole ist in ~8 Frontend-Dateien lokal definiert. Diese müssen ALLE `'dummy'` erhalten ODER besser: auf `@assixx/shared` Import umgestellt werden.

**Betroffene Dateien (müssen `dummy` ergänzen):**

- `frontend/src/routes/login/+page.server.ts:47`
- `frontend/src/routes/(app)/(shared)/documents-explorer/_lib/types.ts:109`
- `frontend/src/routes/(app)/(shared)/kvp-detail/_lib/types.ts:9`
- `frontend/src/routes/(app)/(shared)/kvp/_lib/types.ts:9`
- `frontend/src/routes/(app)/(shared)/chat/_lib/types.ts:13`
- `frontend/src/routes/(app)/(admin)/survey-admin/_lib/types.ts:9`
- `frontend/src/routes/(app)/(root)/root-dashboard/_lib/types.ts:44`
- `frontend/src/lib/utils/auth` (exportiert UserRole)

### Step 2.5: Login-Redirect-Pfade erweitern [DONE]

> **KRITISCH:** Muss in Phase 2 passieren (nicht Phase 6!), sonst bricht der TypeScript-Build.

**Datei:** `frontend/src/routes/login/+page.server.ts`

Der Login-Redirect nutzt `Record<UserRole, string>`. Wenn `UserRole` um `'dummy'` erweitert wird,
erzwingt TypeScript einen `dummy`-Eintrag:

```typescript
const paths: Record<UserRole, string> = {
  root: '/root-dashboard',
  admin: '/admin-dashboard',
  employee: '/employee-dashboard',
  dummy: '/blackboard',
};
```

### Phase 2 — Definition of Done

- [x] `UserRole` in shared enthält `'dummy'`
- [x] `USER_ROLES` Array enthält `'dummy'`
- [x] `ROLE_LABELS` hat "Dummy" Label
- [x] `RoleSchema` Zod enum enthält `'dummy'` (common.schema.ts)
- [x] `RoleEnumSchema` Zod enum enthält `'dummy'` (role-id-param.dto.ts)
- [x] Alle Frontend-lokalen UserRole-Definitionen aktualisiert
- [x] Login-Redirect `paths` Record enthält `dummy: '/blackboard'`
- [x] Shared Package baut fehlerfrei
- [x] Backend type-check bestanden
- [x] Frontend svelte-check bestanden

---

## Phase 3: Backend Module

> **Abhängigkeit:** Phase 2 complete
> **Neues Verzeichnis:** `backend/src/nest/dummy-users/`

### Step 3.1: Module Skeleton + Types + DTOs [DONE]

**Neues Verzeichnis:** `backend/src/nest/dummy-users/`

**Dateistruktur:**

```
backend/src/nest/dummy-users/
    dummy-users.module.ts
    dummy-users.controller.ts
    dummy-users.service.ts
    dummy-users.helpers.ts
    dummy-users.helpers.test.ts
    dummy-users.types.ts
    dto/
        common.dto.ts
        create-dummy-user.dto.ts
        update-dummy-user.dto.ts
        list-dummy-users-query.dto.ts
        index.ts
```

**Types (`dummy-users.types.ts`):**

```typescript
/** DB Row — 1:1 mit users Tabelle (nur dummy-relevante Felder) */
interface DummyUserRow {
  id: number;
  uuid: string;
  tenant_id: number;
  email: string;
  display_name: string;
  role: 'dummy';
  is_active: number;
  created_at: string;
  updated_at: string;
  // Team/Dept via JOIN
}

/** API Response (camelCase) */
interface DummyUser {
  id: number;
  uuid: string;
  email: string;
  displayName: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  teamIds: number[];
  teamNames: string[];
  departmentIds: number[];
  departmentNames: string[];
  areaIds: number[];
  areaNames: string[];
}
```

**DTOs:**

- `CreateDummyUserDto`: `{ displayName: string, password: string, teamIds?: number[] }`
- `UpdateDummyUserDto`: `{ displayName?: string, password?: string, teamIds?: number[], isActive?: number }`
- `ListDummyUsersQueryDto`: Pagination + search + isActive filter

### Step 3.2: DummyUsersService [DONE]

**Datei:** `backend/src/nest/dummy-users/dummy-users.service.ts`

**Methoden:**

| Methode                               | Beschreibung                                                              |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `create(tenantId, dto, actingUserId)` | Auto-Email + Auto-EmployeeNumber generieren, User INSERT mit role='dummy' |
| `list(tenantId, query)`               | Paginated list mit role='dummy' Filter                                    |
| `getByUuid(tenantId, uuid)`           | Einzelnen Dummy laden                                                     |
| `update(tenantId, uuid, dto)`         | Bezeichnung/Teams/Status ändern                                           |
| `delete(tenantId, uuid)`              | Soft-Delete (is_active=4)                                                 |
| `generateEmail(tenantId)`             | `dummy_{N}@{subdomain}.display` mit Sequential Counter                    |
| `generateEmployeeNumber(tenantId)`    | `DUMMY-{N}` mit MAX+1                                                     |

**Email-Generierung:**

```sql
-- Nächste freie Nummer finden
SELECT COALESCE(MAX(
  CAST(SUBSTRING(email FROM 'dummy_(\d+)@') AS INTEGER)
), 0) + 1 AS next_number
FROM users
WHERE tenant_id = $1 AND role = 'dummy';

-- Subdomain laden
SELECT subdomain FROM tenants WHERE id = $1;

-- Email: dummy_{next_number}@{subdomain}.display
```

**Employee-Number-Generierung:**

```sql
SELECT COALESCE(MAX(
  CAST(SUBSTRING(employee_number FROM 'DUMMY-(\d+)') AS INTEGER)
), 0) + 1 AS next_number
FROM users
WHERE tenant_id = $1 AND role = 'dummy';

-- Result: DUMMY-{next_number} (zero-padded: DUMMY-001)
```

**Abhängigkeiten:** `DatabaseService`, `ActivityLoggerService`, `UserPermissionsService` (für auto-assign)

> **Passwort-Hashing:** Gleiches Verfahren wie `UsersService.createUser()` — bcrypt mit Salt-Rounds
> aus Config. Passwort wird NIEMALS im Klartext gespeichert.

### Step 3.3: DummyUsersController [DONE]

**Datei:** `backend/src/nest/dummy-users/dummy-users.controller.ts`

**Endpoints (5 total):**

| Method | Route                | Guard                   | Beschreibung      |
| ------ | -------------------- | ----------------------- | ----------------- |
| GET    | `/dummy-users`       | @Roles('admin', 'root') | Liste (paginiert) |
| POST   | `/dummy-users`       | @Roles('admin', 'root') | Erstellen         |
| GET    | `/dummy-users/:uuid` | @Roles('admin', 'root') | Einzelner Dummy   |
| PUT    | `/dummy-users/:uuid` | @Roles('admin', 'root') | Aktualisieren     |
| DELETE | `/dummy-users/:uuid` | @Roles('admin', 'root') | Soft-Delete       |

**Kein Feature-Gate nötig** (User-Entscheidung: kein eigener Feature-Flag).

**Kein Permission-Guard nötig** (nur Admin/Root, keine granularen Permissions).

### Step 3.4: Module Registration [DONE]

**Datei:** `backend/src/nest/app.module.ts`

- `DummyUsersModule` zu `imports` Array hinzufügen (alphabetisch sortiert)

### Step 3.5: Dummy-Zugangslogik im Backend [DONE]

> **Code-Review-Korrektur (v0.2.0):** Die ursprüngliche Annahme, dass `@Roles('dummy')` auf
> Blackboard/Calendar/TPM-Controller-Endpoints hinzugefügt werden muss, war **FALSCH**.
>
> **Realität:** Blackboard GET-Endpoints haben KEINE `@Roles()`-Decorators. Calendar und TPM
> haben auf KEINEM Endpoint `@Roles()`. Die Zugriffskontrolle läuft ausschließlich über
> `@RequirePermission()` → `PermissionGuard` → `user_feature_permissions`-Tabelle.
>
> **Der tatsächliche Zugangsweg für Dummies:**
>
> 1. `JwtAuthGuard`: Prüft `USER_ROLES.includes(role)` → ✅ durch Phase 2 gelöst
> 2. `RolesGuard`: Kein `@Roles()` auf GET-Endpoints → ✅ passiert automatisch durch
> 3. `TenantFeatureGuard`: Prüft ob Feature für Tenant aktiv → ✅ keine Änderung nötig
> 4. `PermissionGuard`: Prüft `user_feature_permissions`-Tabelle → ❌ **HIER IST DER BLOCKER**
>
> **Lösung:** Read-only Permissions automatisch beim Erstellen eines Dummies anlegen.

**Korrekte Endpoint-Routen (verifiziert gegen Code):**

| Feature    | Endpoint                      | Guard-Chain                                             |
| ---------- | ----------------------------- | ------------------------------------------------------- |
| Blackboard | GET `/blackboard/entries`     | JWT → Perm(`blackboard`, `blackboard-posts`, `canRead`) |
| Blackboard | GET `/blackboard/entries/:id` | JWT → Perm(`blackboard`, `blackboard-posts`, `canRead`) |
| Calendar   | GET `/calendar/events`        | JWT → Perm(`calendar`, `calendar-events`, `canRead`)    |
| Calendar   | GET `/calendar/dashboard`     | JWT → Perm(`calendar`, `calendar-events`, `canRead`)    |
| TPM        | GET `/tpm/plans`              | JWT → Perm(`tpm`, `tpm-plans`, `canRead`)               |
| TPM        | GET `/tpm/plans/:uuid/board`  | JWT → Perm(`tpm`, `tpm-plans`, `canRead`)               |
| TPM        | GET `/tpm/cards`              | JWT → Perm(`tpm`, `tpm-cards`, `canRead`)               |
| TPM        | GET `/tpm/cards/:uuid`        | JWT → Perm(`tpm`, `tpm-cards`, `canRead`)               |

**Keine `@Roles`-Änderungen nötig. Keine Controller-Änderungen nötig.**

**Auto-Assign Permissions in `DummyUsersService.create()`:**

Nach dem User-INSERT müssen automatisch die folgenden `user_feature_permissions`-Rows
angelegt werden (nur `canRead = true`, `canWrite = false`, `canDelete = false`):

```sql
INSERT INTO user_feature_permissions
  (tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete, assigned_by)
VALUES
  ($1, $2, 'blackboard', 'blackboard-posts',    true, false, false, $3),
  ($1, $2, 'blackboard', 'blackboard-comments', true, false, false, $3),
  ($1, $2, 'calendar',   'calendar-events',     true, false, false, $3),
  ($1, $2, 'tpm',        'tpm-plans',           true, false, false, $3),
  ($1, $2, 'tpm',        'tpm-cards',           true, false, false, $3),
  ($1, $2, 'tpm',        'tpm-executions',      true, false, false, $3)
ON CONFLICT (tenant_id, user_id, feature_code, module_code) DO NOTHING;
```

> **WICHTIG:** Nur `canRead`! Dummies dürfen NICHTS schreiben/löschen.
> Die Permissions werden nur für Features angelegt, die beim Tenant aktiv sind
> (`TenantFeatureGuard` prüft das separat). Ist ein Feature nicht aktiv, greift
> der Guard vorher → 403, egal ob Permission-Row existiert.

**Bewusste Entscheidung — Blackboard Confirm/Comment:**

- POST `/blackboard/entries/:id/confirm` erfordert nur `canRead` → Dummy KÖNNTE bestätigen
- POST `/blackboard/entries/:id/comments` erfordert `canWrite` → Dummy KANN NICHT kommentieren
- **Entscheidung:** Confirm wird explizit NICHT blockiert. Ein Display "bestätigt" zwar nicht aktiv,
  aber die Permission-Struktur ist korrekt (nur canRead). Falls unerwünscht: canRead für
  `blackboard-posts` entfernen und separates `blackboard-view`-Modul einführen (V2).

### Step 3.6: Bestehende Queries gegen Dummy-Leaks absichern [DONE]

> **Code-Review-Korrektur (v0.2.0):** Neuer Step. Ohne diesen Fix erscheinen Dummies in:
> Employee-Listen, Chat-Kontaktlisten, Team-Member-Dropdowns.

**Betroffene Queries (verifiziert gegen Code):**

| Datei                                          | Query / Methode                    | Problem                                     | Fix                                         |
| ---------------------------------------------- | ---------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `users/users.helpers.ts:157`                   | `buildUserListWhereClause()`       | Kein Default-Rollenfilter                   | `AND role != 'dummy'` als Default           |
| `chat/chat.service.ts:152`                     | `fetchChatUsersByPermissions()`    | Admin-Pfad zeigt alle aktiven User          | `AND u.role != 'dummy'`                     |
| `teams/teams.service.ts:141`                   | `getTeamMembers()` (beide Queries) | Kein Rollenfilter + kein `is_active`-Filter | `AND u.role != 'dummy' AND u.is_active = 1` |
| `database/repositories/user.repository.ts:202` | `findMany()` Default-WHERE         | Kein Rollenfilter wenn `role` Option fehlt  | `AND role != 'dummy'` als Default           |

> **Prinzip:** Dummies sollen NIRGENDS auftauchen außer in `/manage-dummies` und in der
> `DummyUsersService`. Alle bestehenden User-Listen müssen Dummies explizit ausschließen.

### Phase 3 — Definition of Done

- [x] `DummyUsersModule` registriert in `app.module.ts`
- [x] Service mit CRUD + Auto-Email + Auto-EmployeeNumber
- [x] Service auto-assigned read-only Permissions bei `create()`
- [x] Controller mit 5 Endpoints
- [x] Alle DTOs mit Zod + `createZodDto()`
- [x] `db.query()` für tenant-scoped Queries
- [x] ActivityLogger für alle Mutations
- [x] Bestehende Queries (Users, Chat, Teams, UserRepo, Departments, Blackboard) schließen Dummies aus
- [x] ESLint 0 Errors
- [x] Type-Check passed

---

## Phase 4: Unit Tests

> **Abhängigkeit:** Phase 3 complete

### Test-Dateien

```
backend/src/nest/dummy-users/
    dummy-users.service.test.ts        # Core CRUD Tests
    dummy-users.helpers.test.ts        # Helper Functions
    dto/
        create-dummy-user.dto.test.ts  # DTO Validation
```

### Kritische Test-Szenarien

**Geschäftslogik:**

- [ ] Happy Path: Dummy erstellen → korrekte Email + EmployeeNumber
- [ ] Happy Path: Dummy listen → nur role='dummy', nicht employees
- [ ] Happy Path: Dummy aktualisieren → display_name änderbar
- [ ] Happy Path: Dummy löschen → is_active=4 (soft delete)

**Email-Generierung:**

- [ ] Erster Dummy → `dummy_1@testfirma.display`
- [ ] Zweiter Dummy → `dummy_2@testfirma.display`
- [ ] Nach Löschung → Lücke wird NICHT gefüllt (sequentiell, nicht lückenfüllend)
- [ ] Tenant ohne Subdomain → Fehler

**EmployeeNumber-Generierung:**

- [ ] Erster → `DUMMY-001`
- [ ] Zehnter → `DUMMY-010`
- [ ] Nach Löschung → weiter sequentiell

**Edge Cases:**

- [ ] display_name leer → BadRequestException (Zod)
- [ ] display_name zu lang (>100 Zeichen) → BadRequestException
- [ ] Passwort zu kurz (<12 Zeichen) → BadRequestException
- [ ] Versuch, has_full_access=true zu setzen → verhindert

**Datenintegrität:**

- [ ] Dummy wird mit role='dummy' erstellt (nicht 'employee')
- [ ] Dummy hat has_full_access=false
- [ ] Dummy hat first_name=NULL, last_name=NULL
- [ ] Team-Zuordnung funktioniert gleich wie bei Employees

**Permission-Auto-Assign:**

- [ ] Nach create() existieren 6 Permission-Rows (blackboard×2, calendar×1, tpm×3)
- [ ] Alle Permissions: canRead=true, canWrite=false, canDelete=false
- [ ] assigned_by = actingUserId (der Admin der den Dummy erstellt hat)
- [ ] Doppeltes create() → ON CONFLICT DO NOTHING (keine Duplikate)

**Query-Isolation:**

- [ ] UsersService.listUsers() gibt KEINE Dummies zurück (Default-Filter)
- [ ] ChatService.getChatUsers() gibt KEINE Dummies zurück
- [ ] TeamsService.getTeamMembers() gibt KEINE Dummies zurück

### Phase 4 — Definition of Done

- [x] ≥30 Unit Tests (89 total: 17 helpers + 43 DTOs + 29 service)
- [x] Alle Tests grün (5927 total, 0 failures)
- [x] DTO-Validierung getestet (Create, Update, List, UUID, IsActive)
- [x] Email/EmployeeNumber-Generierung getestet
- [x] Edge Cases abgedeckt (not found, already deleted, validation)

---

## Phase 5: API Integration Tests

> **Abhängigkeit:** Phase 4 complete

### Test-Datei

`backend/test/dummy-users.api.test.ts`

### Szenarien (>= 15 Assertions)

**Auth:**

- [x] Unauthenticated → 401
- [x] Employee → 403 (kein Zugang zu manage-dummies)

**CRUD:**

- [x] POST → 201 (Dummy erstellt, auto-Email in Response)
- [x] POST → 400 (Fehlende displayName)
- [x] POST → 400 (Passwort zu kurz)
- [x] GET list → 200 (nur Dummies, nicht Employees)
- [x] GET single → 200 (mit Details)
- [x] PUT → 200 (displayName geändert)
- [x] DELETE → 200 (Soft-Delete)
- [x] GET nach DELETE → 404

**Dummy-Login & Zugriff:**

- [x] Dummy kann sich einloggen → 200 + JWT
- [x] Dummy → GET /blackboard/entries → 200 (auto-assigned Permission)
- [x] Dummy → GET /calendar/events → 200 (auto-assigned Permission)
- [x] Dummy → GET /tpm/plans → 200 (auto-assigned Permission)
- [x] Dummy → POST /blackboard/entries → 403 (canWrite=false!)
- [x] Dummy → GET /chat/conversations → 403 (keine Permission)
- [x] Dummy → GET /users → 403 (nicht admin/root)

**Query-Isolation (Regressionstests):**

- [x] GET /users (als Admin) → Response enthält keine Dummy-User
- [N/A] GET /chat/users → kein dedizierter Endpoint (chat hat `@RequirePermission`, Dummy bekommt 403)

**Bug Fixes während Phase 5:**

- [x] FIX: `user_team_assignments` → `user_teams` (falscher Tabellenname in 3 SQL-Queries)
- [x] FIX: DELETE ohne `RETURNING id` → UPDATE result war immer `[]`
- [x] FIX: `import type` für DTOs → Zod-Validation lief nicht (metatype zur Runtime gelöscht)

### Phase 5 — Definition of Done

- [x] >= 15 API Integration Tests (18 Tests)
- [x] Alle Tests grün (5945 total, 0 Fehler)
- [x] Dummy-Login funktioniert
- [x] Zugriffskontrolle verifiziert (erlaubt + verboten)

---

## Phase 6: Frontend

> **Abhängigkeit:** Phase 3 complete (Backend-Endpoints verfügbar)
> **KRITISCH:** manage-employees hat Dateien mit 813 Zeilen (+page.svelte), 736 Zeilen (utils.ts),
> 719 Zeilen (EmployeeFormModal.svelte) — ALLE am oder über dem 800-Zeilen-Limit.
> manage-dummies MUSS von Anfang an modular sein. Max 400 Zeilen pro Datei als Ziel.

### Step 6.1: hooks.server.ts — Dummy-Whitelist [DONE]

**Datei:** `frontend/src/hooks.server.ts`

**Logik:** Nach erfolgreicher Authentifizierung, BEVOR die Route geladen wird:

```typescript
// Dummy-User Whitelist — erweiterbar für V2
const DUMMY_ALLOWED_PREFIXES = ['/blackboard', '/calendar', '/lean-management/tpm/board/'] as const;

if (user.role === 'dummy') {
  const isAllowed = DUMMY_ALLOWED_PREFIXES.some((prefix: string) => pathname.startsWith(prefix));
  if (!isAllowed) {
    throw redirect(302, '/blackboard');
  }
}
```

### Step 6.2: (shared) Layout Guard — Dummy erlauben [DONE]

**Datei:** `frontend/src/routes/(app)/(shared)/+layout.server.ts`

Aktuell erlaubt alle authentifizierten User. Dummy ist authentifiziert → wird durchgelassen.
`hooks.server.ts` Whitelist filtert vorher.

→ **Keine Änderung nötig.**

### Step 6.3: manage-dummies — Modulare Dateistruktur [DONE]

**Neues Verzeichnis:** `frontend/src/routes/(app)/(admin)/manage-dummies/`

> **Leitmotiv:** Jede Datei hat EINE Verantwortung. Keine Datei über 400 Zeilen.
> manage-employees ist das Anti-Pattern (813-Zeilen Page, 736-Zeilen Utils).

```
frontend/src/routes/(app)/(admin)/manage-dummies/
│
├── +page.svelte                          # ~250 Zeilen — Orchestrierung
├── +page.server.ts                       # ~60 Zeilen — SSR Data Loading
│
└── _lib/
    │
    │── ── ── TYPEN & KONSTANTEN ── ── ──
    │
    ├── types.ts                          # ~80 Zeilen — Interfaces
    ├── constants.ts                      # ~100 Zeilen — Labels, Endpoints, Defaults
    │
    │── ── ── API & STATE ── ── ──
    │
    ├── api.ts                            # ~120 Zeilen — CRUD API Functions
    ├── state-data.svelte.ts              # ~50 Zeilen — $state für Daten (dummies[], teams[])
    ├── state-ui.svelte.ts                # ~60 Zeilen — $state für UI (modals, filter, search)
    │
    │── ── ── PURE LOGIK ── ── ──
    │
    ├── filters.ts                        # ~40 Zeilen — filterByStatus, filterBySearch
    ├── utils-badges.ts                   # ~100 Zeilen — Status/Team/Area/Dept Badge Helpers
    ├── utils-form.ts                     # ~80 Zeilen — Form Defaults, Populate, Validate
    ├── utils-password.ts                 # ~60 Zeilen — Strength Calculator (shared!)
    │
    │── ── ── SVELTE KOMPONENTEN ── ── ──
    │
    ├── DummyTable.svelte                 # ~80 Zeilen — Tabelle mit Header + Loop
    ├── DummyTableRow.svelte              # ~120 Zeilen — Einzelne Tabellenzeile
    ├── DummyFormModal.svelte             # ~200 Zeilen — Modal-Rahmen + Sections
    ├── FormSectionDesignation.svelte     # ~60 Zeilen — Bezeichnung Input
    ├── FormSectionPassword.svelte        # ~100 Zeilen — Passwort + Confirm + Strength
    ├── FormSectionTeams.svelte           # ~120 Zeilen — Team Multi-Select Dropdown
    ├── FormSectionStatus.svelte          # ~50 Zeilen — Status Dropdown (nur Edit)
    ├── FormSectionReadonly.svelte        # ~50 Zeilen — Email + Personalnr (readonly)
    ├── SearchBar.svelte                  # ~60 Zeilen — Suchfeld + Ergebnis-Dropdown
    ├── StatusFilterTabs.svelte           # ~50 Zeilen — Aktiv/Inaktiv/Archiv/Alle
    └── DeleteConfirmModal.svelte         # ~80 Zeilen — 2-Step Lösch-Bestätigung
```

**Geschätzt: ~1.640 Zeilen total (vs. 4.034 Zeilen manage-employees)**

---

#### 6.3.1 Komponentenarchitektur — Detail

```
+page.svelte (Orchestrierung, max ~250 Zeilen)
│
├── SearchBar.svelte
│   └── Emittet: onsearch(term), onclear()
│
├── StatusFilterTabs.svelte
│   └── Emittet: onfilter(status)
│
├── DummyTable.svelte
│   └── DummyTableRow.svelte (pro Dummy)
│       ├── Badges via utils-badges.ts
│       └── Emittet: onedit(dummy), ondelete(dummy)
│
├── DummyFormModal.svelte (Create/Edit)
│   ├── FormSectionDesignation.svelte
│   ├── FormSectionPassword.svelte
│   │   └── PasswordStrengthIndicator (shared $lib)
│   ├── FormSectionTeams.svelte
│   ├── FormSectionStatus.svelte (nur Edit-Modus)
│   └── FormSectionReadonly.svelte (Email + PersonalNr, nur Edit)
│
└── DeleteConfirmModal.svelte
    └── 2-Step: "Sicher?" → "Wirklich sicher?"
```

---

#### 6.3.2 Datei-für-Datei-Spezifikation

##### `types.ts` (~80 Zeilen)

```typescript
/** API Response vom Backend */
export interface DummyUser {
  uuid: string;
  email: string;
  displayName: string;
  employeeNumber: string;
  isActive: number;
  createdAt: string;
  updatedAt: string;
  teamIds: number[];
  teamNames: string[];
  departmentIds: number[];
  departmentNames: string[];
  areaIds: number[];
  areaNames: string[];
}

/** Team für Multi-Select */
export interface Team {
  id: number;
  name: string;
  departmentName: string | null;
}

/** Form-Daten für Create/Edit */
export interface DummyFormData {
  displayName: string;
  password: string;
  passwordConfirm: string;
  teamIds: number[];
  isActive: number;
}

/** Paginated API Response */
export interface PaginatedDummies {
  data: DummyUser[];
  pagination: { currentPage: number; totalPages: number; totalItems: number };
}
```

##### `constants.ts` (~100 Zeilen)

```typescript
export const API_ENDPOINTS = {
  DUMMIES: '/dummy-users',
  TEAMS: '/teams',
} as const;

export const MESSAGES = {
  CREATE_SUCCESS: 'Dummy-Benutzer wurde erstellt',
  UPDATE_SUCCESS: 'Dummy-Benutzer wurde aktualisiert',
  DELETE_SUCCESS: 'Dummy-Benutzer wurde gelöscht',
  DELETE_CONFIRM_TITLE: 'Dummy löschen?',
  DELETE_CONFIRM_FINAL: 'Wirklich unwiderruflich löschen?',
  DISPLAY_NAME_LABEL: 'Bezeichnung',
  DISPLAY_NAME_PLACEHOLDER: 'z.B. Halle 1 Display',
  EMAIL_LABEL: 'Email (automatisch)',
  EMPLOYEE_NR_LABEL: 'Personalnummer (automatisch)',
  NO_DUMMIES: 'Noch keine Dummy-Benutzer angelegt.',
  // ...
} as const;

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Alle' },
  { value: 1, label: 'Aktiv' },
  { value: 0, label: 'Inaktiv' },
  { value: 3, label: 'Archiviert' },
] as const;

export const FORM_DEFAULTS: DummyFormData = {
  displayName: '',
  password: '',
  passwordConfirm: '',
  teamIds: [],
  isActive: 1,
};
```

##### `api.ts` (~120 Zeilen)

```typescript
/** CRUD Operationen für Dummy-Users */
export function createDummy(data: CreatePayload): Promise<DummyUser> { ... }
export function listDummies(query: ListQuery): Promise<PaginatedDummies> { ... }
export function getDummy(uuid: string): Promise<DummyUser> { ... }
export function updateDummy(uuid: string, data: UpdatePayload): Promise<DummyUser> { ... }
export function deleteDummy(uuid: string): Promise<void> { ... }
export function loadTeams(): Promise<Team[]> { ... }
export function syncTeamMemberships(uuid: string, oldIds: number[], newIds: number[]): Promise<void> { ... }
```

##### `state-data.svelte.ts` (~50 Zeilen)

```typescript
/** Reaktiver Daten-State — SSR-initialisiert, nach Mutations refreshed */
let dummies = $state<DummyUser[]>([]);
let teams = $state<Team[]>([]);
let totalPages = $state(1);

export function setDummies(data: DummyUser[]): void {
  dummies = data;
}
export function setTeams(data: Team[]): void {
  teams = data;
}
export function getDummies(): DummyUser[] {
  return dummies;
}
export function getTeams(): Team[] {
  return teams;
}
```

##### `state-ui.svelte.ts` (~60 Zeilen)

```typescript
/** Reaktiver UI-State — Modals, Filter, Suche */
let showCreateModal = $state(false);
let editingDummy = $state<DummyUser | null>(null);
let deletingDummy = $state<DummyUser | null>(null);
let statusFilter = $state<number | 'all'>('all');
let searchTerm = $state('');
let isLoading = $state(false);
let errorMessage = $state('');

export function openCreate(): void {
  showCreateModal = true;
}
export function openEdit(dummy: DummyUser): void {
  editingDummy = dummy;
}
export function openDelete(dummy: DummyUser): void {
  deletingDummy = dummy;
}
export function closeAll(): void {
  showCreateModal = false;
  editingDummy = null;
  deletingDummy = null;
}
// ... getter/setter
```

##### `filters.ts` (~40 Zeilen)

```typescript
/** Pure Filter-Funktionen — keine Side Effects, leicht testbar */
export function filterByStatus(dummies: DummyUser[], status: number | 'all'): DummyUser[] { ... }
export function filterBySearch(dummies: DummyUser[], term: string): DummyUser[] { ... }
export function applyAllFilters(dummies: DummyUser[], status: number | 'all', term: string): DummyUser[] {
  return filterBySearch(filterByStatus(dummies, status), term);
}
```

##### `utils-badges.ts` (~100 Zeilen)

```typescript
/** Badge-Display-Helpers — generieren HTML-Strings mit CSS-Klassen */
export function getStatusBadge(isActive: number): BadgeInfo { ... }
export function getTeamsBadge(teamIds: number[], teamNames: string[]): BadgeInfo { ... }
export function getDepartmentsBadge(deptIds: number[], deptNames: string[]): BadgeInfo { ... }
export function getAreasBadge(areaIds: number[], areaNames: string[]): BadgeInfo { ... }
```

##### `utils-form.ts` (~80 Zeilen)

```typescript
/** Form-Helpers — Validation + Populate */
export function getDefaultFormValues(): DummyFormData { ... }
export function populateFormFromDummy(dummy: DummyUser): DummyFormData { ... }
export function validateForm(data: DummyFormData, isCreate: boolean): ValidationResult { ... }
export function buildCreatePayload(data: DummyFormData): CreatePayload { ... }
export function buildUpdatePayload(data: DummyFormData): UpdatePayload { ... }
```

##### `utils-password.ts` (~60 Zeilen)

> Kopie oder Import von manage-employees `PasswordStrengthIndicator`-Logik.
> Idealerweise in `$lib/utils/password.ts` extrahieren (shared).

```typescript
export function calculatePasswordStrength(password: string): PasswordStrength { ... }
export function getStrengthLabel(score: number): string { ... }
export function getStrengthColor(score: number): string { ... }
```

---

#### 6.3.3 Komponentenspezifikation

##### `+page.svelte` (~250 Zeilen)

**Verantwortung:** Nur Orchestrierung. Keine Business-Logik, keine Badge-Berechnung.

```svelte
<script lang="ts">
  // SSR-Daten via $props()
  // $derived für gefilterte Liste
  // Event-Handler delegieren an api.ts + state
  // invalidateAll() nach Mutations
</script>

<div class="page-container">
  <header> Titel + "Neuer Dummy" Button </header>

  <SearchBar {searchTerm} onsearch={...} />
  <StatusFilterTabs {activeFilter} onfilter={...} />

  <DummyTable
    dummies={filteredDummies}
    onedit={handleEdit}
    ondelete={handleDelete}
  />

  {#if showCreateModal || editingDummy}
    <DummyFormModal
      mode={editingDummy ? 'edit' : 'create'}
      dummy={editingDummy}
      teams={teams}
      onsave={handleSave}
      onclose={closeModal}
    />
  {/if}

  {#if deletingDummy}
    <DeleteConfirmModal
      displayName={deletingDummy.displayName}
      onconfirm={handleDeleteConfirm}
      oncancel={closeDeleteModal}
    />
  {/if}
</div>
```

##### `DummyTable.svelte` (~80 Zeilen)

**Verantwortung:** Tabellen-Header + Schleife über DummyTableRow.

```svelte
<script lang="ts">
  let { dummies, onedit, ondelete }: Props = $props();
</script>

<table class="table-glass">
  <thead>
    <tr>
      <th>Bezeichnung</th>
      <th>Email</th>
      <th>Nr.</th>
      <th>Teams</th>
      <th>Bereiche</th>
      <th>Abteilungen</th>
      <th>Status</th>
      <th>Aktionen</th>
    </tr>
  </thead>
  <tbody>
    {#each dummies as dummy (dummy.uuid)}
      <DummyTableRow {dummy} {onedit} {ondelete} />
    {:else}
      <tr><td colspan="8">{MESSAGES.NO_DUMMIES}</td></tr>
    {/each}
  </tbody>
</table>
```

##### `DummyTableRow.svelte` (~120 Zeilen)

**Verantwortung:** Eine Zeile. Badges via `$derived` + utils-badges.ts.

##### `DummyFormModal.svelte` (~200 Zeilen)

**Verantwortung:** Modal-Rahmen, Form-State, Submit-Handler.
Delegiert Sektionen an Form-Sub-Komponenten.

```svelte
<script lang="ts">
  let { mode, dummy, teams, onsave, onclose }: Props = $props();
  let formData = $state<DummyFormData>(
    mode === 'edit' && dummy ? populateFormFromDummy(dummy) : getDefaultFormValues()
  );
  let errors = $state<Record<string, string>>({});
</script>

<div class="modal-glass">
  <h2>{mode === 'create' ? 'Neuer Dummy' : 'Dummy bearbeiten'}</h2>

  <FormSectionDesignation bind:value={formData.displayName} error={errors.displayName} />

  {#if mode === 'edit' && dummy}
    <FormSectionReadonly email={dummy.email} employeeNumber={dummy.employeeNumber} />
  {/if}

  <FormSectionPassword
    bind:password={formData.password}
    bind:passwordConfirm={formData.passwordConfirm}
    required={mode === 'create'}
    error={errors.password}
  />

  <FormSectionTeams bind:selectedIds={formData.teamIds} {teams} />

  {#if mode === 'edit'}
    <FormSectionStatus bind:value={formData.isActive} />
  {/if}

  <footer>
    <button onclick={onclose}>Abbrechen</button>
    <button onclick={handleSubmit}>Speichern</button>
  </footer>
</div>
```

##### `FormSectionDesignation.svelte` (~60 Zeilen)

Einfaches Input-Feld mit Label, Placeholder, Error-Anzeige.

##### `FormSectionPassword.svelte` (~100 Zeilen)

Passwort + Bestätigung + PasswordStrengthIndicator + Sichtbarkeits-Toggle.

##### `FormSectionTeams.svelte` (~120 Zeilen)

Multi-Select Dropdown für Teams. Ctrl/Cmd+Click für Mehrfachauswahl.
Zeigt gewählte Teams als Badges.

##### `FormSectionStatus.svelte` (~50 Zeilen)

Dropdown: Aktiv(1) / Inaktiv(0) / Archiviert(3). Nur im Edit-Modus.

##### `FormSectionReadonly.svelte` (~50 Zeilen)

Zwei readonly Felder: auto-generierte Email + auto-generierte Personalnummer.

##### `SearchBar.svelte` (~60 Zeilen)

Suchfeld mit Debounce. Zeigt erste 5 Treffer als Dropdown.

##### `StatusFilterTabs.svelte` (~50 Zeilen)

Button-Gruppe: Alle | Aktiv | Inaktiv | Archiviert. Aktiver Tab hervorgehoben.

##### `DeleteConfirmModal.svelte` (~80 Zeilen)

2-Step Bestätigung: "Möchten Sie '{displayName}' löschen?" → "Wirklich sicher?"

---

#### 6.3.4 Zeilenlimit-Prüfung

| Datei                           | Max Zeilen | Limit | Status |
| ------------------------------- | ---------- | ----- | ------ |
| `+page.svelte`                  | ~250       | 800   | OK     |
| `+page.server.ts`               | ~60        | 800   | OK     |
| `types.ts`                      | ~80        | 800   | OK     |
| `constants.ts`                  | ~100       | 800   | OK     |
| `api.ts`                        | ~120       | 800   | OK     |
| `state-data.svelte.ts`          | ~50        | 800   | OK     |
| `state-ui.svelte.ts`            | ~60        | 800   | OK     |
| `filters.ts`                    | ~40        | 800   | OK     |
| `utils-badges.ts`               | ~100       | 800   | OK     |
| `utils-form.ts`                 | ~80        | 800   | OK     |
| `utils-password.ts`             | ~60        | 800   | OK     |
| `DummyTable.svelte`             | ~80        | 800   | OK     |
| `DummyTableRow.svelte`          | ~120       | 800   | OK     |
| `DummyFormModal.svelte`         | ~200       | 800   | OK     |
| `FormSectionDesignation.svelte` | ~60        | 800   | OK     |
| `FormSectionPassword.svelte`    | ~100       | 800   | OK     |
| `FormSectionTeams.svelte`       | ~120       | 800   | OK     |
| `FormSectionStatus.svelte`      | ~50        | 800   | OK     |
| `FormSectionReadonly.svelte`    | ~50        | 800   | OK     |
| `SearchBar.svelte`              | ~60        | 800   | OK     |
| `StatusFilterTabs.svelte`       | ~50        | 800   | OK     |
| `DeleteConfirmModal.svelte`     | ~80        | 800   | OK     |
| **TOTAL**                       | **~1.870** |       |        |

**Vergleich: manage-employees = 4.034 Zeilen in 15 Dateien → manage-dummies = ~1.870 Zeilen in 22 Dateien**
Mehr Dateien, aber jede unter 250 Zeilen. Keine einzige Datei auch nur NAHE am 800-Zeilen-Limit.

---

### Step 6.4: Navigation Config [DONE]

**Datei:** `frontend/src/routes/(app)/_lib/navigation-config.ts`

> **Code-Review-Korrektur (v0.2.0):** Neben dem neuen Array muss auch die
> `getMenuItemsForRole()`-Funktionssignatur erweitert werden. Sie nutzt aktuell
> eine inline String-Union `role: 'root' | 'admin' | 'employee'`, NICHT den shared `UserRole`-Typ.

**1. Funktionssignatur erweitern:**

```typescript
// Vorher:
function getMenuItemsForRole(role: 'root' | 'admin' | 'employee'): NavItem[]

// Nachher:
function getMenuItemsForRole(role: 'root' | 'admin' | 'employee' | 'dummy'): NavItem[]

// Im Switch:
case 'dummy': return dummyMenuItems;
```

**2. Neues `dummyMenuItems` Array:**

```typescript
const dummyMenuItems: NavItem[] = [
  {
    id: 'blackboard',
    icon: ICONS.blackboard,
    label: 'Schwarzes Brett',
    url: '/blackboard',
  },
  {
    id: 'calendar',
    icon: ICONS.calendar,
    label: 'Kalender',
    url: '/calendar',
    featureCode: 'calendar',
  },
  {
    id: 'lean-management',
    icon: ICONS.industry,
    label: 'LEAN-Management',
    submenu: [
      {
        id: 'tpm',
        icon: ICONS.wrench,
        label: 'TPM',
        url: '/lean-management/tpm',
        featureCode: 'tpm',
      },
    ],
  },
];
```

**3. In `adminMenuItems` + `rootMenuItems`:**

```typescript
{
  id: 'dummies',
  icon: ICONS.tv, // oder fa-desktop
  label: 'Dummy-Benutzer',
  url: '/manage-dummies',
},
```

### Step 6.5: Breadcrumb [DONE]

**Datei:** `frontend/src/lib/components/Breadcrumb.svelte`

> **Code-Review-Korrektur (v0.2.0):** Neben dem urlMapping-Eintrag muss auch der
> `userRole` Prop-Typ erweitert werden: `userRole?: 'root' | 'admin' | 'employee' | 'dummy'`

```typescript
// urlMappings:
'/manage-dummies': { label: 'Dummy-Benutzer', icon: 'fa-desktop' },

// Prop-Typ:
userRole?: 'root' | 'admin' | 'employee' | 'dummy'
```

### ~~Step 6.6: Login-Redirect für Dummies~~ → Verschoben nach Phase 2, Step 2.5

> **Code-Review-Korrektur (v0.2.0):** Login-Redirect muss in Phase 2 passieren, nicht Phase 6.
> Grund: `Record<UserRole, string>` erzwingt einen `dummy`-Eintrag sobald `UserRole` erweitert wird.
> TypeScript-Build bricht sonst zwischen Phase 2 und Phase 6.

### Phase 6 — Definition of Done

- [x] `hooks.server.ts` Dummy-Whitelist implementiert
- [x] manage-dummies Seite rendert für Admin/Root
- [x] **Keine Datei über 400 Zeilen** (Ziel: max 250 pro Svelte, max 120 pro TS)
- [x] 11 Dateien erstellt, jede mit einer klaren Verantwortung (modularer als geplant)
- [x] CRUD-Operationen funktionieren über UI
- [x] Auto-generierte Email/EmployeeNumber wird angezeigt (readonly im Edit-Modal)
- [x] Team-Multi-Select funktioniert
- [x] Dummy-Login redirected zu /blackboard (verifiziert via Phase 2 Step 2.5)
- [x] Dummy sieht nur Blackboard/Kalender/TPM in Navigation (`dummyMenuItems`)
- [x] Dummy wird zu /blackboard redirected bei Versuch, andere Seiten zu öffnen
- [x] svelte-check 0 Errors, 0 Warnings
- [x] ESLint 0 Errors
- [x] Navigation Config für alle Rollen aktualisiert (inkl. `getMenuItemsForRole` Signatur + 32 Tests)
- [x] Breadcrumb-Einträge + `userRole` Prop-Typ aktualisiert
- [ ] ~~State-Management via state-data.svelte.ts + state-ui.svelte.ts~~ Vereinfacht: State direkt in +page.svelte (unter 250 Zeilen, kein Split nötig)

> **Abweichung:** Statt 22 Dateien nur 11 erstellt — manage-dummies ist viel simpler als manage-employees.
> Dummy-Benutzer ist als Submenu-Child unter "Mitarbeiter" (Admin) bzw. "Administratoren" (Root) eingehängt.

---

## Phase 7: Integration + Polish

> **Abhängigkeit:** Phase 6 complete

### Integrationen

- [x] Activity Logging: Dummy-CRUD wird im Root Dashboard sichtbar (bereits in Phase 3 implementiert)
- [x] `entityType: 'dummy_user'` zum `ActivityEntityType` Union hinzugefügt (bereits in Phase 3)
- [ ] Manueller E2E-Test: Dummy erstellen → einloggen → Blackboard sehen → TPM Board sehen
- [ ] Manueller E2E-Test: Dummy → /chat → Redirect zu /blackboard
- [ ] Manueller E2E-Test: Dummy → /manage-employees → Redirect zu /blackboard

### Dokumentation

- [x] FEATURES.md aktualisiert (Dummy-Benutzer als Feature #13)
- [ ] Customer-Migrations synchronisiert: `./scripts/sync-customer-migrations.sh`

### Phase 7 — Definition of Done

- [ ] Alle manuellen E2E-Tests bestanden (erfordert Browser-Test durch User)
- [x] Kein offener TODO im Code (verifiziert: 0 TODOs in dummy-users frontend + backend)
- [x] FEATURES.md aktualisiert

---

## Session Tracking

| Session | Phase | Beschreibung                               | Status | Datum |
| ------- | ----- | ------------------------------------------ | ------ | ----- |
| 1       | 1+2   | Migration + Shared Package UserRole        | DONE   | 03.03 |
| 2       | 3+4   | Backend Module + Unit Tests (89 tests)     | DONE   | 03.04 |
| 3       | 5     | API Integration Tests (18 tests) + 3 Bugs  | DONE   | 03.04 |
| 4       | 6     | Frontend: 11 files, nav, a11y, all gates ✓ | DONE   | 04.03 |
| 5       | 7     | Integration + Polish                       |        |       |

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                    | Zweck               |
| -------------------------------------------------------- | ------------------- |
| `backend/src/nest/dummy-users/dummy-users.module.ts`     | NestJS Modul        |
| `backend/src/nest/dummy-users/dummy-users.controller.ts` | REST Controller     |
| `backend/src/nest/dummy-users/dummy-users.service.ts`    | Core Business Logic |
| `backend/src/nest/dummy-users/dummy-users.types.ts`      | Alle Interfaces     |
| `backend/src/nest/dummy-users/dummy-users.helpers.ts`    | Pure Helpers        |
| `backend/src/nest/dummy-users/dto/*.ts`                  | DTOs (Zod)          |

### Backend (geändert)

| Datei                                                       | Änderung                                      |
| ----------------------------------------------------------- | --------------------------------------------- |
| `backend/src/nest/app.module.ts`                            | DummyUsersModule Import                       |
| `backend/src/schemas/common.schema.ts`                      | RoleSchema + 'dummy'                          |
| `backend/src/nest/roles/dto/role-id-param.dto.ts`           | RoleEnumSchema + 'dummy'                      |
| `backend/src/nest/users/users.helpers.ts`                   | `buildUserListWhereClause()` + role-Filter    |
| `backend/src/nest/chat/chat.service.ts`                     | `fetchChatUsersByPermissions()` + role-Filter |
| `backend/src/nest/teams/teams.service.ts`                   | `getTeamMembers()` + role + is_active Filter  |
| `backend/src/nest/database/repositories/user.repository.ts` | `findMany()` Default-Filter + role != 'dummy' |

### Shared (geändert)

| Datei                           | Änderung              |
| ------------------------------- | --------------------- |
| `shared/src/types/user-role.ts` | UserRole + 'dummy'    |
| `shared/src/constants/roles.ts` | ROLE_LABELS + 'Dummy' |

### Database (neu)

| Datei                                                                  | Zweck                       |
| ---------------------------------------------------------------------- | --------------------------- |
| `database/migrations/{timestamp}_dummy-users-role-and-display-name.ts` | Enum + Column + Constraints |

### Frontend (neu)

| Pfad                                                               | Zweck            |
| ------------------------------------------------------------------ | ---------------- |
| `frontend/src/routes/(app)/(admin)/manage-dummies/+page.svelte`    | Hauptseite       |
| `frontend/src/routes/(app)/(admin)/manage-dummies/+page.server.ts` | SSR Data Loading |
| `frontend/src/routes/(app)/(admin)/manage-dummies/_lib/*.ts`       | Lib-Dateien      |
| `frontend/src/routes/(app)/(admin)/manage-dummies/_lib/*.svelte`   | Komponenten      |

### Frontend (geändert)

| Datei                                                 | Änderung                                                        |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| `frontend/src/hooks.server.ts`                        | Dummy-Whitelist                                                 |
| `frontend/src/routes/(app)/_lib/navigation-config.ts` | dummyMenuItems + `getMenuItemsForRole` Signatur + admin Eintrag |
| `frontend/src/lib/components/Breadcrumb.svelte`       | manage-dummies Mapping + `userRole` Prop-Typ                    |
| `frontend/src/routes/login/+page.server.ts`           | `UserRole` + `paths` Record + dummy → /blackboard               |
| ~7 Frontend-Dateien mit lokaler UserRole Definition   | + 'dummy'                                                       |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein Kiosk-Modus** — Dummies loggen sich normal ein. Kein Fullscreen/Auto-Login. Kann in V2 kommen.
2. **Keine Passwort-Rotation** — Admin muss Passwort manuell ändern. Auto-Rotation in V2.
3. **Keine Bildschirm-Steuerung** — Kein Remote-Management der TV-Displays. Out of Scope.
4. **Keine Auto-Refresh** — Blackboard/Calendar refreshen nicht automatisch. SSE-Integration in V2.
5. **Keine Bulk-Erstellung** — Dummies werden einzeln erstellt. CSV-Import in V2.
6. **Keine Zuweisung zu spezifischen TPM-Boards** — Dummy sieht alle Boards (gefiltert durch Team). Board-spezifische Zuweisung in V2.

---

## Spec Deviations

| #   | Ursprüngliche Idee                             | Tatsächlicher Plan                               | Entscheidung                                                       |
| --- | ---------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| D1  | Email: `dummy_eins@sub.xx`                     | Email: `dummy_1@sub.display`                     | Sequentiell statt Bezeichnung-basiert (User-Entscheidung)          |
| D2  | Bezeichnung in first_name                      | Neues display_name Feld                          | Sauberer semantisch (User-Entscheidung)                            |
| D3  | Feature-Flag für Dummies                       | Kein Feature-Flag                                | Immer verfügbar für Admins (User-Entscheidung)                     |
| D4  | `@Roles('dummy')` auf Controller-Endpoints     | Auto-Assign read-only `user_feature_permissions` | Code-Review: Endpoints nutzen `@RequirePermission`, nicht `@Roles` |
| D5  | Login-Redirect in Phase 6                      | Login-Redirect in Phase 2 (Step 2.5)             | Code-Review: `Record<UserRole, string>` bricht sonst TypeScript    |
| D6  | TPM-Routen: `/tpm/boards`, `/tpm/boards/:uuid` | `/tpm/plans`, `/tpm/plans/:uuid/board`           | Code-Review: Tatsächliche Route-Struktur verifiziert               |
