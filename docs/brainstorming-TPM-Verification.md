# TPM Brainstorming — Codebase Verification

> **Erstellt:** 2026-02-18
> **Zweck:** Alle Annahmen aus `brainstorming-TPM.md` gegen die echte Codebase und ADRs verifizieren
> **Methode:** 5 parallele Exploration-Agents auf: Machines, Shifts/Availability, Teams/Departments/Areas, Permissions/ADRs, Notifications
> **Ergebnis:** Jede Annahme als BESTÄTIGT, KORREKTUR oder FEHLT klassifiziert

---

## Legende

| Symbol | Bedeutung |
| ------ | --------- |
| ✅ | BESTÄTIGT — Annahme stimmt mit Codebase überein |
| ⚠️ | KORREKTUR — Annahme war teilweise falsch oder braucht Anpassung |
| ❌ | FEHLT — Feature/Tabelle existiert noch nicht, muss gebaut werden |
| 🔄 | ERWEITERUNG — Feature existiert, muss aber für TPM erweitert werden |

---

## 1. Maschinen-Modul

### 1.1 Tabelle `machines` ✅

**Annahme:** "machines Tabelle existiert"
**Realität:** Vollständiges Modul mit 30+ Spalten

| Spalte | Typ | TPM-Relevanz |
| ------ | --- | ------------ |
| id | INTEGER PK | Interne Referenz |
| tenant_id | INTEGER FK | Multi-Tenant Isolation |
| uuid | CHAR(36) | UUIDv7, API v2 bevorzugt |
| name | VARCHAR(100) | Maschinenname (z.B. "P17") |
| department_id | INTEGER FK | Abteilungszuordnung |
| area_id | INTEGER FK | Bereichszuordnung |
| location | VARCHAR(255) | Standort in der Halle |
| machine_type | ENUM | production, packaging, quality_control, logistics, utility, other |
| status | ENUM | operational, maintenance, repair, standby, decommissioned |
| last_maintenance | TIMESTAMP | Letzte Wartung — TPM aktualisiert das |
| next_maintenance | TIMESTAMP | Nächste Wartung — TPM berechnet das |
| operating_hours | INTEGER | Betriebsstunden (für Langläufer NICHT relevant, reine Kalenderberechnung) |
| is_active | SMALLINT | 0=inactive, 1=active, 3=archive, 4=deleted |

**Backend:** `backend/src/nest/machines/` — MachinesService (Facade) + MachineAvailabilityService + MachineMaintenanceService + MachineTeamService
**Frontend:** `/manage-machines/` mit List+Filter+Modals, `/manage-machines/availability/[uuid]`
**RLS:** Ja, tenant_isolation Policy aktiv

### 1.2 Tabelle `machine_teams` ✅

**Annahme:** "Gibt es machine_teams Verknüpfung?"
**Realität:** Ja, N:M Junction Table

| Spalte | Typ | Beschreibung |
| ------ | --- | ------------ |
| machine_id | INTEGER FK | → machines(id) ON DELETE CASCADE |
| team_id | INTEGER FK | → teams(id) ON DELETE CASCADE |
| is_primary | BOOLEAN | Primary Team Flag |
| assigned_by | INTEGER FK | Wer hat zugewiesen |
| notes | TEXT | Notizen zur Zuweisung |

**UNIQUE Constraint:** (tenant_id, machine_id, team_id)
**Service:** `MachineTeamService.setMachineTeams()` — Bulk Replace

**TPM-Konsequenz:** Zugriffskette Employee → Team → Machine funktioniert bereits.

### 1.3 Tabelle `machine_availability` ✅

**Annahme:** "Machine Availability automatisch auf Wartung wenn Wartungsplan aktiv"
**Realität:** Tabelle existiert mit passendem Status-Enum

```sql
CREATE TYPE machine_availability_status AS ENUM (
  'operational', 'maintenance', 'repair', 'standby', 'cleaning', 'other'
);
```

**Spalten:** machine_id, tenant_id, status, start_date, end_date, reason, notes, created_by
**Constraint:** CHECK (end_date >= start_date)
**Overlap-Validierung:** Im Service implementiert (ConflictException bei Überlappung)

⚠️ **KORREKTUR:** Brainstorming sagt "auf Wartung setzen" — korrekter Wert ist `'maintenance'` (englisch, nicht deutsch). Kein Problem, nur Sprachhinweis für die Implementierung.

