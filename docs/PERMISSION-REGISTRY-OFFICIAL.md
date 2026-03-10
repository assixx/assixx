# Permission Registry — Official Reference

> **Version:** 1.4.0
> **Erstellt:** 2026-03-09
> **Letzte Aktualisierung:** 2026-03-09
> **Letzte Verifizierung:** 2026-03-09 (gegen Code + DB + 41 Controller)
> **Status:** VERIFIZIERT
> **Quelle:** Code-Analyse `backend/src/nest/*/\*.permissions.ts` + DB `user_feature_permissions` + alle 41 Controller
> **Zweck:** Single Source of Truth für Permission-Architektur — verhindert Regression

---

## Changelog

| Version | Datum      | Änderung                                                                                                                                                                                                                                                                                                                                            |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.4.0   | 2026-03-09 | Phase 3: 5 neue Features in DB + 5 neue Kategorien + 9 Module. `assets` (2 Module), `reports` (2 Module), `audit_trail` (3 Module), `notifications` (1 Modul), `dummy_users` (1 Modul). 12 Endpoints mit `@RequirePermission` nachgerüstet. Migration erstellt Features + Plan/Tenant-Mappings + Admin-Permission-Rows                              |
| 1.3.0   | 2026-03-09 | Phase 1+2: 7 neue Module + 4 neue Kategorien. TPM: `tpm-config`, `tpm-locations` (eigene Module statt Borgen). Shifts: `shift-times` + `@TenantFeature`. Neue Kategorien: `employees` (2 Module), `departments` (2 Module), `teams` (1 Modul), `settings` (1 Modul). 6 Controller mit `@RequirePermission` nachgerüstet. 2 Datenmigrations erstellt |
| 1.2.0   | 2026-03-09 | Audit Trail implementiert (`UserPermissionsService` → `ActivityLoggerService`). Orphans bewusst behalten (TODO in `.permissions.ts`). `PERMISSION-AUDIT-FINDINGS.md` gelöscht — dieses Dokument ist jetzt die einzige Quelle                                                                                                                        |
| 1.1.0   | 2026-03-09 | B1-B4 gefixt: `allowedPermissions` korrigiert in kvp, vacation, shifts. Type-Check + ESLint: 0 Errors                                                                                                                                                                                                                                               |
| 1.0.0   | 2026-03-09 | Initial — vollständige Verifizierung gegen Code, DB und alle 41 Controller. 4 Bugs, 2 Orphans, 3 Audit-Doc-Fehler dokumentiert                                                                                                                                                                                                                      |

> **Versionierungsregel:**
>
> - `1.x.0` = Neue Kategorie/Modul hinzugefügt oder Bug gefixt
> - `1.x.1` = Korrektur an Dokumentation ohne Code-Änderung
> - `2.0.0` = Nächster Major-Audit (alle Controller erneut verifiziert)

---

## Architektur-Übersicht

### Guard-Kette (Reihenfolge)

```
Request → JwtAuthGuard → RolesGuard → TenantFeatureGuard → PermissionGuard → Controller
```

### Zwei-Schichten-Modell

| Schicht      | Decorator                                     | Guard                | Prüft                                            | Bypass?                                            |
| ------------ | --------------------------------------------- | -------------------- | ------------------------------------------------ | -------------------------------------------------- |
| Tenant-Level | `@TenantFeature('code')`                      | `TenantFeatureGuard` | Feature für Tenant aktiviert + nicht abgelaufen? | **Kein Bypass** — Billing-Entscheidung             |
| User-Level   | `@RequirePermission(feature, module, action)` | `PermissionGuard`    | Hat dieser User die Boolean-Flag?                | `hasFullAccess=true` (Root immer, Admin per Grant) |

### Verhalten ohne Decorator

- **Kein `@RequirePermission`:** Endpoint offen für jeden authentifizierten User (nach JWT + Role + TenantFeature)
- **`@RequirePermission` ohne DB-Row:** DENIED (fail-closed)
- **`@RequirePermission` mit DB-Row aber `false`:** DENIED

---

## 1. Registrierte Kategorien (19) — IST-Zustand

