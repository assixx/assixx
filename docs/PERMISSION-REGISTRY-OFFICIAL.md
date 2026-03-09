# Permission Registry — Official Reference

> **Version:** 1.0.0
> **Erstellt:** 2026-03-09
> **Letzte Verifizierung:** 2026-03-09 (gegen Code + DB + 41 Controller)
> **Status:** VERIFIZIERT
> **Quelle:** Code-Analyse `backend/src/nest/*/\*.permissions.ts` + DB `user_feature_permissions` + alle 41 Controller
> **Zweck:** Single Source of Truth für Permission-Architektur — verhindert Regression

---

## Changelog

| Version | Datum      | Änderung |
|---------|------------|----------|
| 1.0.0   | 2026-03-09 | Initial — vollständige Verifizierung gegen Code, DB und alle 41 Controller. 4 Bugs, 2 Orphans, 3 Audit-Doc-Fehler dokumentiert |

> **Versionierungsregel:**
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

| Schicht | Decorator | Guard | Prüft | Bypass? |
|---------|-----------|-------|-------|---------|
| Tenant-Level | `@TenantFeature('code')` | `TenantFeatureGuard` | Feature für Tenant aktiviert + nicht abgelaufen? | **Kein Bypass** — Billing-Entscheidung |
| User-Level | `@RequirePermission(feature, module, action)` | `PermissionGuard` | Hat dieser User die Boolean-Flag? | `hasFullAccess=true` (Root immer, Admin per Grant) |

### Verhalten ohne Decorator

- **Kein `@RequirePermission`:** Endpoint offen für jeden authentifizierten User (nach JWT + Role + TenantFeature)
- **`@RequirePermission` ohne DB-Row:** DENIED (fail-closed)
- **`@RequirePermission` mit DB-Row aber `false`:** DENIED

---

## 1. Registrierte Kategorien (10) — IST-Zustand

### 1.1 `blackboard` — Schwarzes Brett

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `blackboard-posts` | Beiträge | fa-sticky-note | R | W | D | 12 |
| 2 | `blackboard-comments` | Kommentare | fa-comments | R | W | D | 6 |
| 3 | `blackboard-archive` | Archiv | fa-archive | R | W | — | 6 |

**Controller:** `BlackboardController` (24 Endpoints) — `@TenantFeature('blackboard')`
**Registrar:** `blackboard-permission.registrar.ts`
**Status:** OK — Registry und Controller stimmen überein

---

### 1.2 `calendar` — Kalender

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `calendar-events` | Termine | fa-calendar-day | R | W | D | 14 |

**Controller:** `CalendarController` (14 Endpoints) — `@TenantFeature('calendar')`
**Registrar:** `calendar-permission.registrar.ts`
**Status:** OK

---

### 1.3 `chat` — Chat

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `chat-conversations` | Gespräche | fa-comment-dots | R | W | D | 10 |
| 2 | `chat-messages` | Nachrichten | fa-envelope | R | W | D | 16 |

**Controller:** `ChatController` (26 Endpoints) — `@TenantFeature('chat')`
**Registrar:** `chat-permission.registrar.ts`
**Status:** OK

---

### 1.4 `documents` — Dokumente

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `documents-files` | Dokumente | fa-file-alt | R | W | D | 16 |
| 2 | `documents-archive` | Archiv | fa-archive | R | W | — | 6 |

**Controller:** `DocumentsController` (22 Endpoints) — `@TenantFeature('documents')`
**Registrar:** `documents-permission.registrar.ts`
**Status:** OK

---

### 1.5 `kvp` — KVP

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `kvp-suggestions` | Vorschläge | fa-lightbulb | R | W | D | 18 |
| 2 | `kvp-comments` | Kommentare | fa-comments | R | W | — | 5 |

**Controller:** `KvpController` (27 Endpoints) — `@TenantFeature('kvp')`
**Registrar:** `kvp-permission.registrar.ts`