🔄 **ERWEITERUNG NÖTIG:** Aktuell nur manuelle Einträge. TPM muss automatische Einträge erstellen wenn Wartungsplan aktiv wird.

### 1.4 Tabelle `machine_maintenance_history` ✅ aber ⚠️

**Annahme:** "Lückenlose Historie (wer, wann, was, Fotos/Protokoll)"
**Realität:** Tabelle existiert mit gutem Schema

| Spalte | Typ | Beschreibung |
| ------ | --- | ------------ |
| maintenance_type | ENUM | preventive, corrective, inspection, calibration, cleaning, other |
| performed_date | TIMESTAMP | Wann durchgeführt |
| performed_by | INTEGER FK | Wer hat durchgeführt |
| description | TEXT | Arbeitsbeschreibung |
| parts_replaced | TEXT | Getauschte Teile |
| cost | NUMERIC(10,2) | Kosten (V1: nicht genutzt, aber Spalte da!) |
| duration_hours | NUMERIC(5,2) | Dauer |
| status_after | ENUM | operational, needs_repair, decommissioned |
| next_maintenance_date | DATE | Nächster Termin |
| report_url | VARCHAR(500) | Wartungsbericht URL |

⚠️ **KORREKTUR:** Diese Tabelle ist ein EINFACHER Audit Trail (ein Datensatz pro Event). Für das Kamishibai-Kartensystem mit Intervallen, Kaskaden, Freigabe-Flows und Card-Flip-Logik reicht das NICHT.

**Lösung:** `machine_maintenance_history` bleibt als Audit Trail bestehen. TPM braucht EIGENE Tabellen für:
- `tpm_cards` (Kamishibai-Karten mit Intervall, Status, Freigabe-Flag)
- `tpm_card_executions` (Durchführungs-Historie mit Fotos/Doku)
- `tpm_maintenance_plans` (Plan pro Maschine mit Basis-Intervall)

Bei Abschluss einer TPM-Karte wird ZUSÄTZLICH ein Eintrag in `machine_maintenance_history` geschrieben (Brücke zum bestehenden System).

### 1.5 Tabelle `machine_documents` ⚠️

**Annahme:** "Maschinen-Dokumentation: Wartungsanleitungen, Handbücher hochladen"
**Realität:** Tabelle existiert in der Baseline, aber **NICHT im Backend integriert** (kein Service, kein Controller, kein Endpoint).

**Spalten vorhanden:** Document storage mit validity dates, uploaded_by tracking

🔄 **ERWEITERUNG NÖTIG:** Backend-Service + Controller + Frontend-Integration bauen. TPM-Karten können dann auf machine_documents verweisen.

### 1.6 Tabelle `machine_metrics` ❌ (nicht TPM V1)

**Annahme:** Keine — aber Tabelle existiert für zukünftige Telemetrie
**Realität:** Tabelle existiert (time-series), aber nicht integriert. Für V1 irrelevant (keine prädiktive Wartung).

---

## 2. Schichtplanung (Shifts)

### 2.1 Shift-Machine Connection ✅

**Annahme:** "Slot-Vorschlag berücksichtigt Schichtplan"
**Realität:** shifts.machine_id und shift_plans.machine_id existieren bereits als FK → machines(id)

```sql
shifts.machine_id    INTEGER FK → machines(id) [nullable]
shift_plans.machine_id INTEGER FK → machines(id) [nullable]
```

**Service:** `ShiftsService` mit vollständiger CRUD, Plan-Erstellung, Swap-Requests
**Endpoints:**
- `GET /shifts` — List mit Filtern (date, userId, departmentId, teamId, machineId)
- `POST /shifts/plan` — Plan erstellen mit Shift-Items (userId, date, startTime, endTime)
- `GET /shifts/my-calendar-shifts` — Kalender-Ansicht

**TPM-Konsequenz:** Der Slot-Verfügbarkeits-Assistent kann folgendes abfragen:
1. `shifts` WHERE `machine_id = X` AND `date BETWEEN Y AND Z` → Welche Schichten nutzen die Maschine?
2. `shifts` WHERE `user_id IN (Instandhaltungsteam)` AND `date = Z` → Welche MA sind verfügbar?
3. `machine_availability` WHERE `machine_id = X` → Ist die Maschine frei?
4. `user_availability` WHERE `user_id IN (Team)` → Urlaub/Krank?