### 1.1 `blackboard` — Schwarzes Brett

| #   | Module-Code           | Label      | Icon           | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | --------------------- | ---------- | -------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `blackboard-posts`    | Beiträge   | fa-sticky-note |    R    |    W     |     D     |          12          |
| 2   | `blackboard-comments` | Kommentare | fa-comments    |    R    |    W     |     D     |          6           |
| 3   | `blackboard-archive`  | Archiv     | fa-archive     |    R    |    W     |     —     |          6           |

**Controller:** `BlackboardController` (24 Endpoints) — `@TenantFeature('blackboard')`
**Registrar:** `blackboard-permission.registrar.ts`
**Status:** OK — Registry und Controller stimmen überein

---

### 1.2 `calendar` — Kalender

| #   | Module-Code       | Label   | Icon            | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ----------------- | ------- | --------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `calendar-events` | Termine | fa-calendar-day |    R    |    W     |     D     |          14          |

**Controller:** `CalendarController` (14 Endpoints) — `@TenantFeature('calendar')`
**Registrar:** `calendar-permission.registrar.ts`
**Status:** OK

---

### 1.3 `chat` — Chat

| #   | Module-Code          | Label       | Icon            | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | -------------------- | ----------- | --------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `chat-conversations` | Gespräche   | fa-comment-dots |    R    |    W     |     D     |          10          |
| 2   | `chat-messages`      | Nachrichten | fa-envelope     |    R    |    W     |     D     |          16          |

**Controller:** `ChatController` (26 Endpoints) — `@TenantFeature('chat')`
**Registrar:** `chat-permission.registrar.ts`
**Status:** OK

---

### 1.4 `documents` — Dokumente

| #   | Module-Code         | Label     | Icon        | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ------------------- | --------- | ----------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `documents-files`   | Dokumente | fa-file-alt |    R    |    W     |     D     |          16          |
| 2   | `documents-archive` | Archiv    | fa-archive  |    R    |    W     |     —     |          6           |

**Controller:** `DocumentsController` (22 Endpoints) — `@TenantFeature('documents')`
**Registrar:** `documents-permission.registrar.ts`
**Status:** OK

---

### 1.5 `kvp` — KVP

| #   | Module-Code       | Label      | Icon         | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ----------------- | ---------- | ------------ | :-----: | :------: | :-------: | :------------------: |
| 1   | `kvp-suggestions` | Vorschläge | fa-lightbulb |    R    |    W     |     D     |          18          |
| 2   | `kvp-comments`    | Kommentare | fa-comments  |    R    |    W     |     D     |          5           |

**Controller:** `KvpController` (27 Endpoints) — `@TenantFeature('kvp')`
**Registrar:** `kvp-permission.registrar.ts`
**Status:** OK — ~~BUG B1~~ GEFIXT (v1.1.0): `canDelete` zu `kvp-comments.allowedPermissions` hinzugefügt

---

### 1.6 `shift_planning` — Schichtplanung

| #   | Module-Code      | Label         | Icon            | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ---------------- | ------------- | --------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `shift-plan`     | Schichtplan   | fa-calendar-alt |    R    |    W     |     D     |          28          |
| 2   | `shift-swap`     | Tauschbörse   | fa-exchange-alt |    R    |    W     |     —     |          6           |
| 3   | `shift-rotation` | Rotation      | fa-sync-alt     |    R    |    W     |     D     |          18          |
| 4   | `shift-times`    | Schichtzeiten | fa-clock        |    R    |    W     |     —     |          4           |

**Controller:** `ShiftsController` (28), `RotationController` (18), `ShiftTimesController` (4) — alle `@TenantFeature('shift_planning')`
**Registrar:** `shifts-permission.registrar.ts`
**Status:** OK — ~~BUG B4~~ GEFIXT (v1.1.0). ~~LÜCKE L1~~ GEFIXT (v1.3.0): `ShiftTimesController` hat jetzt `@TenantFeature` + `@RequirePermission`

---

### 1.7 `surveys` — Umfragen