> **BUG B1:** Controller Endpoint `DELETE kvp/uuid/:uuid/comments/:commentId` nutzt `@RequirePermission('kvp', 'kvp-comments', 'canDelete')`, aber Registry erlaubt nur `canRead`/`canWrite`. Konsequenz: Kommentar-Löschung **unmöglich** für alle User ohne `hasFullAccess`.
> **FIX:** `canDelete` zu `kvp-comments.allowedPermissions` hinzufügen ODER Endpoint auf `canWrite` umstellen.

---

### 1.6 `shift_planning` — Schichtplanung

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `shift-plan` | Schichtplan | fa-calendar-alt | R | W | D | 28 |
| 2 | `shift-swap` | Tauschbörse | fa-exchange-alt | R | W | — | 6 |
| 3 | `shift-rotation` | Rotation | fa-sync-alt | R | — | — | 18 |

**Controller:** `ShiftsController` (28 Endpoints), `RotationController` (18 Endpoints) — `@TenantFeature('shift_planning')`
**Registrar:** `shifts-permission.registrar.ts`

> **BUG B4:** `RotationController` nutzt `canWrite` (8 Endpoints) und `canDelete` (4 Endpoints), aber Registry erlaubt nur `canRead`. Admins ohne `hasFullAccess` können Rotation nicht verwalten.
> **FIX:** `canWrite`/`canDelete` zu `shift-rotation.allowedPermissions` hinzufügen. Alle Write/Delete-Endpoints haben zusätzlich `@Roles('admin', 'root')`, also bleibt Admin-Gating erhalten.

> **LÜCKE L1:** `ShiftTimesController` (4 Endpoints) hat KEIN `@TenantFeature` und KEIN `@RequirePermission` — nur `@Roles`. Nicht feature-gated!

---

### 1.7 `surveys` — Umfragen

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `surveys-manage` | Verwaltung | fa-poll | R | W | D | 8 |
| 2 | `surveys-participate` | Teilnahme | fa-clipboard-check | R | W | — | 3 |
| 3 | `surveys-results` | Ergebnisse | fa-chart-bar | R | — | — | 3 |

**Controller:** `SurveysController` (14 Endpoints) — `@TenantFeature('surveys')`
**Registrar:** `surveys-permission.registrar.ts`
**Status:** OK

---

### 1.8 `tpm` — TPM / Wartung

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `tpm-plans` | Wartungspläne | fa-clipboard-list | R | W | D | 17 + 7 (locations) + 10 (config) |
| 2 | `tpm-cards` | Wartungskarten | fa-th | R | W | D | 9 + 4 (config categories) |
| 3 | `tpm-executions` | Durchführungen | fa-check-circle | R | W | — | 11 |

**Controller:** `TpmPlansController` (17), `TpmCardsController` (9), `TpmExecutionsController` (11), `TpmConfigController` (14), `TpmLocationsController` (7) — alle `@TenantFeature('tpm')`
**Registrar:** `tpm-permission.registrar.ts`

> **LÜCKE L2:** `TpmConfigController` (14 Endpoints) borgt sich `tpm-plans` und `tpm-cards` Permissions — sollte eigenes `tpm-config` Modul haben.
> **LÜCKE L3:** `TpmLocationsController` (7 Endpoints) borgt sich `tpm-plans` Permissions — sollte eigenes `tpm-locations` Modul haben.

---

### 1.9 `vacation` — Urlaubsverwaltung

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `vacation-requests` | Urlaubsanträge | fa-file-alt | R | W | — | 6 |
| 2 | `vacation-rules` | Regeln & Sperren | fa-ban | R | W | D | 5 |
| 3 | `vacation-entitlements` | Urlaubsansprüche | fa-calculator | R | W | — | 5 |
| 4 | `vacation-holidays` | Feiertage | fa-calendar-day | R | W | D | 5 |
| 5 | `vacation-overview` | Übersicht & Kalender | fa-chart-bar | R | — | — | 6 |

**Controller:** `VacationController` (29 Endpoints) — `@TenantFeature('vacation')`
**Registrar:** `vacation-permission.registrar.ts`

> **BUG B2:** `DELETE vacation/requests/:uuid` nutzt `canDelete`, aber Registry erlaubt nur `canRead`/`canWrite`. User können Urlaubsanträge **nicht stornieren**.
> **FIX:** `canDelete` zu `vacation-requests.allowedPermissions` hinzufügen.