### 2.2 Schichtplan MUSS VOR Wartungsplan existieren ✅ (Logik validierbar)

**Annahme (E15):** "Schichtplan MUSS VOR Wartungsplan existieren"
**Realität:** Keine automatische Enforcement im aktuellen System. Aber:
- `shift_plans` hat `start_date` und `end_date`
- TPM kann prüfen: Existiert ein Shift Plan für den Zeitraum?
- Wenn nicht: Warnung oder Block

❌ **MUSS GEBAUT WERDEN:** Validierung in TPM-Plan-Erstellung:
```
IF NOT EXISTS (SELECT 1 FROM shift_plans WHERE department_id = X AND start_date <= planned_date AND end_date >= planned_date)
  → Warnung: "Kein Schichtplan für diesen Zeitraum vorhanden"
```

### 2.3 Shift-Modul Toggle für Wartungstermine 🔄

**Annahme (E17):** "Toggle/Filter im Wochen-Grid: Wartungstermine anzeigen"
**Realität:** Aktuell kein solcher Toggle. Machine Availability wird bereits als visuelle Zellen im Schichtplan genutzt (`getMachineAvailabilityForDateRange()`).

🔄 **ERWEITERUNG NÖTIG:** Bestehende Machine-Availability-Integration im Shift-Grid erweitern um TPM-Wartungstermine als farbige Blöcke anzuzeigen. Pattern existiert bereits — nur neue Datenquelle (TPM-Plans statt manuelle Availability).

---

## 3. Verfügbarkeits-System

### 3.1 User Availability ✅

**Annahme:** "Employee Availability fertig"
**Realität:** Vollständig implementiert

```sql
CREATE TYPE user_availability_status AS ENUM (
  'available', 'unavailable', 'vacation', 'sick', 'training', 'other'
);
```

**Service:** `UserAvailabilityService` — Pattern-identisch mit MachineAvailabilityService
**Batch-Query:** `getUserAvailabilityBatch()` für effiziente Multi-User-Abfrage
**Overlap-Validierung:** Ja, ConflictException bei Überlappung

**TPM-Konsequenz:** Slot-Assistent kann direkt `getUserAvailabilityBatch()` nutzen um zu prüfen welche MA an einem Tag verfügbar sind.

### 3.2 Machine Availability ✅

Siehe Abschnitt 1.3. Identisches Pattern wie User Availability. TPM kann `MachineAvailabilityService.updateAvailability()` direkt nutzen um automatische "maintenance"-Einträge zu erstellen.

---

## 4. Teams / Departments / Areas

### 4.1 Organisations-Hierarchie ✅

**Annahme:** "Area → Department → Team → Employee"
**Realität:** Exakt so implementiert

```
AREA (areas.area_lead_id → users)
  └── DEPARTMENT (departments.department_lead_id → users, departments.area_id → areas)
        └── TEAM (teams.team_lead_id → users, teams.deputy_lead_id → users, teams.department_id → departments)
              └── EMPLOYEE (user_teams.user_id → users, user_teams.team_id → teams, user_teams.role: member|lead)
```

### 4.2 Multi-Team Membership ✅

**Annahme:** Nicht explizit im Brainstorming, aber KRITISCH für TPM
**Realität:** Seit Migration `20260218000040` erlaubt (UNIQUE Constraint auf user_id wurde entfernt)

**TPM-Konsequenz:** Ein Mitarbeiter kann gleichzeitig in "Produktion Halle 3" (als Bediener) UND im "Instandhaltungsteam" (als Wartungstechniker) sein. DAS ermöglicht das Joker-Konzept (E16).

### 4.3 Deputy Lead ✅

**Annahme:** Nicht im Brainstorming erwähnt
**Realität:** `teams.deputy_lead_id` existiert (seit Migration `20260212000028`)

**TPM-Konsequenz:** Wenn der Team-Lead nicht da ist (Urlaub), kann der Deputy TPM-Freigaben erteilen. Muss bei Freigabe-Flow (E9) berücksichtigt werden.

### 4.4 Lead Roles → Admin-Only ⚠️

**Annahme (E18):** "team_lead_id = RWX for team's assigned machines"
**Realität:** team_lead_id, department_lead_id, area_lead_id MÜSSEN `role = 'admin'` oder `role = 'root'` sein. Ein Employee KANN NICHT Team-Lead sein.