| #   | Module-Code           | Label      | Icon               | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | --------------------- | ---------- | ------------------ | :-----: | :------: | :-------: | :------------------: |
| 1   | `surveys-manage`      | Verwaltung | fa-poll            |    R    |    W     |     D     |          8           |
| 2   | `surveys-participate` | Teilnahme  | fa-clipboard-check |    R    |    W     |     —     |          3           |
| 3   | `surveys-results`     | Ergebnisse | fa-chart-bar       |    R    |    —     |     —     |          3           |

**Controller:** `SurveysController` (14 Endpoints) — `@TenantFeature('surveys')`
**Registrar:** `surveys-permission.registrar.ts`
**Status:** OK

---

### 1.8 `tpm` — TPM / Wartung

| #   | Module-Code      | Label          | Icon              | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ---------------- | -------------- | ----------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `tpm-plans`      | Wartungspläne  | fa-clipboard-list |    R    |    W     |     D     |          17          |
| 2   | `tpm-cards`      | Wartungskarten | fa-th             |    R    |    W     |     D     |          9           |
| 3   | `tpm-executions` | Durchführungen | fa-check-circle   |    R    |    W     |     —     |          11          |
| 4   | `tpm-config`     | Konfiguration  | fa-cogs           |    R    |    W     |     —     |          14          |
| 5   | `tpm-locations`  | Standorte      | fa-map-marker-alt |    R    |    W     |     D     |          7           |

**Controller:** `TpmPlansController` (17), `TpmCardsController` (9), `TpmExecutionsController` (11), `TpmConfigController` (14), `TpmLocationsController` (7) — alle `@TenantFeature('tpm')`
**Registrar:** `tpm-permission.registrar.ts`
**Status:** OK — ~~LÜCKE L2~~ GEFIXT (v1.3.0): `tpm-config` eigenes Modul. ~~LÜCKE L3~~ GEFIXT (v1.3.0): `tpm-locations` eigenes Modul. Datenmigration kopiert bestehende Rechte

---

### 1.9 `vacation` — Urlaubsverwaltung

| #   | Module-Code             | Label                | Icon            | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ----------------------- | -------------------- | --------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `vacation-requests`     | Urlaubsanträge       | fa-file-alt     |    R    |    W     |     D     |          6           |
| 2   | `vacation-rules`        | Regeln & Sperren     | fa-ban          |    R    |    W     |     D     |          5           |
| 3   | `vacation-entitlements` | Urlaubsansprüche     | fa-calculator   |    R    |    W     |     D     |          5           |
| 4   | `vacation-holidays`     | Feiertage            | fa-calendar-day |    R    |    W     |     D     |          5           |
| 5   | `vacation-overview`     | Übersicht & Kalender | fa-chart-bar    |    R    |    —     |     —     |          6           |

**Controller:** `VacationController` (29 Endpoints) — `@TenantFeature('vacation')`
**Registrar:** `vacation-permission.registrar.ts`
**Status:** ~~BUG B2+B3~~ GEFIXT (v1.1.0): `canDelete` zu `vacation-requests` und `vacation-entitlements` hinzugefügt

> **HINWEIS:** VacationController ruft redundant `FeatureCheckService.checkTenantAccess()` in jedem Endpoint auf, obwohl `@TenantFeature('vacation')` bereits auf Klasse gesetzt ist.

---

### 1.10 `work_orders` — Arbeitsaufträge

| #   | Module-Code           | Label              | Icon      | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | --------------------- | ------------------ | --------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `work-orders-manage`  | Aufträge verwalten | fa-tasks  |    R    |    W     |     D     |          8           |
| 2   | `work-orders-execute` | Aufträge ausführen | fa-wrench |    R    |    W     |     —     |          14          |

**Controller:** `WorkOrdersController` (22 Endpoints, nicht 17 wie Code-Kommentar sagt) — `@TenantFeature('work_orders')`
**Registrar:** `work-orders-permission.registrar.ts`
**Status:** OK

---

### 1.11 `employees` — Mitarbeiterverwaltung

| #   | Module-Code              | Label              | Icon          | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ------------------------ | ------------------ | ------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `employees-manage`       | Benutzer verwalten | fa-user-edit  |    R    |    W     |     D     |          12          |
| 2   | `employees-availability` | Verfügbarkeit      | fa-user-clock |    R    |    W     |     D     |          5           |