> **BUG B3:** `DELETE vacation/entitlements/:uuid` nutzt `canDelete`, aber Registry erlaubt nur `canRead`/`canWrite`. Admins ohne `hasFullAccess` können Ansprüche nicht löschen.
> **FIX:** `canDelete` zu `vacation-entitlements.allowedPermissions` hinzufügen.

> **HINWEIS:** VacationController ruft redundant `FeatureCheckService.checkTenantAccess()` in jedem Endpoint auf, obwohl `@TenantFeature('vacation')` bereits auf Klasse gesetzt ist.

---

### 1.10 `work_orders` — Arbeitsaufträge

| # | Module-Code | Label | Icon | canRead | canWrite | canDelete | Controller-Endpoints |
|---|-------------|-------|------|:-------:|:--------:|:---------:|:--------------------:|
| 1 | `work-orders-manage` | Aufträge verwalten | fa-tasks | R | W | D | 8 |
| 2 | `work-orders-execute` | Aufträge ausführen | fa-wrench | R | W | — | 14 |

**Controller:** `WorkOrdersController` (22 Endpoints, nicht 17 wie Code-Kommentar sagt) — `@TenantFeature('work_orders')`
**Registrar:** `work-orders-permission.registrar.ts`
**Status:** OK

---

## 2. Orphaned DB-Daten (Registry kennt sie nicht)

| # | feature_code | module_code | In DB | In Registry | In Audit-Doc | Aktion |
|---|--------------|-------------|:-----:|:-----------:|:------------:|--------|
| O1 | `kvp` | `kvp-reviews` | Ja | **NEIN** | **NEIN** | Entweder Registry-Modul erstellen oder DB-Rows bereinigen |
| O2 | `tpm` | `tpm-reports` | Ja | **NEIN** | Als NEU vorgeschlagen | Registry-Modul erstellen (Audit doc stimmt hier) |

**Konsequenz Orphans:** Frontend zeigt diese Module nicht an. Bestehende DB-Rows sind tote Daten. PermissionGuard referenziert sie nie, weil kein Controller `@RequirePermission` mit diesen Codes nutzt.

---

## 3. Bugs — Registry vs. Controller Mismatch

| # | Severity | Module | Registry erlaubt | Controller nutzt | Betroffene Endpoints | Impact |
|---|----------|--------|------------------|------------------|----------------------|--------|
| **B1** | HIGH | `kvp-comments` | R, W | R, W, **D** | `DELETE kvp/uuid/:uuid/comments/:commentId` | Kommentare unlöschbar |
| **B2** | HIGH | `vacation-requests` | R, W | R, W, **D** | `DELETE vacation/requests/:uuid` | Urlaubsanträge nicht stornierbar |
| **B3** | MEDIUM | `vacation-entitlements` | R, W | R, W, **D** | `DELETE vacation/entitlements/:uuid` (+ @Roles admin) | Admin-Funktion blockiert |
| **B4** | MEDIUM | `shift-rotation` | R | R, **W**, **D** | 12 Endpoints (POST/PUT/DELETE) (+ @Roles admin) | Rotation-Verwaltung nur für fullAccess |

**Root Cause:** Registry's `allowedPermissions` Array ist unvollständig. Beim UPSERT werden fehlende Permissions auf `false` erzwungen. Controller-Endpoints prüfen gegen DB → immer `false` → immer `ForbiddenException`.

**Warum Root/fullAccess nicht betroffen:** `PermissionGuard` prüft `user.hasFullAccess === true` VOR der DB-Abfrage und gibt sofort `true` zurück.

---

## 4. Fehlende Permission-Kategorien (8 vorgeschlagen)

### Priorität P1 — Sicherheitskritisch

#### 4.1 `assets` — Anlagen & Maschinen

```
Code:    assets
Label:   Anlagen & Maschinen
Icon:    fa-industry
Module:
  - assets-manage:       Anlagenverwaltung        (R, W, D)
  - assets-availability: Verfügbarkeit             (R, W)
  - assets-maintenance:  Wartungshistorie          (R, W)
  - assets-teams:        Team-Zuordnung            (R, W, D)
```