⚠️ **KORREKTUR:** Dies ist KEIN Problem für TPM — es bestätigt nur, dass "Schichtleiter" und "Meister" als Admin-User angelegt werden müssen, nicht als Employees. In der Industrie ist das realistisch: Schichtleiter hat Admin-Rechte.

---

## 5. Permission-System

### 5.1 RBAC (ADR-010) ✅

**Annahme (E18):** "root/admin(full_access)=RWX, employee=R(own)"
**Realität:** Exakt so implementiert

| Rolle | has_full_access | Zugriff |
| ----- | --------------- | ------- |
| root | IMMER true (DB-Constraint) | Alles |
| admin (full) | true | Alles im Tenant |
| admin (eingeschränkt) | false | Über admin_area_permissions + admin_department_permissions |
| employee | IMMER false (DB-Constraint) | Nur eigene Teams/Abteilungen via user_teams + user_departments |

**Permission-Tabellen:**
- `admin_area_permissions` (admin_user_id, area_id, can_read, can_write, can_delete)
- `admin_department_permissions` (admin_user_id, department_id, can_read, can_write, can_delete)

### 5.2 Feature Permissions (ADR-020) ✅

**Annahme:** "Permission-System (ADR-020)"
**Realität:** Decentralized Permission Registry Pattern

- `user_feature_permissions` Tabelle: tenant_id, user_id, feature_code, module_code, can_read, can_write, can_delete
- Jedes Feature-Modul registriert sich selbst via `OnModuleInit()`
- Admin kann pro User pro Modul Rechte vergeben

❌ **MUSS GEBAUT WERDEN:** TPM Feature Registration:
```typescript
// backend/src/nest/tpm/tpm.permissions.ts
export const TPM_PERMISSIONS: PermissionCategoryDef = {
  code: 'tpm',
  label: 'TPM / Wartung',
  modules: [
    { code: 'tpm-plans', label: 'Wartungspläne', allowedPermissions: ['canRead', 'canWrite', 'canDelete'] },
    { code: 'tpm-cards', label: 'Kamishibai-Karten', allowedPermissions: ['canRead', 'canWrite', 'canDelete'] },
    { code: 'tpm-executions', label: 'Durchführungen', allowedPermissions: ['canRead', 'canWrite'] },
    { code: 'tpm-reports', label: 'Auswertungen', allowedPermissions: ['canRead'] },
  ],
};
```

### 5.3 Frontend Route Groups (ADR-012) ✅

**Annahme:** Nicht explizit, aber relevant
**Realität:** Fail-Closed RBAC via SvelteKit Route Groups

```
routes/(app)/(root)/    ← Nur Root
routes/(app)/(admin)/   ← Admin + Root
routes/(app)/(shared)/  ← Alle Authentifizierten
```

**TPM-Konsequenz:** TPM-Admin-Seiten (Plan erstellen, Karten verwalten) in `(admin)/`. TPM-Employee-Seiten (Board ansehen, Karten erledigen) in `(shared)/`.

### 5.4 Frontend Feature Guards (ADR-024) ✅

**Annahme:** "Feature-Flag-System"
**Realität:** `requireFeature()` Utility in +page.server.ts

```typescript
const { activeFeatures } = await parent();
requireFeature(activeFeatures, 'tpm');
```

❌ **MUSS GEBAUT WERDEN:**
1. Feature-Flag 'tpm' in `features` Tabelle + `tenant_features` Eintrag
2. `requireFeature()` Call in jeder TPM +page.server.ts
3. Sidebar-Eintrag mit `featureCode: 'tpm'` in navigation-config.ts

---

## 6. Notification-System

### 6.1 Feature-Notifications (ADR-004) ✅

**Annahme:** "Notification Badge für anstehende Wartungen"
**Realität:** Vollständiges Feature-Notification-Pattern vorhanden

**Pattern:** `NotificationsService.createFeatureNotification(type, featureId, title, message, recipientType, recipientId, tenantId, createdBy)`

**Deduplizierung:** UNIQUE Constraint auf (tenant_id, type, feature_id, recipient_type, recipient_id)
**SSE Events:** Real-time via EventBus → NotificationsController.stream()
**Badge Store:** Svelte 5 Runes ($state) mit SSR-Initialization

### 6.2 SSE Event Types 🔄