**Controller:** `UsersController` (27 Endpoints, davon 17 admin-only mit `@RequirePermission`, 10 Self-Service ohne Guard) — `@TenantFeature('employees')` (auf Klasse, sofern Feature aktiviert)
**Registrar:** `users-permission.registrar.ts`
**Status:** NEU (v1.3.0) — Self-Service Endpoints (`/me/*`) haben bewusst KEIN `@RequirePermission`

---

### 1.12 `departments` — Abteilungen & Bereiche

| #   | Module-Code          | Label                 | Icon        | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | -------------------- | --------------------- | ----------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `departments-manage` | Abteilungen verwalten | fa-building |    —    |    W     |     D     |          3           |
| 2   | `areas-manage`       | Bereiche verwalten    | fa-map      |    —    |    W     |     D     |          4           |

**Controller:** `DepartmentsController` (7 Endpoints, davon 3 admin-only), `AreasController` (7 Endpoints, davon 4 admin-only) — `@TenantFeature('departments')` (sofern aktiviert)
**Registrar:** `departments-permission.registrar.ts`
**Status:** NEU (v1.3.0) — GET-Endpoints offen für alle auth. User (kein canRead nötig, da Lesezugriff für Org-Daten Standard)

---

### 1.13 `teams` — Teams

| #   | Module-Code    | Label           | Icon            | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | -------------- | --------------- | --------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `teams-manage` | Teams verwalten | fa-people-group |    —    |    W     |     D     |          6           |

**Controller:** `TeamsController` (13 Endpoints, davon 6 admin-only) — `@TenantFeature('teams')` (sofern aktiviert)
**Registrar:** `teams-permission.registrar.ts`
**Status:** NEU (v1.3.0) — GET-Endpoints offen für alle auth. User

---

### 1.14 `settings` — Einstellungen

| #   | Module-Code       | Label                   | Icon         | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ----------------- | ----------------------- | ------------ | :-----: | :------: | :-------: | :------------------: |
| 1   | `settings-tenant` | Mandanten-Einstellungen | fa-sliders-h |    —    |    W     |     D     |          3           |

**Controller:** `SettingsController` (18 Endpoints, davon 3 tenant-admin mit `@RequirePermission`) — System-Settings sind root-only via `@Roles`, User-Settings sind Self-Service
**Registrar:** `settings-permission.registrar.ts`
**Status:** NEU (v1.3.0) — Nur Tenant-Settings brauchen Permission (System=root-only, User=Self-Service)

---

## 2. Orphaned DB-Daten (Registry kennt sie nicht)

| #   | feature_code | module_code   | In DB | In Registry | Status                                                              |
| --- | ------------ | ------------- | :---: | :---------: | ------------------------------------------------------------------- |
| O1  | `kvp`        | `kvp-reviews` |  Ja   |  **NEIN**   | Bewusst behalten — TODO in `kvp.permissions.ts` für spätere Nutzung |
| O2  | `tpm`        | `tpm-reports` |  Ja   |  **NEIN**   | Bewusst behalten — TODO in `tpm.permissions.ts` für spätere Nutzung |

**Status:** DB-Rows bleiben erhalten für zukünftige Implementierung. TODOs in den jeweiligen `.permissions.ts` Dateien dokumentieren die geplante Aufnahme.

---

## 3. Bugs — Registry vs. Controller Mismatch

| #      | Severity   | Module                  | Registry erlaubt   | Controller nutzt | Betroffene Endpoints                                  | Impact            |
| ------ | ---------- | ----------------------- | ------------------ | ---------------- | ----------------------------------------------------- | ----------------- |
| **B1** | ~~HIGH~~   | `kvp-comments`          | ~~R, W~~ → R, W, D | R, W, **D**      | `DELETE kvp/uuid/:uuid/comments/:commentId`           | **GEFIXT v1.1.0** |
| **B2** | ~~HIGH~~   | `vacation-requests`     | ~~R, W~~ → R, W, D | R, W, **D**      | `DELETE vacation/requests/:uuid`                      | **GEFIXT v1.1.0** |
| **B3** | ~~MEDIUM~~ | `vacation-entitlements` | ~~R, W~~ → R, W, D | R, W, **D**      | `DELETE vacation/entitlements/:uuid` (+ @Roles admin) | **GEFIXT v1.1.0** |
| **B4** | ~~MEDIUM~~ | `shift-rotation`        | ~~R~~ → R, W, D    | R, **W**, **D**  | 12 Endpoints (POST/PUT/DELETE) (+ @Roles admin)       | **GEFIXT v1.1.0** |

