# Permission Audit — Findings

> **Datum:** 2026-03-09
> **Scope:** Alle 41 Backend-Controller, 10 registrierte Permission-Kategorien, Audit-Trail-Abdeckung
> **Ziel:** Lücken in der Permission-Architektur identifizieren
> **Verifiziert:** 2026-03-09 — Code-Audit gegen alle `.permissions.ts`, alle 41 Controller, DB `user_feature_permissions`
> **Offizielle Referenz:** [PERMISSION-REGISTRY-OFFICIAL.md](./PERMISSION-REGISTRY-OFFICIAL.md)
>
> **ACHTUNG:** Dieses Dokument enthielt Fehler, die am 2026-03-09 durch Code-Verifizierung aufgedeckt wurden.
> Korrekturen sind inline mit `[KORREKTUR]` markiert. Für die verifizierte Version siehe PERMISSION-REGISTRY-OFFICIAL.md.

---

## 1. Audit Trail — FEHLT KOMPLETT

`UserPermissionsService.upsertPermissions()` speichert `assigned_by` in der DB, ruft aber **KEINEN** `ActivityLoggerService` auf.

**IST:**
- `assigned_by` wird in `user_feature_permissions` gespeichert ✓
- `updated_at` wird aktualisiert ✓
- `logger.log()` schreibt ins Terminal (flüchtig) ✗
- **Kein Eintrag in `root_logs`** ✗
- **Kein ActivityLoggerService-Aufruf** ✗

**SOLL:**
- Jede Permission-Änderung muss in `root_logs` protokolliert werden
- Entity-Typ `user_permission` in ActivityLoggerService ergänzen
- Old/New-Diff loggen (welche Module geändert, welche Rechte erteilt/entzogen)

---

## 2. Bestehende Permission-Kategorien (10 Features)

| # | Feature | Code | Module-Count | Module-Codes |
|---|---------|------|:---:|---|
| 1 | Schwarzes Brett | `blackboard` | 3 | blackboard-posts (RWD), blackboard-comments (RWD), blackboard-archive (RW) |
| 2 | Kalender | `calendar` | 1 | calendar-events (RWD) |
| 3 | Chat | `chat` | 2 | chat-conversations (RWD), chat-messages (RWD) |
| 4 | Dokumente | `documents` | 2 | documents-files (RWD), documents-archive (RW) |
| 5 | KVP | `kvp` | 2 | kvp-suggestions (RWD), kvp-comments (RW) `[KORREKTUR: kvp-comments braucht RWD — Controller nutzt canDelete, siehe BUG B1 in PERMISSION-REGISTRY-OFFICIAL.md]` |
| 6 | Schichtplanung | `shift_planning` | 3 | shift-plan (RWD), shift-swap (RW), shift-rotation (R) `[KORREKTUR: shift-rotation braucht RWD — RotationController nutzt canWrite/canDelete, siehe BUG B4]` |
| 7 | Umfragen | `surveys` | 3 | surveys-manage (RWD), surveys-participate (RW), surveys-results (R) |
| 8 | TPM / Wartung | `tpm` | 3 | tpm-plans (RWD), tpm-cards (RWD), tpm-executions (RW) |
| 9 | Urlaubsverwaltung | `vacation` | 5 | vacation-requests (RW) `[KORREKTUR: braucht RWD — BUG B2]`, vacation-rules (RWD), vacation-entitlements (RW) `[KORREKTUR: braucht RWD — BUG B3]`, vacation-holidays (RWD), vacation-overview (R) |
| 10 | Arbeitsaufträge | `work_orders` | 2 | work-orders-manage (RWD), work-orders-execute (RW) |

**Legende:** R = canRead, W = canWrite, D = canDelete

---

## 3. Fehlende Granularität in bestehenden Kategorien

### 3.1 TPM — 2 Controller ohne eigenes Permission-Modul

| Controller | Endpoints | Nutzt aktuell | Sollte haben |
|---|:---:|---|---|
| `tpm-config.controller.ts` | 14 `[KORREKTUR: nicht 9]` | `tpm-plans` / `tpm-cards` | **`tpm-config`** (RW) |
| `tpm-locations.controller.ts` | 7 `[KORREKTUR: nicht 6]` | `tpm-plans` | **`tpm-locations`** (RWD) |

**Fehlende TPM-Module:**

| Modul-Code | Label | Permissions | Begründung |
|---|---|---|---|
| `tpm-config` | Konfiguration | canRead, canWrite | Eskalation, Farben, Intervall-Farben, Kategorie-Farben |
| `tpm-locations` | Standorte | canRead, canWrite, canDelete | Standort-CRUD + Foto-Upload/-Löschung |
| `tpm-reports` | Auswertungen | canRead | Reporting/Export (noch kein eigener Controller, Zukunft) |
| `tpm-templates` | Vorlagen | canRead, canWrite, canDelete | Kartenvorlagen (existiert als Service, kein eigener Controller) |