**Bestehende Events:**
```
NEW_SURVEY, NEW_DOCUMENT, NEW_KVP, NEW_MESSAGE,
VACATION_REQUEST_CREATED, VACATION_REQUEST_RESPONDED,
VACATION_REQUEST_WITHDRAWN, VACATION_REQUEST_CANCELLED
```

❌ **MUSS GEBAUT WERDEN — Neue TPM Events:**
```
TPM_MAINTENANCE_DUE         → Wartung fällig (Karte wird ROT)
TPM_MAINTENANCE_OVERDUE     → Wartung überfällig (Eskalation)
TPM_MAINTENANCE_COMPLETED   → Wartung erledigt (Karte GRÜN/GELB)
TPM_APPROVAL_REQUIRED       → Freigabe erforderlich (Admin/Schichtleiter)
TPM_APPROVAL_REJECTED       → Freigabe abgelehnt (zurück an MA)
```

### 6.3 Recipient Types ✅

**Annahme:** TPM-Notifications an spezifische User
**Realität:** `notifications_recipient_type ENUM ('user', 'department', 'team', 'all')`

**TPM-Nutzung:**
- Wartung fällig → `recipient_type = 'user'`, `recipient_id = assigned_employee_id`
- Eskalation → `recipient_type = 'user'`, `recipient_id = team_lead_id`
- Board-weite Updates → `recipient_type = 'team'`, `recipient_id = team_id`

### 6.4 Notification Priorities ✅

**Annahme:** Eskalation braucht höhere Priorität
**Realität:** `notifications_priority ENUM ('low', 'normal', 'medium', 'high', 'urgent')`

**TPM-Mapping:**
- Wartung fällig → `normal`
- Wartung überfällig (< Eskalationsfrist) → `high`
- Wartung überfällig (> Eskalationsfrist) → `urgent`
- Freigabe erforderlich → `medium`

---

## 7. Relevante ADRs für TPM

| ADR | Titel | TPM-Relevanz |
| --- | ----- | ------------ |
| ADR-003 | Notification System | SSE-Pattern für TPM-Alerts |
| ADR-004 | Persistent Notification Counts | Badge-Counts für TPM-Feature |
| ADR-005 | Authentication Strategy | JWT/Cookie-Auth gilt auch für TPM |
| ADR-006 | Multi-Tenant Context Isolation | tenant_id auf ALLEN TPM-Tabellen |
| ADR-009 | Central Audit Logging | ActivityLogger für TPM-Aktionen |
| ADR-010 | User Role Assignment Permissions | RBAC-Basis für TPM-Zugriff |
| ADR-011 | Shift Data Architecture | Shift↔Machine Link für Slot-Assistant |
| ADR-012 | Frontend Route Security Groups | Route-Groups für TPM-Seiten |
| ADR-014 | Database Migration Architecture | Migrations für TPM-Tabellen |
| ADR-016 | Tenant Customizable Seed Data | Custom Farben/Templates pro Tenant |
| ADR-019 | Multi-Tenant RLS Isolation | RLS auf TPM-Tabellen |
| ADR-020 | Per-User Feature Permissions | TPM-Permission-Registrierung |
| ADR-023 | Vacation Request Architecture | Referenz-Pattern für Approval-Flow |
| ADR-024 | Frontend Feature Guards | requireFeature('tpm') |

---

## 8. Was schon da ist vs. was gebaut werden muss

### ✅ KANN DIREKT GENUTZT WERDEN (kein Code nötig)

| Was | Wo | TPM nutzt es für |
| --- | -- | ---------------- |
| Machine CRUD + UUID | `machines.*` | Maschinen-Stammdaten |
| Machine ↔ Team Assignment | `machine_teams` | Employee sieht "seine" Maschinen |
| Machine Availability | `machine_availability` | Auto-Status "maintenance" |
| User Availability | `user_availability` | Slot-Assistant prüft Urlaub/Krank |
| Shifts + Machine FK | `shifts.machine_id` | Slot-Assistant prüft Schichtplan |
| Notification Feature Pattern | `notification-feature.service.ts` | TPM-Badges + Alerts |
| SSE Real-time | `notifications.controller.ts` | Live-Updates bei Kartenänderungen |
| RBAC + has_full_access | `users.role`, `has_full_access` | Admin/Root = RWX |
| Route Groups | `(admin)/`, `(shared)/` | TPM-Seiten-Zugriffsschutz |
| Activity Logger | `ActivityLoggerService` | Audit Trail für TPM-Aktionen |
| Multi-Tenant RLS | Alle Tabellen | tenant_id Isolation |
| Multi-Team Membership | `user_teams` (kein UNIQUE) | Joker-Team-Konzept |