**Root Cause:** Registry's `allowedPermissions` Array war unvollständig. Beim UPSERT wurden fehlende Permissions auf `false` erzwungen.

**Fix (v1.1.0):** `allowedPermissions` in allen 3 `.permissions.ts` Dateien korrigiert. Type-Check + ESLint: 0 Errors.

---

### 1.15 `assets` — Anlagen & Maschinen

| #   | Module-Code           | Label             | Icon     | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | --------------------- | ----------------- | -------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `assets-manage`       | Anlagen verwalten | fa-cog   |    R    |    W     |     D     |          9           |
| 2   | `assets-availability` | Verfügbarkeit     | fa-clock |    R    |    W     |     D     |          4           |

**Controller:** `AssetsController` (22 Endpoints, davon 13 admin-only mit `@RequirePermission`, 9 Lese-Endpoints offen) — `@Roles('admin','root')` auf Schreib-Endpoints
**Registrar:** `assets-permission.registrar.ts`
**Status:** NEU (v1.4.0) — Feature `assets` in DB angelegt, alle Plans + Tenants aktiviert

---

### 1.16 `reports` — Berichte & Auswertungen

| #   | Module-Code      | Label                | Icon           | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ---------------- | -------------------- | -------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `reports-view`   | Berichte einsehen    | fa-chart-bar   |    R    |    —     |     —     |          5           |
| 2   | `reports-export` | Berichte exportieren | fa-file-export |    R    |    W     |     —     |          2           |

**Controller:** `ReportsController` (7 Endpoints, alle admin-only) — `@Roles('admin','root')` auf Klasse
**Registrar:** `reports-permission.registrar.ts`
**Status:** NEU (v1.4.0)

---

### 1.17 `audit_trail` — Protokoll & Audit

| #   | Module-Code       | Label                  | Icon           | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ----------------- | ---------------------- | -------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `audit-view`      | Statistiken einsehen   | fa-chart-pie   |    R    |    —     |     —     |          1           |
| 2   | `audit-export`    | Berichte & Export      | fa-file-export |    R    |    W     |     —     |          2           |
| 3   | `audit-retention` | Aufbewahrung verwalten | fa-trash-alt   |    R    |    —     |     D     |          1           |

**Controller:** `AuditTrailController` (6 Endpoints, davon 4 admin/root-only mit `@RequirePermission`, 2 offen für alle auth. User)
**Registrar:** `audit-trail-permission.registrar.ts`
**Status:** NEU (v1.4.0) — GET /audit-trail und GET /audit-trail/:id bleiben offen (Self-Service)

---

### 1.18 `notifications` — Benachrichtigungen

| #   | Module-Code            | Label                        | Icon    | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | ---------------------- | ---------------------------- | ------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `notifications-manage` | Benachrichtigungen verwalten | fa-bell |    R    |    W     |     —     |          3           |

**Controller:** `NotificationsController` (15 Endpoints, davon 3 admin-only mit `@RequirePermission`, 12 Self-Service)
**Registrar:** `notifications-permission.registrar.ts`
**Status:** NEU (v1.4.0) — Nur createNotification, getStatistics, getStreamStats sind admin-guarded

---

### 1.19 `dummy_users` — Platzhalter-Benutzer

| #   | Module-Code          | Label                 | Icon          | canRead | canWrite | canDelete | Controller-Endpoints |
| --- | -------------------- | --------------------- | ------------- | :-----: | :------: | :-------: | :------------------: |
| 1   | `dummy-users-manage` | Platzhalter verwalten | fa-user-slash |    R    |    W     |     D     |          5           |