**Controller:** `AssetsController` (22 Endpoints)
**Aktueller Schutz:** `@Roles('admin','root')` auf Schreib-Endpoints, JWT auf Lese-Endpoints

#### 4.2 `organization` — Bereiche, Abteilungen, Teams

```
Code:    organization
Label:   Organisation
Icon:    fa-sitemap
Module:
  - org-areas:           Bereiche                  (R, W, D)
  - org-departments:     Abteilungen               (R, W, D)
  - org-teams:           Teams                     (R, W, D)
  - org-team-members:    Teammitglieder            (R, W, D)
```

**Controller:** `AreasController` (7), `DepartmentsController` (7), `TeamsController` (13)
**Aktueller Schutz:** `@Roles('admin','root')` auf Schreib-Endpoints, JWT auf Lese-Endpoints

#### 4.3 `users` — Benutzerverwaltung

```
Code:    users
Label:   Benutzerverwaltung
Icon:    fa-users-cog
Module:
  - users-manage:        Benutzer verwalten        (R, W, D)
  - users-availability:  Verfügbarkeit             (R, W)
```

**Controller:** `UsersController` (27 Endpoints)
**Aktueller Schutz:** `@Roles('admin','root')` auf Verwaltungs-Endpoints, JWT auf Self-Service

### Priorität P2 — Betriebsrelevant

#### 4.4 `reports` — Berichte & Auswertungen

```
Code:    reports
Label:   Berichte
Icon:    fa-chart-line
Module:
  - reports-view:        Berichte einsehen         (R)
  - reports-export:      Berichte exportieren      (R, W)
```

**Controller:** `ReportsController` (7 Endpoints)
**Aktueller Schutz:** `@Roles('admin','root')` auf Klasse

#### 4.5 `settings` — Einstellungen

```
Code:    settings
Label:   Einstellungen
Icon:    fa-cog
Module:
  - settings-tenant:     Mandanten-Einstellungen   (R, W)
```

**Controller:** `SettingsController` (18 Endpoints)
**Aktueller Schutz:** Gemischt (root/admin/alle)

#### 4.6 `audit_trail` — Protokoll

```
Code:    audit_trail
Label:   Protokoll & Audit
Icon:    fa-history
Module:
  - audit-view:          Protokoll einsehen        (R)
  - audit-export:        Protokoll exportieren     (R, W)
  - audit-retention:     Aufbewahrung verwalten    (R, D)
```

**Controller:** `AuditTrailController` (6 Endpoints)
**Aktueller Schutz:** `@Roles('admin','root')` auf Stats/Export/Retention, **JWT-only auf GET** (jeder User sieht Audit!)

### Priorität P3 — Nice to Have

#### 4.7 `notifications` — Benachrichtigungen

```
Code:    notifications
Label:   Benachrichtigungen
Icon:    fa-bell
Module:
  - notifications-manage: Benachrichtigungen senden (R, W)
```

**Controller:** `NotificationsController` (15 Endpoints)
**Aktueller Schutz:** JWT + `@Roles('admin','root')` auf Admin-Endpoints

#### 4.8 `dummy_users` — Platzhalter-Benutzer

```
Code:    dummy_users
Label:   Platzhalter-Benutzer
Icon:    fa-user-slash
Module:
  - dummy-users-manage:  Platzhalter verwalten     (R, W, D)
```

**Controller:** `DummyUsersController` (5 Endpoints)
**Aktueller Schutz:** `@Roles('admin','root')` auf Klasse

---

## 5. TPM-Erweiterungen (bestehende Kategorie)

```
Code:    tpm  (bestehend — Module ergänzen)

Module (bestehend):
  - tpm-plans:           Wartungspläne             (R, W, D)   ✓
  - tpm-cards:           Wartungskarten            (R, W, D)   ✓
  - tpm-executions:      Durchführungen            (R, W)      ✓

Module (NEU):
  - tpm-config:          Konfiguration             (R, W)      ← aktuell borgt von tpm-plans/tpm-cards
  - tpm-locations:       Standorte                 (R, W, D)   ← aktuell borgt von tpm-plans
  - tpm-reports:         Auswertungen              (R)          ← Daten existieren bereits in DB!
  - tpm-templates:       Vorlagen                  (R, W, D)   ← Service existiert, kein Controller
```