### 🔄 MUSS ERWEITERT WERDEN (bestehende Module ändern)

| Was | Wo | Änderung |
| --- | -- | -------- |
| Machine Availability Auto-Set | `machine-availability.service.ts` | Neue Methode: `createFromTpmPlan()` |
| Shift Grid Toggle | `/shifts/` Frontend | Neuer Toggle "Wartungstermine anzeigen" |
| Navigation Config | `navigation-config.ts` | "Lean Management → TPM" Eintrag + featureCode |
| Notification Store | `notification.store.svelte.ts` | Neuer Counter `tpm: number` |
| SSE Handler | `notifications.controller.ts` | Neue Event-Handler für TPM |
| Dashboard Counts | `dashboard/` | TPM-Zähler in `/dashboard/counts` |
| machine_maintenance_history | `machine-maintenance.service.ts` | Bridge: TPM-Abschluss → History-Eintrag |

### ❌ MUSS NEU GEBAUT WERDEN

| Komponente | Dateien | Beschreibung |
| ---------- | ------- | ------------ |
| **TPM Backend Module** | `backend/src/nest/tpm/` | Hauptmodul mit Service, Controller, DTOs |
| **TPM DB-Tabellen** | Migration | tpm_maintenance_plans, tpm_cards, tpm_card_executions, tpm_card_execution_photos, tpm_time_estimates, tpm_card_templates, tpm_escalation_config, tpm_color_config |
| **TPM Permission Registration** | `tpm.permissions.ts` + `tpm-permission.registrar.ts` | ADR-020 Integration |
| **TPM Feature Flag** | Migration | INSERT INTO features, tenant_features |
| **Kamishibai Board Component** | `frontend/src/lib/tpm/` | Board-Ansicht mit Intervall-Sektionen |
| **Card Flip Component** | `frontend/src/lib/tpm/KamishibaiCard.svelte` | CSS 3D Transform + Svelte Transitions |
| **Slot Availability Assistant** | `tpm-slot-assistant.service.ts` | Shift + Availability + Machine queries |
| **Interval Cascade Logic** | `tpm-cards.service.ts` | Jährlich → alle kürzeren ROT |
| **Duplicate Detection** | `tpm-cards.service.ts` | Warnung bei ähnlichen Aufgaben in kürzeren Intervallen |
| **Approval Flow** | `tpm-executions.service.ts` | GELB-Status, Admin-Prüfung, Ablehnung |
| **Escalation Engine** | `tpm-escalation.service.ts` | Cron/Scheduler für überfällige Karten |
| **TPM Frontend Pages** | `routes/(app)/(admin)/lean-management/tpm/` + `routes/(app)/(shared)/lean-management/tpm/` | Dashboard, Plan, Board, Card-Detail |
| **Machine Documents Backend** | `backend/src/nest/machines/machine-documents.service.ts` | Integration der existierenden Tabelle |

---

## 9. Risiken und Abhängigkeiten

### Risiko 1: Intervall-Kaskade Komplexität

**Beschreibung:** Wenn "Jährlich" fällig → ALLE kürzeren Karten ROT. Das bedeutet eine einzelne Aktion (Jährliche Wartung fällig) kann 50+ Karten gleichzeitig umschalten.
**Mitigation:** Batch-Update mit SQL WHERE-Clause statt einzelne Updates. Performance-Test mit realistischen Daten (20 Maschinen × 8 Intervalle × 5-15 Karten = 800-2400 Karten pro Tenant).

### Risiko 2: Slot-Assistant Komplexität

**Beschreibung:** Der Slot-Assistent muss 4 Datenquellen gleichzeitig abfragen (Shifts, User Availability, Machine Availability, bestehende TPM-Pläne).
**Mitigation:** Dedizierter Service mit optimierten SQL-Queries. Batch-Queries für alle Maschinen eines Tenants. Caching wo sinnvoll.

### Risiko 3: Schichtplan ↔ Wartungsplan Timing

**Beschreibung:** Was passiert wenn der Schichtplan NACH dem Wartungsplan geändert wird?
**Mitigation:** Event-basiertes System: Schichtplan-Änderung → Prüfung ob betroffene Wartungspläne existieren → Notification an Admin.