**Controller:** `DummyUsersController` (5 Endpoints, alle admin-only) — `@Roles('admin','root')` + `@UseGuards(RolesGuard)` auf Klasse
**Registrar:** `dummy-users-permission.registrar.ts`
**Status:** NEU (v1.4.0)

---

## 5. Zukünftige Modul-Erweiterungen (bestehende Kategorien)

### TPM — noch fehlende Module

```
tpm-reports:   Auswertungen   (R)         ← Daten existieren in DB (Orphan O2), kein Controller
tpm-templates: Vorlagen       (R, W, D)   ← Service existiert, kein Controller
```

> `tpm-config` und `tpm-locations` wurden in v1.3.0 implementiert (siehe Sektion 1.8)

---

## 6. Features-Tabelle vs. Permission-Kategorien

| #   | Feature (DB)            | `features.code`  | Permission-Kategorie | Status                        |
| --- | ----------------------- | ---------------- | -------------------- | ----------------------------- |
| 1   | Anlagen & Maschinen     | `assets`         | `assets`             | Registriert (v1.4.0)          |
| 2   | Protokoll & Audit       | `audit_trail`    | `audit_trail`        | Registriert (v1.4.0)          |
| 3   | Schwarzes Brett         | `blackboard`     | `blackboard`         | Registriert                   |
| 4   | Kalender                | `calendar`       | `calendar`           | Registriert                   |
| 5   | Chat                    | `chat`           | `chat`               | Registriert                   |
| 6   | Dashboard               | `dashboard`      | —                    | Kein Guard nötig (jeder User) |
| 7   | Abteilungen             | `departments`    | `departments`        | Registriert (v1.3.0)          |
| 8   | Dokumente               | `documents`      | `documents`          | Registriert                   |
| 9   | Platzhalter-Benutzer    | `dummy_users`    | `dummy_users`        | Registriert (v1.4.0)          |
| 10  | Mitarbeiterverwaltung   | `employees`      | `employees`          | Registriert (v1.3.0)          |
| 11  | KVP                     | `kvp`            | `kvp`                | Registriert                   |
| 12  | Benachrichtigungen      | `notifications`  | `notifications`      | Registriert (v1.4.0)          |
| 13  | Berichte & Auswertungen | `reports`        | `reports`            | Registriert (v1.4.0)          |
| 14  | Einstellungen           | `settings`       | `settings`           | Registriert (v1.3.0)          |
| 15  | Schichtplanung          | `shift_planning` | `shift_planning`     | Registriert                   |
| 16  | Umfragen                | `surveys`        | `surveys`            | Registriert                   |
| 17  | Teams                   | `teams`          | `teams`              | Registriert (v1.3.0)          |
| 18  | TPM / Wartung           | `tpm`            | `tpm`                | Registriert                   |
| 19  | Urlaubsverwaltung       | `vacation`       | `vacation`           | Registriert                   |
| 20  | Arbeitsaufträge         | `work_orders`    | `work_orders`        | Registriert                   |

**Alle 20 Features haben eine Permission-Kategorie** (außer `dashboard`, das keinen Guard braucht).

---

## 7. Controller ohne Permission-Guard (15 von 41)

> **v1.3.0 erledigt:** UsersController, DepartmentsController, AreasController, TeamsController, SettingsController, ShiftTimesController
> **v1.4.0 erledigt:** AssetsController, ReportsController, AuditTrailController, NotificationsController, DummyUsersController

### 7.1 Admin/System — Kein Guard nötig (7 Controller)

| Controller                 | Endpoints | Begründung                            |
| -------------------------- | :-------: | ------------------------------------- |
| RootController             |    27     | Root-only by design                   |
| AdminPermissionsController |    11     | Root-only                             |
| LogsController             |     4     | Root-only                             |
| PlansController            |     8     | SaaS-Plan-Verwaltung (public + admin) |
| RolesController            |     5     | Read-only Metadaten                   |
| RoleSwitchController       |     4     | System-Feature (@Roles admin/root)    |
| FeaturesController         |    11     | Tenant-Feature-Verwaltung             |