---

## 6. Schichtplanung-Erweiterung

```
Code:    shift_planning  (bestehend — Modul ergänzen)

Module (bestehend):
  - shift-plan:          Schichtplan               (R, W, D)   ✓
  - shift-swap:          Tauschbörse               (R, W)      ✓
  - shift-rotation:      Rotation                  (R)          ← BUG B4: braucht R, W, D

Module (NEU):
  - shift-times:         Schichtzeiten             (R, W)      ← ShiftTimesController: kein Guard!
```

---

## 7. Features-Tabelle vs. Permission-Kategorien

| # | Feature (DB) | `features.code` | Permission-Kategorie | Status |
|---|-------------|-----------------|---------------------|--------|
| 1 | Schwarzes Brett | `blackboard` | `blackboard` | Registriert |
| 2 | Kalender | `calendar` | `calendar` | Registriert |
| 3 | Chat | `chat` | `chat` | Registriert |
| 4 | Dashboard | `dashboard` | — | Kein Guard nötig (jeder User) |
| 5 | Abteilungen | `departments` | `organization` (vorgeschlagen) | **FEHLT** |
| 6 | Dokumente | `documents` | `documents` | Registriert |
| 7 | Mitarbeiterverwaltung | `employees` | `users` (vorgeschlagen) | **FEHLT** |
| 8 | KVP | `kvp` | `kvp` | Registriert |
| 9 | Einstellungen | `settings` | `settings` (vorgeschlagen) | **FEHLT** |
| 10 | Schichtplanung | `shift_planning` | `shift_planning` | Registriert |
| 11 | Umfragen | `surveys` | `surveys` | Registriert |
| 12 | Teams | `teams` | `organization` (vorgeschlagen) | **FEHLT** |
| 13 | TPM / Wartung | `tpm` | `tpm` | Registriert |
| 14 | Urlaubsverwaltung | `vacation` | `vacation` | Registriert |
| 15 | Arbeitsaufträge | `work_orders` | `work_orders` | Registriert |

**Hinweis:** `assets`, `reports`, `audit_trail`, `notifications`, `dummy_users` sind in den Vorschlägen für neue Kategorien, existieren aber NICHT als Feature in der `features`-Tabelle. Für Permission-Guards müssen entweder:
- Neue Features in `features`-Tabelle angelegt werden (wenn `@TenantFeature` genutzt wird), ODER
- Die Controller nur `@RequirePermission` ohne `@TenantFeature` nutzen (wenn das Feature nicht buchbar ist)

---

## 8. Controller ohne Permission-Guard (26 von 41)

### 8.1 Sicherheitskritisch (10 Controller, ~117 Endpoints)

| Controller | Endpoints | Aktueller Schutz | Vorgeschlagene Kategorie |
|-----------|:---------:|-----------------|------------------------|
| AssetsController | 22 | @Roles auf Writes | `assets` |
| UsersController | 27 | @Roles auf Writes | `users` |
| DepartmentsController | 7 | @Roles auf Writes | `organization` |
| TeamsController | 13 | @Roles auf Writes | `organization` |
| AreasController | 7 | @Roles auf Writes | `organization` |
| ReportsController | 7 | @Roles auf Klasse | `reports` |
| SettingsController | 18 | Gemischt | `settings` |
| AuditTrailController | 6 | @Roles auf Stats/Export | `audit_trail` |
| NotificationsController | 15 | @Roles auf Admin-Endpoints | `notifications` |
| DummyUsersController | 5 | @Roles auf Klasse | `dummy_users` |

### 8.2 Admin/System — Kein Guard nötig (7 Controller)

| Controller | Endpoints | Begründung |
|-----------|:---------:|-----------|
| RootController | 27 | Root-only by design |
| AdminPermissionsController | 11 | Root-only |
| LogsController | 4 | Root-only |
| PlansController | 8 | SaaS-Plan-Verwaltung (public + admin) |
| RolesController | 5 | Read-only Metadaten |
| RoleSwitchController | 4 | System-Feature (@Roles admin/root) |
| FeaturesController | 11 | Tenant-Feature-Verwaltung |