### Risiko 4: Custom Card Templates

**Beschreibung:** "Jede Firma hat andere Standards" — bedeutet flexible Felder pro Karte.
**Mitigation:** JSONB `custom_fields` Spalte auf `tpm_cards` oder dedizierte `tpm_card_templates` Tabelle. V1: Festes Schema + 1-2 Custom-Felder. V2: Voller Template-Builder.

### Risiko 5: Card-Flip Animation Performance

**Beschreibung:** Bei 50+ Karten gleichzeitig auf dem Board → Performance?
**Mitigation:** Virtual Scrolling oder Pagination. CSS `transform: rotateY()` ist GPU-beschleunigt — kein JS-Problem. Lazy Loading für Board-Sektionen.

---

## 10. Pattern-Referenzen aus bestehendem Code

### Vacation als Referenz-Pattern

| TPM-Feature | Vacation-Äquivalent | Datei |
| ----------- | ------------------- | ----- |
| Freigabe-Flow | Vacation Request Approval | `vacation-notification.service.ts` |
| Status-Wechsel | Request Status (pending→approved→rejected) | `vacation.service.ts` |
| Notification Dual Pattern | EventBus + Persistent | `vacation-notification.service.ts` |
| Slot-Prüfung | Blackout Dates + Employee Count | `vacation.service.ts` |
| Employee-sieht-nur-eigene | User-based filtering | `vacation.service.ts` |

### KVP als Referenz-Pattern

| TPM-Feature | KVP-Äquivalent | Datei |
| ----------- | -------------- | ----- |
| Custom Farben | Color Picker bei Definitions | `kvp/` Module |
| Multi-Team + Machine | kvp_suggestion_organizations | Migration `20260218000040` |
| Status-Historie | kvp_status_history | `kvp.service.ts` |

### Machine Availability als Referenz-Pattern

| TPM-Feature | Machine-Availability-Äquivalent | Datei |
| ----------- | ------------------------------- | ----- |
| Auto-Status setzen | updateAvailability() | `machine-availability.service.ts` |
| Batch-Query | getMachineAvailabilityBatch() | `machine-availability.service.ts` |
| Date-Range-Overlap | getMachineAvailabilityForDateRange() | `machine-availability.service.ts` |

---

## 11. Zusammenfassung

### Scorecard

| Kategorie | Bestätigt | Korrektur | Muss gebaut werden | Erweiterung |
| --------- | --------- | --------- | ------------------- | ----------- |
| Maschinen | 4 | 2 | 0 | 2 |
| Shifts | 2 | 0 | 1 | 1 |
| Availability | 2 | 0 | 0 | 0 |
| Teams/Departments | 3 | 1 | 0 | 0 |
| Permissions | 4 | 0 | 2 | 0 |
| Notifications | 4 | 0 | 1 | 3 |
| **GESAMT** | **19** | **3** | **4** | **6** |

### Bottom Line

**Das Fundament ist extrem solide.** 19 von 26 überprüften Annahmen sind 1:1 bestätigt. Die 3 Korrekturen sind minor (Sprachhinweis, Audit-Trail-Unterscheidung, Lead=Admin-Constraint). Die 4 fehlenden Teile und 6 Erweiterungen sind klar definiert und folgen bestehenden Patterns.

**Stärkste Hebel für TPM:**
1. `machine_teams` + `user_teams` (Multi-Team) = Joker-Team-Konzept funktioniert out-of-the-box
2. `machine_availability` = Auto-Status-Pattern steht bereit
3. `shifts.machine_id` = Slot-Assistant hat direkte Datenquelle
4. Notification Feature Pattern (ADR-004) = Badge + SSE sofort nutzbar
5. Permission Registry (ADR-020) = TPM registriert sich einfach selbst
6. Vacation Pattern = Freigabe-Flow als direkte Vorlage

**Größte Build-Herausforderungen:**
1. Intervall-Kaskade-Logik (Business-Regel, keine Vorlage im System)
2. Slot-Verfügbarkeits-Assistent (4 Datenquellen, komplexe Abfrage)
3. Kamishibai Board UI (neues Frontend-Konzept, kein bestehendes Äquivalent)
4. Escalation Engine (Scheduler/Cron, aktuell kein Pattern dafür im System)