### 3.2 Schichtplanung — Schichtzeiten fehlen

| Controller | Endpoints | Nutzt aktuell | Sollte haben |
|---|:---:|---|---|
| `shift-times.controller.ts` | 4 | Kein Permission-Guard | **`shift-times`** (RW) |

### 3.3 Work Orders — keine Granularität für Fotos/Kommentare

Aktuell nur `work-orders-manage` und `work-orders-execute`. Für V2 ggf. eigene Module für Defekt-Fotos und Kommentare.

---

## 4. Controller OHNE jeglichen Permission-Guard (26 von 41)

### 4.1 Sicherheitskritisch — Brauchen eigene Permission-Kategorie

| Controller | Endpoints | Aktueller Schutz | Vorgeschlagene Kategorie |
|---|:---:|---|---|
| **AssetsController** | 22 `[KORREKTUR]` | `@Roles('admin','root')` auf Schreib-Endpoints | `assets` |
| **UsersController** | 27 `[KORREKTUR]` | `@Roles('admin','root')` auf Schreib-Endpoints | `users` |
| **DepartmentsController** | 7 | `@Roles('admin','root')` auf Schreib-Endpoints | Zusammen mit Teams/Areas → `organization` |
| **TeamsController** | 13 `[KORREKTUR]` | `@Roles('admin','root')` auf Schreib-Endpoints | → `organization` |
| **AreasController** | 7 | `@Roles('admin','root')` auf Schreib-Endpoints | → `organization` |
| **ReportsController** | 7 | `@Roles('admin','root')` auf Klasse | `reports` |
| **SettingsController** | 18 | Gemischt (root/admin/alle) | `settings` |
| **AuditTrailController** | 6 | `@Roles('admin','root')` auf Schreib-Endpoints | `audit_trail` |
| **NotificationsController** | 15 | Feature-Level intern, kein Guard | `notifications` |
| **DummyUsersController** | 5 | `@Roles('admin','root')` auf Klasse | `dummy_users` |

### 4.2 Admin/System — Nur Root/Admin relevant

| Controller | Endpoints | Aktueller Schutz | Aktion |
|---|:---:|---|---|
| **AdminPermissionsController** | 11 | `@Roles('root')` | Kein Permission-Guard nötig — Root-only by design |
| **LogsController** | 4 | `@Roles('root')` | Kein Permission-Guard nötig — Root-only |
| **PlansController** | 8 | Gemischt (public + admin) | Kein Permission-Guard nötig — SaaS-Plan-Verwaltung |
| **RolesController** | 5 | Keine | Kein Permission-Guard nötig — Read-only Metadaten |
| **RoleSwitchController** | 4 | `@Roles('admin','root')` | Kein Permission-Guard nötig — System-Feature |
| **FeaturesController** | 11 | Gemischt | Kein Permission-Guard nötig — Tenant-Feature-Verwaltung |

### 4.3 User-Self-Service / Infrastruktur — Kein Guard nötig

| Controller | Endpoints | Begründung |
|---|:---:|---|
| **AuthController** | — | Public (Login/Logout) |
| **SignupController** | — | Public (Registrierung) |
| **DashboardController** | 1 | Jeder eingeloggte User |
| **MetricsController** | 1 | Prometheus Scraping |
| **FeatureVisitsController** | 1 | User-Self-Service |
| **E2eEscrowController** | — | Encryption-Infrastruktur |
| **E2eKeysController** | — | Encryption-Infrastruktur |
| **UserPermissionsController** | — | Admin-only via `@Roles` |

---

## 5. Vorgeschlagene neue Permission-Kategorien

### 5.1 `assets` — Anlagen/Maschinen

```
Code:    assets
Label:   Anlagen & Maschinen
Module:
  - assets-manage:       Anlagenverwaltung        (R, W, D)
  - assets-availability: Verfügbarkeit             (R, W, D)
  - assets-maintenance:  Wartungshistorie          (R, W)
```

### 5.2 `organization` — Bereiche, Abteilungen, Teams

```
Code:    organization
Label:   Organisation
Module:
  - org-areas:           Bereiche                  (R, W, D)
  - org-departments:     Abteilungen               (R, W, D)
  - org-teams:           Teams                     (R, W, D)
  - org-team-members:    Teammitglieder            (R, W, D)
```

### 5.3 `users` — Benutzerverwaltung

```
Code:    users
Label:   Benutzerverwaltung
Module:
  - users-manage:        Benutzer verwalten        (R, W, D)
  - users-availability:  Verfügbarkeit             (R, W, D)
```

### 5.4 `reports` — Berichte & Auswertungen

```
Code:    reports
Label:   Berichte
Module:
  - reports-view:        Berichte einsehen         (R)
  - reports-export:      Berichte exportieren      (R, W)
```