### 7.2 Self-Service / Infrastruktur — Kein Guard nötig (8 Controller)

| Controller                | Endpoints | Begründung                               |
| ------------------------- | :-------: | ---------------------------------------- |
| AuthController            |     7     | Public (Login/Logout/Refresh)            |
| SignupController          |     2     | Public (Registrierung)                   |
| DashboardController       |     1     | Jeder eingeloggte User                   |
| MetricsController         |     1     | Prometheus Scraping                      |
| FeatureVisitsController   |     1     | User-Self-Service                        |
| E2eEscrowController       |     3     | Encryption-Infrastruktur                 |
| E2eKeysController         |     5     | Encryption-Infrastruktur                 |
| UserPermissionsController |     2     | Admin-only via @Roles + assertFullAccess |

---

## 8. Zusammenfassung

### Zahlen

| Metrik                              |       IST (v1.4.0)       |
| ----------------------------------- | :----------------------: |
| Registrierte Kategorien             |          **19**          |
| Registrierte Module                 |          **42**          |
| Controller mit Permission-Guard     |          **26**          |
| Bugs (Registry/Controller Mismatch) |          **0**           |
| Orphaned DB-Daten                   | **2** (bewusst behalten) |
| Audit Trail für Permissions         |          **JA**          |

### Prioritäten

| Prio   | Aufgabe                                                         | Status           |
| ------ | --------------------------------------------------------------- | ---------------- |
| ~~P0~~ | ~~B1-B4 fixen: `allowedPermissions` korrigieren~~               | DONE (v1.1.0)    |
| ~~P0~~ | ~~Audit Trail in `UserPermissionsService`~~                     | DONE (v1.2.0)    |
| ~~P0~~ | ~~O1/O2: Orphaned DB-Daten~~                                    | Bewusst behalten |
| ~~P1~~ | ~~TPM: `tpm-config`, `tpm-locations` eigene Module~~            | DONE (v1.3.0)    |
| ~~P1~~ | ~~`shift-times` + `@TenantFeature`~~                            | DONE (v1.3.0)    |
| ~~P1~~ | ~~`employees` Permission-Kategorie (2 Module, 17 Endpoints)~~   | DONE (v1.3.0)    |
| ~~P1~~ | ~~`departments` Permission-Kategorie (2 Module, 7 Endpoints)~~  | DONE (v1.3.0)    |
| ~~P1~~ | ~~`teams` Permission-Kategorie (1 Modul, 6 Endpoints)~~         | DONE (v1.3.0)    |
| ~~P2~~ | ~~`settings` Permission-Kategorie (1 Modul, 3 Endpoints)~~      | DONE (v1.3.0)    |
| ~~P1~~ | ~~`assets` Permission-Kategorie (2 Module, 13 Endpoints)~~      | DONE (v1.4.0)    |
| ~~P2~~ | ~~`reports` Permission-Kategorie (2 Module, 7 Endpoints)~~      | DONE (v1.4.0)    |
| ~~P2~~ | ~~`audit_trail` Permission-Kategorie (3 Module, 4 Endpoints)~~  | DONE (v1.4.0)    |
| ~~P3~~ | ~~`notifications` Permission-Kategorie (1 Modul, 3 Endpoints)~~ | DONE (v1.4.0)    |
| ~~P3~~ | ~~`dummy_users` Permission-Kategorie (1 Modul, 5 Endpoints)~~   | DONE (v1.4.0)    |

### Migrationen

| #   | Datei                                          | Inhalt                                                                                                                         |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `20260309000078_permission-module-split.ts`    | Phase 1: tpm-config, tpm-locations, shift-times — Rechte aus bestehenden Modulen kopiert                                       |
| 2   | `20260309200080_permission-new-categories.ts`  | Phase 2: employees, departments, teams, settings — Alle Admins bekommen volle Rechte                                           |
| 3   | `20260309300081_permission-phase3-features.ts` | Phase 3: 5 neue Features (assets, reports, audit_trail, notifications, dummy_users) + Plan/Tenant-Mappings + Admin-Permissions |