### 8.3 Self-Service / Infrastruktur — Kein Guard nötig (8 Controller)

| Controller | Endpoints | Begründung |
|-----------|:---------:|-----------|
| AuthController | 7 | Public (Login/Logout/Refresh) |
| SignupController | 2 | Public (Registrierung) |
| DashboardController | 1 | Jeder eingeloggte User |
| MetricsController | 1 | Prometheus Scraping |
| FeatureVisitsController | 1 | User-Self-Service |
| E2eEscrowController | 3 | Encryption-Infrastruktur |
| E2eKeysController | 5 | Encryption-Infrastruktur |
| UserPermissionsController | 2 | Admin-only via @Roles + assertFullAccess |

### 8.4 Sonderfall

| Controller | Endpoints | Problem |
|-----------|:---------:|--------|
| ShiftTimesController | 4 | Nur @Roles, KEIN @TenantFeature — nicht feature-gated! |

---

## 9. Zusammenfassung

### Zahlen

| Metrik | IST (verifiziert) | SOLL |
|--------|:-----------------:|:----:|
| Registrierte Kategorien | 10 | 18 (+8) |
| Registrierte Module | 26 | 49 (+23) |
| Controller mit Permission-Guard | 15 | 26 (+11) |
| Bugs (Registry/Controller Mismatch) | **4** | 0 |
| Orphaned DB-Daten | **2** | 0 |
| Audit Trail für Permissions | NEIN | JA |

### Prioritäten

| Prio | Aufgabe | Typ |
|------|---------|-----|
| **P0** | B1-B4 fixen: `allowedPermissions` in Registry korrigieren | Bug-Fix |
| **P0** | Audit Trail in `UserPermissionsService` einbauen | Feature |
| **P0** | O1/O2: Orphaned DB-Daten entscheiden (aufnehmen oder bereinigen) | Cleanup |
| **P1** | TPM-Permissions erweitern (tpm-config, tpm-locations) | Erweiterung |
| **P1** | `shift-times` in Schichtplanung + `@TenantFeature` | Erweiterung |
| **P1** | `assets` Permission-Kategorie | Neue Kategorie |
| **P1** | `organization` Permission-Kategorie | Neue Kategorie |
| **P1** | `users` Permission-Kategorie | Neue Kategorie |
| **P2** | `reports` Permission-Kategorie | Neue Kategorie |
| **P2** | `settings` Permission-Kategorie | Neue Kategorie |
| **P2** | `audit_trail` Permission-Kategorie | Neue Kategorie |
| **P3** | `notifications` Permission-Kategorie | Neue Kategorie |
| **P3** | `dummy_users` Permission-Kategorie | Neue Kategorie |

---

## 10. Korrekturen am Audit-Dokument (PERMISSION-AUDIT-FINDINGS.md)

| # | Sektion | Fehler | Korrektur |
|---|---------|--------|-----------|
| D1 | Section 2 | Audit sagt 26 Module | Korrekt für Registry (26), aber DB hat 28 (+ kvp-reviews, tpm-reports) |
| D2 | Section 3.1 | TpmConfigController: 9 Endpoints | Tatsächlich **14** Endpoints |
| D3 | Section 3.1 | TpmLocationsController: 6 Endpoints | Tatsächlich **7** Endpoints |
| D4 | Section 4.1 | AssetsController: 20 Endpoints | Tatsächlich **22** Endpoints |
| D5 | Section 4.1 | UsersController: 24 Endpoints | Tatsächlich **27** Endpoints |
| D6 | Section 4.1 | TeamsController: 11 Endpoints | Tatsächlich **13** Endpoints |
| D7 | Section 4 | "26 von 41" aber nur 24 in Auflistung | **RootController** (27 EP) und **ShiftTimesController** (4 EP) fehlen |
| D8 | — | `kvp-reviews` komplett vergessen | Orphaned in DB, nicht im Registry, nicht im Audit |
| D9 | — | Registry-vs-Controller Mismatches nicht erkannt | 4 Bugs (B1-B4) unentdeckt |