### 5.5 `settings` — Einstellungen

```
Code:    settings
Label:   Einstellungen
Module:
  - settings-tenant:     Mandanten-Einstellungen   (R, W)
```

### 5.6 `audit_trail` — Protokoll

```
Code:    audit_trail
Label:   Protokoll & Audit
Module:
  - audit-view:          Protokoll einsehen        (R)
  - audit-export:        Protokoll exportieren     (R, W)
  - audit-retention:     Aufbewahrung verwalten    (R, D)
```

### 5.7 `notifications` — Benachrichtigungen

```
Code:    notifications
Label:   Benachrichtigungen
Module:
  - notifications-manage: Benachrichtigungen senden (R, W)
```

### 5.8 `dummy_users` — Platzhalter-Benutzer

```
Code:    dummy_users
Label:   Platzhalter-Benutzer
Module:
  - dummy-users-manage:  Platzhalter verwalten     (R, W, D)
```

---

## 6. TPM-Erweiterungen (bestehende Kategorie)

```
Code:    tpm  (bestehend — Module ergänzen)
Module (bestehend):
  - tpm-plans:           Wartungspläne             (R, W, D)
  - tpm-cards:           Wartungskarten            (R, W, D)
  - tpm-executions:      Durchführungen            (R, W)
Module (NEU):
  - tpm-config:          Konfiguration             (R, W)
  - tpm-locations:       Standorte                 (R, W, D)
  - tpm-reports:         Auswertungen              (R)
  - tpm-templates:       Vorlagen                  (R, W, D)
```

---

## 7. Zusammenfassung

| Bereich | IST | SOLL | Delta |
|---|:---:|:---:|:---:|
| Registrierte Kategorien | 10 | 18 | **+8** |
| Registrierte Module | 26 | 45 | **+19** |
| Controller mit Permission-Guard | 15 | 25 | **+10** |
| Audit Trail für Permissions | ✗ | ✓ | **fehlt** |

### Prioritäten

| Prio | Aufgabe |
|---|---|
| **P0** | Audit Trail in `UserPermissionsService` einbauen |
| **P1** | TPM-Permissions erweitern (tpm-config, tpm-locations) |
| **P1** | `assets` Permission-Kategorie |
| **P1** | `organization` Permission-Kategorie (Areas/Departments/Teams) |
| **P1** | `users` Permission-Kategorie |
| **P2** | `reports` Permission-Kategorie |
| **P2** | `settings` Permission-Kategorie |
| **P2** | `audit_trail` Permission-Kategorie |
| **P3** | `notifications` Permission-Kategorie |
| **P3** | `dummy_users` Permission-Kategorie |
| **P3** | Shift-Times in Schichtplanung-Permissions aufnehmen |

---

## 8. Nachträgliche Findings (Code-Verifizierung 2026-03-09)

> Diese Findings wurden durch eine vollständige Code-Verifizierung gegen alle 41 Controller aufgedeckt
> und sind in [PERMISSION-REGISTRY-OFFICIAL.md](./PERMISSION-REGISTRY-OFFICIAL.md) ausführlich dokumentiert.

### 8.1 BUGS — Registry vs. Controller Mismatch (4 Stück)

| # | Module | Registry erlaubt | Controller nutzt | Impact |
|---|--------|------------------|------------------|--------|
| B1 | `kvp-comments` | R, W | R, W, **D** | Kommentare unlöschbar für Non-fullAccess |
| B2 | `vacation-requests` | R, W | R, W, **D** | Urlaubsanträge nicht stornierbar |
| B3 | `vacation-entitlements` | R, W | R, W, **D** | Admin-Funktion blockiert |
| B4 | `shift-rotation` | R | R, **W**, **D** | Rotation nur für fullAccess verwaltbar |

### 8.2 Orphaned DB-Daten (2 Stück)

| module_code | In DB | In Registry | In Audit-Doc |
|-------------|:-----:|:-----------:|:------------:|
| `kvp-reviews` | Ja | NEIN | NEIN (komplett vergessen) |
| `tpm-reports` | Ja | NEIN | Als NEU vorgeschlagen |

### 8.3 Fehlende Controller in Auflistung

- **RootController** (27 Endpoints) fehlt in Section 4
- **ShiftTimesController** (4 Endpoints) nur in Section 3.2 erwähnt, fehlt in Section 4 Zählung

### 8.4 Endpoint-Counts korrigiert

| Controller | Audit sagte | Tatsächlich |
|-----------|:-----------:|:-----------:|
| TpmConfigController | 9 | 14 |
| TpmLocationsController | 6 | 7 |
| AssetsController | 20 | 22 |
| UsersController | 24 | 27 |
| TeamsController | 11 | 13 |
| WorkOrdersController | 17 (Code-Kommentar) | 22 |
