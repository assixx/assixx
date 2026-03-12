# TPM Brainstorming — Ecosystem-Verification

> **Erstellt:** 2026-02-18
> **Zweck:** Jede Sektion aus `brainstorming-TPM.md` mit konkreten Andockpunkten im Ecosystem verknüpfen
> **Struktur:** Spiegelt 1:1 die Brainstorming-Sektionen — für jede zeigt: DB-Tabellen, ADRs, Backend-Services (Dateipfad + Methode), Status
> **Methode:** 8 Exploration-Agents auf Codebase, ADRs, Migrations, Services

---

## Legende

| Symbol | Bedeutung                                         |
| ------ | ------------------------------------------------- |
| ✅     | Existiert — direkt nutzbar, kein neuer Code nötig |
| 🔄     | Existiert, muss aber für TPM erweitert werden     |
| ❌     | Existiert nicht — muss neu gebaut werden          |

---

## 1. Sidebar Navigation

> Brainstorming: Sektion "1. Sidebar Navigation"

```
Lean Management          [1]  ← Notification Badge
  └── TPM                [1]  ← Anstehende Wartungen
```

### Backend-Andockpunkte

| Was                     | Status | Dateipfad                                             | Detail                                                              |
| ----------------------- | ------ | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Navigation Config       | 🔄     | `frontend/src/routes/(app)/_lib/navigation-config.ts` | `NavItem` Interface mit `addonCode?: string` und `badgeType?` Union |
| Addon-Filter            | ✅     | gleiche Datei, `filterMenuByAddons()`                 | Filtert Items wo `addonCode` nicht in `activeAddons`                |
| Lean Management Submenu | ✅     | gleiche Datei, `LEAN_ADMIN_SUBMENU[]`                 | KVP ist schon drin — TPM als weiteres SubItem daneben               |

### Konkretes Beispiel (bestehendes Pattern)

```typescript
// navigation-config.ts — so sieht KVP aus, TPM wird identisch
const LEAN_ADMIN_SUBMENU: NavItem[] = [
  {
    id: 'kvp',
    label: LABELS.KVP_SYSTEM,
    addonCode: 'kvp', // ← Addon-Flag
    submenu: [
      { id: 'kvp-main', label: 'Vorschläge', url: '/kvp', badgeType: 'kvp' },
      { id: 'kvp-categories', label: 'Definitionen', url: '/kvp-categories' },
    ],
  },
];
```

### Was muss gemacht werden

- 🔄 `NavItem.badgeType` Union erweitern um `'tpm'`
- 🔄 `LEAN_ADMIN_SUBMENU` + `LEAN_SHARED_SUBMENU` — TPM-Einträge hinzufügen mit `addonCode: 'tpm'`

### ADR-Referenz

- **ADR-024** Frontend Addon Guards — `addonCode` steuert Sichtbarkeit

---

## 2. TPM Dashboard (Hauptseite)

> Brainstorming: Sektion "2. TPM Hauptseite (Dashboard)"

### Backend-Andockpunkte

| Was                  | Status | Dateipfad                                                | Detail                                                                     |
| -------------------- | ------ | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Dashboard Counts API | 🔄     | `backend/src/nest/dashboard/dashboard.service.ts`        | `fetchAllCounts()` — parallel alle Feature-Counts via `Promise.all()`      |
| Dashboard Counts DTO | 🔄     | `backend/src/nest/dashboard/dto/dashboard-counts.dto.ts` | Zod-Schema `DashboardCountsSchema` — jedes Feature hat `{ count: number }` |
| Dashboard Controller | ✅     | `backend/src/nest/dashboard/dashboard.controller.ts`     | `GET /dashboard/counts` — Cache-Control 30s, JWT-geschützt                 |
| Feature Access Guard | ✅     | `dashboard.service.ts:createGuard()`                     | Pro Feature: prüft ob Tenant das Feature hat, sonst Fallback               |

### Konkretes Beispiel (bestehendes Pattern)

```typescript
// dashboard.service.ts — so wird Vacation gezählt, TPM identisch
private async fetchVacationCount(userId: number, tenantId: number): Promise<{ count: number }> {
  const rows = await this.db.query<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM notifications n
     LEFT JOIN notification_read_status nrs ON n.id = nrs.notification_id AND nrs.user_id = $2
     WHERE n.tenant_id = $1 AND n.type = 'vacation'
       AND n.recipient_type = 'user' AND n.recipient_id = $2 AND nrs.id IS NULL`,
    [tenantId, userId],
  );
  return { count: Number.parseInt(rows[0]?.count ?? '0', 10) };
}
```

### Was muss gemacht werden

- 🔄 `DashboardCountsSchema` erweitern: `tpm: CountItemSchema`
- 🔄 `fetchAllCounts()` — neuen `g('tpm', () => this.fetchTpmCount(uid, tenantId), EMPTY_COUNT)` Call hinzufügen
- ❌ `fetchTpmCount()` Methode implementieren (zählt ungelesene TPM-Notifications)

### ADR-Referenz

- **ADR-004** Persistent Notification Counts — Badge-Counts pro Feature

---

## 3. Zeiterfassung pro Anlage (SOLL)

> Brainstorming: Sektion "3. Zeiterfassung pro Anlage" + Entscheidung E2

### Backend-Andockpunkte

| Was                                          | Status | Dateipfad                                      | Detail                                                                  |
| -------------------------------------------- | ------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| machine_maintenance_history.duration_hours   | ✅     | DB Baseline `001_baseline_complete_schema.sql` | `NUMERIC(5,2)` — existiert, ist aber Gesamt-Dauer (kein Vor/Durch/Nach) |
| machines.last_maintenance / next_maintenance | ✅     | gleiche Migration                              | `TIMESTAMP` Spalten, TPM kann diese aktualisieren                       |

### Was muss gemacht werden

- ❌ Neue Tabelle `tpm_time_estimates` mit Spalten: `asset_id`, `interval_type`, `staff_count`, `preparation_minutes`, `execution_minutes`, `followup_minutes`
- ❌ CRUD-Service für Zeitschätzungen

### ADR-Referenz

- Keine spezifische ADR — folgt Standard DB-Migration-Pattern (ADR-014)

---

## 4. Wartungsplan-Erstellung

> Brainstorming: Sektion "4. Wartungsplan-Erstellung" + Entscheidungen E6, E7

### Backend-Andockpunkte

| Was                         | Status | Dateipfad                                       | Detail                                                                                           |
| --------------------------- | ------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| machines CRUD               | ✅     | `backend/src/nest/machines/machines.service.ts` | Facade-Service, delegiert an Sub-Services                                                        |
| machines Tabelle            | ✅     | DB Baseline                                     | 30+ Spalten inkl. `next_maintenance`, `last_maintenance`, `department_id`, `area_id`, `location` |
| machine_maintenance_history | ✅     | DB Baseline                                     | `maintenance_type ENUM (preventive, corrective, inspection, calibration, cleaning, other)`       |

### DB-Schema (existierend, relevant)

```sql
-- machines Tabelle — Kern-Felder für Wartungsplan
machines.next_maintenance  TIMESTAMP     -- TPM berechnet das
machines.last_maintenance  TIMESTAMP     -- TPM aktualisiert das
machines.status            ENUM          -- operational, maintenance, repair, standby, decommissioned
machines.department_id     INTEGER FK    -- Zuordnung zu Abteilung
machines.area_id           INTEGER FK    -- Zuordnung zu Bereich
```

### Was muss gemacht werden

- ❌ Neue Tabelle `tpm_maintenance_plans` — Plan pro Anlage mit Basis-Intervall (Wochentag, Wiederholung, Uhrzeit)
- ❌ Intervall-Berechnung: Aus Basis-Intervall alle Termine ableiten (T, W, M, VJ, HJ, J, LL, Custom)
- ❌ Bei TPM-Abschluss: Bridge-Eintrag in `machine_maintenance_history` schreiben + `machines.last_maintenance` / `machines.next_maintenance` aktualisieren

### ADR-Referenz

- **ADR-014** Database Migration Architecture — Migrations für neue Tabellen
- **ADR-019** Multi-Tenant RLS Isolation — `tenant_id` + RLS Policy auf allen TPM-Tabellen

---

## 5. Slot-Verfügbarkeits-Assistent

> Brainstorming: Sektion "4. CRITICAL: Slot-Verfügbarkeits-Assistent!" + Entscheidungen E14, E15

### Backend-Andockpunkte — 4 Datenquellen

| Datenquelle           | Status | Service                      | Methode                                                              | Dateipfad                                                 |
| --------------------- | ------ | ---------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| Schichtplan           | ✅     | `ShiftsService`              | `findAll({ asset_Id, date, userId })`                                | `backend/src/nest/shifts/shifts.service.ts`               |
| User-Verfügbarkeit    | ✅     | `UserAvailabilityService`    | `getUserAvailabilityBatch(userIds, tenantId)`                        | `backend/src/nest/users/user-availability.service.ts`     |
| Anlagen-Verfügbarkeit | ✅     | `MachineAvailabilityService` | `getMachineAvailabilityForDateRange(asset_Id, tenantId, start, end)` | `backend/src/nest/machines/asset-availability.service.ts` |
| Bestehende TPM-Pläne  | ❌     | —                            | —                                                                    | Muss gebaut werden                                        |

### DB-Schema (existierend, Abfrage-relevant)

```sql
-- Schichtplan: Welche MA sind wann eingeteilt?
shifts.asset_id    INTEGER FK → machines(id) [nullable]
shifts.user_id       INTEGER FK → users(id)
shifts.date          DATE
shifts.start_time    TIME
shifts.end_time      TIME
shift_plans.asset_id INTEGER FK → machines(id) [nullable]

-- User-Verfügbarkeit: Wer ist an dem Tag verfügbar?
user_availability.status  ENUM ('available','unavailable','vacation','sick','training','other')
user_availability.start_date  DATE
user_availability.end_date    DATE

-- Anlagen-Verfügbarkeit: Ist die Anlage frei?
machine_availability.status  ENUM ('operational','maintenance','repair','standby','cleaning','other')
machine_availability.start_date  DATE
machine_availability.end_date    DATE
```

### Konkrete Abfrage-Logik (Slot-Assistant)

```
1. shifts WHERE asset_id = X AND date BETWEEN Y AND Z
   → Welche Schichten nutzen die Anlage? → Wann ist sie FREI?
2. shifts WHERE user_id IN (Instandhaltungsteam) AND date = Z
   → Welche IH-MA sind an dem Tag eingeteilt? → VERFÜGBAR für Wartung
3. machine_availability WHERE asset_id = X AND start_date <= Z AND end_date >= Z
   → Hat die Anlage schon geplante Ausfallzeit?
4. user_availability WHERE user_id IN (Team) AND start_date <= Z AND end_date >= Z
   → Hat ein MA Urlaub/Krank an dem Tag?
```

### Was muss gemacht werden

- ❌ Neuer Service `tpm-slot-assistant.service.ts` — kombiniert alle 4 Datenquellen
- ❌ Endpoint `GET /tpm/plans/:machineUuid/available-slots?startDate=&endDate=`
- ❌ Validierung E15: Prüfung ob Schichtplan für den Zeitraum existiert

### ADR-Referenz

- **ADR-011** Shift Data Architecture — `shifts.asset_id` FK ist die Brücke

---

## 6. Mitarbeiter-Zuweisung

> Brainstorming: Sektion "5. Mitarbeiter-Zuweisung"

### Backend-Andockpunkte

| Was            | Status | Service              | Methode                                                    | Dateipfad                                         |
| -------------- | ------ | -------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| Machine ↔ Team | ✅     | `MachineTeamService` | `setMachineTeams(asset_Id, teamIds, tenantId, assignedBy)` | `backend/src/nest/machines/asset-team.service.ts` |
| Team ↔ User    | ✅     | `TeamsService`       | `getTeamMembers(teamId, tenantId)`                         | `backend/src/nest/teams/teams.service.ts`         |
| Multi-Team     | ✅     | —                    | `user_teams` hat keinen UNIQUE auf `user_id` mehr          | Migration `20260218000040`                        |

### DB-Schema (existierend)

```sql
-- Zugriffskette: Employee → Team → Machine
machine_teams (asset_id, team_id, is_primary, assigned_by, notes)
  UNIQUE (tenant_id, asset_id, team_id)

user_teams (user_id, team_id, role ENUM('member','lead'), tenant_id)
  -- Kein UNIQUE auf user_id → Multi-Team erlaubt seit 20260218
```

### Was muss gemacht werden

- ✅ Nichts — Zuweisungskette existiert vollständig
- TPM nutzt einfach: `machine_teams` JOIN `user_teams` → alle MA einer Anlage

---

## 7. Kamishibai Board

> Brainstorming: Sektion "6. Kamishibai Board" + Entscheidungen E5, E9, E10, E11, E12

### Backend-Andockpunkte

| Was                         | Status         | Detail                                                                                                              |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------- |
| machine_maintenance_history | ✅ aber ⚠️     | **Einfacher Audit Trail** — reicht NICHT für Kamishibai-Logik (keine Intervalle, keine Kaskade, kein Freigabe-Flow) |
| Vacation Approval Pattern   | ✅ als Vorlage | `vacation.service.ts:respondToRequest()` — Transaction mit `FOR UPDATE` Lock, Status-Branching                      |
| Notification Dual Pattern   | ✅ als Vorlage | `vacation-notification.service.ts` — EventBus (SSE) + DB (persistent)                                               |

### Konkretes Approval-Pattern (aus Vacation)

```typescript
// vacation.service.ts — EXACT pattern für TPM-Freigabe-Flow
async respondToRequest(responderId, tenantId, requestId, dto): Promise<VacationRequest> {
  // 1. Lock & Validate mit FOR UPDATE
  const request = await this.lockPendingRequest(client, tenantId, requestId);
  // 2. Branch auf Action
  if (dto.action === 'approved') {
    return this.approveRequest(client, tenantId, responderId, request, dto);
  } else {
    return this.denyRequest(client, tenantId, responderId, request, dto);
  }
}
// NACH Transaction: Notification senden (fail-silent)
this.notificationService.notifyResponded(tenantId, updatedRequest);
```

### Was muss gemacht werden

- ❌ Neue Tabellen: `tpm_cards`, `tpm_card_executions`, `tpm_card_execution_photos`
- ❌ Backend: `tpm-cards.service.ts` — Card CRUD, Status-Logik (GRÜN→ROT→GRÜN oder GRÜN→ROT→GELB→GRÜN)
- ❌ Backend: `tpm-executions.service.ts` — Durchführung mit Doku + Fotos + optionale Freigabe
- ❌ Frontend: `KamishibaiBoard.svelte` — Board-Ansicht mit Intervall-Sektionen, Filter
- ❌ Frontend: `KamishibaiCard.svelte` — Card-Flip mit CSS 3D Transform

### ADR-Referenz

- **ADR-023** Vacation Request Architecture — Referenz-Pattern für Approval-Flow
- **ADR-009** Central Audit Logging — `ActivityLoggerService` für TPM-Aktionen

---

## 8. Card-Flip Animation

> Brainstorming: Sektion "Card-Flip Animation" + Entscheidung E12

### Backend-Andockpunkte

- Keine — reines Frontend-Feature (CSS 3D Transform + Svelte 5 Runes)

### Was muss gemacht werden

- ❌ `KamishibaiCard.svelte` — `rotateY(180deg)`, `backface-visibility: hidden`, `transition: transform 0.4s`
- Performance bei 50+ Karten: CSS `transform` ist GPU-beschleunigt → kein JS-Problem

---

## 9. Intervall-Kaskade

> Brainstorming: Sektion "CRITICAL: Intervall-Kaskade" + Entscheidung E6

### Backend-Andockpunkte

- Keine direkte Vorlage im System — komplett neue Business-Logik

### Was muss gemacht werden

- ❌ Kaskade-Logik in `tpm-cards.service.ts`: Wenn Jährlich fällig → SQL Batch-Update aller kürzeren Intervall-Karten auf ROT
- ❌ Performance-Aspekt: Batch `UPDATE tpm_cards SET status = 'due' WHERE asset_id = X AND interval_order <= Y` statt Einzelupdates
- Schätzung: 20 Anlagen × 8 Intervalle × 5-15 Karten = 800-2400 Karten pro Tenant

---

## 10. Duplikat-Erkennung

> Brainstorming: Sektion "CRITICAL: Duplikat-Erkennung" + Entscheidung E7

### Backend-Andockpunkte

- Keine direkte Vorlage — neue Business-Logik

### Was muss gemacht werden

- ❌ Bei Karten-Erstellung: `SELECT * FROM tpm_cards WHERE asset_id = X AND task_description ILIKE '%suchtext%' AND interval_order < Y`
- ❌ Response enthält Warnung + existierende Karten-Info → Frontend zeigt Dialog

---

## 11. Machine Availability Integration

> Brainstorming: Sektion "Machine Availability Integration" + Entscheidung E8

### Backend-Andockpunkte

| Was                 | Status | Service                      | Methode                                                              | Dateipfad                                                 |
| ------------------- | ------ | ---------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| Availability CRUD   | ✅     | `MachineAvailabilityService` | `updateAvailability(asset_Id, dto, tenantId, createdBy)`             | `backend/src/nest/machines/asset-availability.service.ts` |
| Batch-Query         | ✅     | gleich                       | `getMachineAvailabilityBatch(machineIds, tenantId)`                  | gleich                                                    |
| Date-Range-Query    | ✅     | gleich                       | `getMachineAvailabilityForDateRange(asset_Id, tenantId, start, end)` | gleich                                                    |
| Overlap-Validierung | ✅     | gleich                       | `ConflictException` bei überlappenden Zeiträumen                     | gleich                                                    |

### DB-Schema (existierend)

```sql
CREATE TYPE machine_availability_status AS ENUM (
  'operational', 'maintenance', 'repair', 'standby', 'cleaning', 'other'
);

CREATE TABLE machine_availability (
  id          SERIAL PRIMARY KEY,
  asset_id  INTEGER NOT NULL FK → machines(id),
  tenant_id   INTEGER NOT NULL FK → tenants(id),
  status      machine_availability_status NOT NULL DEFAULT 'operational',
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  reason      VARCHAR(255),
  notes       TEXT,
  created_by  INTEGER FK → users(id),
  CONSTRAINT chk_ma_dates CHECK (end_date >= start_date)
);
-- RLS: tenant_isolation Policy aktiv
-- Migration: 20260214000035_machine-availability.ts
```

### Was muss gemacht werden

- 🔄 Neue Methode `MachineAvailabilityService.createFromTpmPlan()` — erstellt automatisch `status = 'maintenance'` Eintrag wenn Wartungsplan aktiv wird
- ⚠️ Status-Werte sind Englisch (`'maintenance'` nicht `'Wartung'`)

---

## 12. Schichtplan ↔ Wartungsplan Abhängigkeit

> Brainstorming: Sektion "CRITICAL: Schichtplan ↔ Wartungsplan" + Entscheidungen E14, E15

### Backend-Andockpunkte

| Was                                | Status | Service                      | Methode                                                                     | Dateipfad                                   |
| ---------------------------------- | ------ | ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------- |
| Shift CRUD                         | ✅     | `ShiftsService`              | `findAll(filters)` — Filter: date, userId, departmentId, teamId, asset_Id   | `backend/src/nest/shifts/shifts.service.ts` |
| Shift Plans                        | ✅     | gleich                       | `createPlan(dto)` — Plan mit shift_items (userId, date, startTime, endTime) | gleich                                      |
| Shift ↔ Machine FK                 | ✅     | —                            | `shifts.asset_id INTEGER FK → machines(id) [nullable]`                      | DB                                          |
| Shift Calendar                     | ✅     | gleich                       | `getMyCalendarShifts()` — Kalender-Ansicht                                  | gleich                                      |
| Machine Availability im Shift-Grid | ✅     | `MachineAvailabilityService` | `getMachineAvailabilityForDateRange()` — wird schon im Shift-Grid genutzt   | `asset-availability.service.ts`             |

### DB-Schema (existierend)

```sql
shifts.asset_id      INTEGER FK → machines(id) [nullable]
shift_plans.asset_id INTEGER FK → machines(id) [nullable]
shift_plans.start_date DATE
shift_plans.end_date   DATE
```

### Was muss gemacht werden

- ❌ Validierung in TPM-Plan-Erstellung: `IF NOT EXISTS (SELECT 1 FROM shift_plans WHERE ... AND start_date <= planned_date AND end_date >= planned_date) → Warnung`
- 🔄 Shift-Grid Frontend: Toggle "Wartungstermine anzeigen" — Pattern existiert bereits (Machine Availability als farbige Zellen), nur neue Datenquelle (TPM-Pläne)
- ❌ Event-System: Bei Schichtplan-Änderung → Prüfung ob betroffene TPM-Pläne existieren → Notification an Admin

### ADR-Referenz

- **ADR-011** Shift Data Architecture — `shifts.asset_id` FK

---

## 13. Instandhaltungsteam (Joker)

> Brainstorming: Sektion "Instandhaltungsteam = Sonderstatus (Joker)" + Entscheidung E16

### Backend-Andockpunkte

| Was                    | Status | Detail                                                            | Dateipfad                                 |
| ---------------------- | ------ | ----------------------------------------------------------------- | ----------------------------------------- |
| Multi-Team Membership  | ✅     | `user_teams` hat keinen UNIQUE mehr auf `user_id`                 | Migration `20260218000040`                |
| Machine-Team optional  | ✅     | `machine_teams.is_primary` Flag — IH-Team muss NICHT primary sein | `asset-team.service.ts`                   |
| Team mit Lead + Deputy | ✅     | `teams.team_lead_id` + `teams.deputy_lead_id`                     | `backend/src/nest/teams/teams.service.ts` |

### Konsequenz

Ein MA kann gleichzeitig in "Produktion Halle 3" (Bediener) UND "Instandhaltungsteam" (Wartungstechniker) sein → Joker-Konzept funktioniert out-of-the-box. Kein neuer Code nötig.

---

## 14. TPM-Karten

> Brainstorming: Sektion "7. TPM-Karten" + Entscheidungen E1, E3, E4

### Backend-Andockpunkte

| Was                         | Status        | Detail                                                             | Dateipfad                                                |
| --------------------------- | ------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| machine_maintenance_history | ✅ als Bridge | Einfacher Audit Trail — TPM-Abschluss schreibt ZUSÄTZLICH hierhin  | `backend/src/nest/machines/asset-maintenance.service.ts` |
| maintenance_type ENUM       | ✅            | `preventive, corrective, inspection, calibration, cleaning, other` | DB Baseline                                              |

### ⚠️ KRITISCH: machine_maintenance_history reicht NICHT

Die bestehende Tabelle ist ein flacher Audit Trail (1 Zeile pro Event). Für Kamishibai brauchen wir:

- Intervall-Typ pro Karte (T, W, M, VJ, HJ, J, LL, C)
- Karten-Status (grün, rot, gelb)
- Freigabe-Flag + Freigabe-Historie
- Namenskonvention (BT1, BW2, IV13 etc.)
- Foto-Referenzen (Örtlichkeit)
- Kaskaden-Logik

### Was muss gemacht werden

- ❌ `tpm_cards` — Kamishibai-Karten mit Intervall, Status, Freigabe-Flag, Namenskürzel, Beschreibung, Örtlichkeit
- ❌ `tpm_card_executions` — Durchführungs-Historie (wer, wann, Doku-Text)
- ❌ `tpm_card_execution_photos` — Fotos zur Durchführung
- ❌ `tpm_card_templates` — Custom Vorlagen pro Tenant
- ❌ Bridge-Logik: TPM-Abschluss → Eintrag in `machine_maintenance_history` (maintenance_type = 'preventive')

---

## 15. Custom Kartenvorlagen + Farben

> Brainstorming: Sektion "Custom Kartenvorlagen" + Entscheidungen E11, E4

### Backend-Andockpunkte (KVP als Referenz-Pattern)

| Was                          | Status         | Service                | Methode                                    | Dateipfad                                                |
| ---------------------------- | -------------- | ---------------------- | ------------------------------------------ | -------------------------------------------------------- |
| Color Validation             | ✅ als Vorlage | KVP DTOs               | Zod: `z.string().regex(/^#[0-9a-f]{6}$/i)` | `backend/src/nest/kvp/dto/create-custom-category.dto.ts` |
| Custom Categories CRUD       | ✅ als Vorlage | `KvpCategoriesService` | `createCustom()`, `updateCustom()`         | `backend/src/nest/kvp/kvp-categories.service.ts`         |
| Tenant-spezifische Seed Data | ✅ als Pattern | —                      | —                                          | ADR-016                                                  |

### Konkretes Color-Pattern (aus KVP)

```typescript
// KVP DTO — Farbvalidierung. Identisch für TPM übernehmen
color: z.string().regex(/^#[0-9a-f]{6}$/i, 'Color must be a valid hex color (e.g. #ff0000)');
```

### Was muss gemacht werden

- ❌ `tpm_color_config` Tabelle (tenant_id, status, color_hex, label) — Default: Grün=#22c55e, Rot=#ef4444, Gelb=#eab308
- ❌ `tpm_card_templates` Tabelle (tenant_id, name, fields JSON, is_default)
- V1: Festes Schema + 1-2 Custom-Felder. V2: Voller Template-Builder.

### ADR-Referenz

- **ADR-016** Tenant Customizable Seed Data — Custom Farben/Templates pro Tenant

---

## 16. Anlagen-Dokumentation

> Brainstorming: Sektion "8. Anlagen-Dokumentation"

### Backend-Andockpunkte

| Was                         | Status   | Detail                                                                                          |
| --------------------------- | -------- | ----------------------------------------------------------------------------------------------- |
| `machine_documents` Tabelle | ✅ in DB | Existiert mit document storage, validity dates, uploaded_by — aber **KEIN Backend-Service**     |
| MachineMaintenanceService   | ✅       | `backend/src/nest/machines/asset-maintenance.service.ts` — hat `report_url VARCHAR(500)` Spalte |

### Was muss gemacht werden

- ❌ Neuer Service: `asset-documents.service.ts` — CRUD für Dokumente (Upload, Liste, Verknüpfung)
- ❌ Neuer Controller + Endpoints: `GET/POST /machines/:uuid/documents`
- ❌ TPM-Karten können dann auf `machine_documents.id` verweisen (Örtlichkeit als Foto)

---

## 17. Permission-Hierarchie

> Brainstorming: Sektion "Permission-Hierarchie (E18)" + Entscheidung E18

### Backend-Andockpunkte

| Was                          | Status | Service / Tabelle                | Detail                                                                           | Dateipfad                                                         |
| ---------------------------- | ------ | -------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| RBAC Basis                   | ✅     | `users.role` + `has_full_access` | root=immer full, admin=konfigurierbar, employee=immer false                      | ADR-010                                                           |
| Admin Area Permissions       | ✅     | `admin_area_permissions`         | `(admin_user_id, area_id, can_read, can_write, can_delete)`                      | DB                                                                |
| Admin Department Permissions | ✅     | `admin_department_permissions`   | `(admin_user_id, department_id, can_read, can_write, can_delete)`                | DB                                                                |
| Permission Registry          | ✅     | `PermissionRegistryService`      | Singleton, jedes Modul registriert sich via `OnModuleInit()`                     | `backend/src/nest/common/permission-registry/`                    |
| User Feature Permissions     | ✅     | `user_addon_permissions`         | `(tenant_id, user_id, addon_code, module_code, can_read, can_write, can_delete)` | DB                                                                |
| Permission Types             | ✅     | `permission.types.ts`            | `PermissionType = 'canRead' \| 'canWrite' \| 'canDelete'`                        | `backend/src/nest/common/permission-registry/permission.types.ts` |

### Konkretes Registration-Pattern (aus Vacation)

```typescript
// vacation.permissions.ts — EXAKT dieses Pattern für TPM kopieren
export const VACATION_PERMISSIONS: PermissionCategoryDef = {
  code: 'vacation',
  label: 'Urlaubsverwaltung',
  icon: 'fa-umbrella-beach',
  modules: [
    {
      code: 'vacation-requests',
      label: 'UrlaubsAnträge',
      icon: 'fa-file-alt',
      allowedPermissions: ['canRead', 'canWrite'],
    },
    {
      code: 'vacation-rules',
      label: 'Regeln & Sperren',
      icon: 'fa-ban',
      allowedPermissions: ['canRead', 'canWrite', 'canDelete'],
    },
    // ...
  ],
};

// vacation-permission.registrar.ts — Registrar
@Injectable()
export class VacationPermissionRegistrar implements OnModuleInit {
  constructor(private readonly registry: PermissionRegistryService) {}
  onModuleInit(): void {
    this.registry.register(VACATION_PERMISSIONS);
  }
}

// vacation.module.ts — Registrar als Provider
providers: [VacationPermissionRegistrar /* ... */];
```

### ⚠️ Korrektur: Lead-Rollen = Admin-Only

`team_lead_id`, `department_lead_id`, `area_lead_id` MÜSSEN `role = 'admin'` haben. Ein Employee kann NICHT Lead sein. Für die Industrie realistisch: Schichtleiter = Admin-User.

### Was muss gemacht werden

- ❌ `tpm.permissions.ts` — TPM Permission Definition (tpm-plans, tpm-cards, tpm-executions, tpm-reports)
- ❌ `tpm-permission.registrar.ts` — Registrar mit `OnModuleInit()`
- ❌ Provider in `tpm.module.ts` registrieren

### ADR-Referenz

- **ADR-010** User Role Assignment Permissions — RBAC-Basis
- **ADR-020** Per-User Feature Permissions — Decentralized Permission Registry

---

## 18. Frontend Route Security

> Brainstorming: Sektion "Frontend Route Security" + Entscheidung E18

### Backend-Andockpunkte

| Was                       | Status | Detail                                                                 | Dateipfad                                                      |
| ------------------------- | ------ | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Route Groups              | ✅     | `(root)/` = nur Root, `(admin)/` = Admin+Root, `(shared)/` = alle Auth | `frontend/src/routes/(app)/`                                   |
| requireAddon()            | ✅     | Redirected zu `/addon-unavailable` wenn Addon nicht aktiv              | `frontend/src/lib/utils/addon-guard.ts`                        |
| TenantAddonGuard          | ✅     | Backend-Guard: prüft `tenant_addons.is_active` + `expires_at`          | `backend/src/nest/common/guards/tenant-addon.guard.ts`         |
| @RequireAddon() Decorator | ✅     | Setzt Metadata auf Controller-Klasse                                   | `backend/src/nest/common/decorators/tenant-addon.decorator.ts` |

### Konkretes Pattern (aus Blackboard)

```typescript
// Backend Controller — Feature-Gate auf Controller-Ebene
@Controller('blackboard')
@RequireAddon('blackboard') // ← Guard prüft tenant_addons
export class BlackboardController {}

// Frontend +page.server.ts — Feature-Gate auf Route-Ebene
export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (!token) redirect(302, '/login');
  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'blackboard'); // ← Layer 4 Schutz
  // ... fetch data
};
```

### TPM-Routen-Struktur

```
routes/(app)/
├── (admin)/lean-management/tpm/           ← Admin: Pläne erstellen, Karten verwalten
│   └── +page.server.ts                    ← requireAddon(activeAddons, 'tpm')
└── (shared)/lean-management/tpm/          ← Employee: Board ansehen, Karten erledigen
    └── +page.server.ts                    ← requireAddon(activeAddons, 'tpm')
```

### Was muss gemacht werden

- ❌ Addon-Flag 'tpm' in `features` Tabelle + `tenant_addons` Eintrag (Migration)
- ❌ `@RequireAddon('tpm')` auf TPM-Controller
- ❌ `requireAddon(activeAddons, 'tpm')` in jeder TPM `+page.server.ts`

### ADR-Referenz

- **ADR-012** Frontend Route Security Groups — Fail-Closed RBAC
- **ADR-024** Frontend Addon Guards — `requireAddon()` als Layer 4

---

## 19. Freigabe-Flow (Gelb-Status)

> Brainstorming: Sektion "Flow B — Karte MIT Freigabe-Pflicht" + Entscheidung E9

### Backend-Andockpunkte (Vacation als Vorlage)

| Was                     | Status         | Service                       | Methode                                                   | Dateipfad                                       |
| ----------------------- | -------------- | ----------------------------- | --------------------------------------------------------- | ----------------------------------------------- |
| Approval Pattern        | ✅ als Vorlage | `VacationService`             | `respondToRequest(responderId, tenantId, requestId, dto)` | `backend/src/nest/vacation/vacation.service.ts` |
| FOR UPDATE Lock         | ✅ als Vorlage | gleich                        | `lockPendingRequest(client, tenantId, requestId)`         | gleich                                          |
| Status-Branching        | ✅ als Vorlage | gleich                        | `approveRequest()` / `denyRequest()` — separate Methoden  | gleich                                          |
| Post-Transaction Notify | ✅ als Vorlage | `VacationNotificationService` | `notifyResponded(tenantId, request)` — NACH Transaction   | `vacation-notification.service.ts`              |

### Konkretes Pattern

```typescript
// Vacation: Transaction + Lock + Branch + Notification (NACH TX)
async respondToRequest(responderId, tenantId, requestId, dto) {
  return this.db.withTransaction(async (client) => {
    const request = await this.lockPendingRequest(client, tenantId, requestId); // FOR UPDATE
    if (dto.action === 'approved') return this.approveRequest(client, ...);
    return this.denyRequest(client, ...);
  });
  // NACH der Transaction:
  this.notificationService.notifyResponded(tenantId, updatedRequest);
}

// RespondDto: { action: 'approved'|'denied', responseNote?: string }
// Bei 'denied': responseNote REQUIRED (Zod validiert)
```

### TPM-Freigabe-Flow Mapping

```
ROT (fällig) → MA erledigt + Doku → GELB (wartet) → Admin prüft → GRÜN (freigegeben)
                                                   → Admin lehnt ab → ROT (nochmal!)
```

### Was muss gemacht werden

- ❌ `tpm-executions.service.ts` — `completeCard()` (setzt GELB) + `approveExecution()` / `rejectExecution()` (setzt GRÜN/ROT)
- ❌ `RespondTpmExecutionDto` — `{ action: 'approved'|'rejected', responseNote?: string }`
- ❌ Deputy-Lead (teams.deputy_lead_id) muss bei Freigabe berücksichtigt werden

### ADR-Referenz

- **ADR-023** Vacation Request Architecture — 1:1 Vorlage für Approval-Flow

---

## 20. Eskalation bei überfälligen Karten

> Brainstorming: Sektion "Überfällige Karten — Eskalation" + Entscheidung E10

### Backend-Andockpunkte

| Was                  | Status         | Service                            | Methode                                                             | Dateipfad                                                      |
| -------------------- | -------------- | ---------------------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------- |
| @Cron Pattern        | ✅ als Vorlage | `ScheduledMessageProcessorService` | `@Cron(CronExpression.EVERY_MINUTE, { timeZone: 'Europe/Berlin' })` | `backend/src/nest/chat/scheduled-message-processor.service.ts` |
| Concurrency Guard    | ✅ als Vorlage | gleich                             | `isProcessing` Flag + `FOR UPDATE SKIP LOCKED`                      | gleich                                                         |
| OnModuleInit Startup | ✅ als Vorlage | gleich                             | `onModuleInit()` — prüft bei Server-Start auf fällige Items         | gleich                                                         |

### Konkretes Cron-Pattern

```typescript
// scheduled-message-processor.service.ts — EXAKT dieses Pattern für TPM-Eskalation
@Injectable()
export class ScheduledMessageProcessorService implements OnModuleInit {
  private isProcessing = false;

  async onModuleInit(): Promise<void> {
    await this.processScheduledMessages(); // Startup recovery
  }

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'scheduled-message-processor',
    timeZone: 'Europe/Berlin',
  })
  async processAtMinute(): Promise<void> {
    if (this.isProcessing) return; // Guard
    this.isProcessing = true;
    try {
      const due = await this.db.query(
        `SELECT * FROM ... WHERE scheduled_for <= NOW()
         FOR UPDATE SKIP LOCKED LIMIT $1`,
        [BATCH_SIZE],
      );
      // Process each...
    } finally {
      this.isProcessing = false;
    }
  }
}
```

### Was muss gemacht werden

- ❌ `tpm-escalation.service.ts` — `@Cron` prüft jede Minute auf überfällige Karten
- ❌ `tpm_escalation_config` Tabelle (tenant_id, escalation_after_hours, notify_role)
- ❌ Eskalations-Logik: Karte ROT + Frist überschritten → Notification an Team-Lead/Admin

---

## 21. Notifications (SSE + Persistent)

> Brainstorming: Sektion "Sidebar Navigation" Badge + alle Status-Änderungen

### Backend-Andockpunkte

| Was                          | Status | Service / Datei            | Detail                                                                                                                              |
| ---------------------------- | ------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| EventBus Singleton           | ✅     | `eventBus`                 | `backend/src/utils/eventBus.ts` — `emit*(tenantId, payload)` Methoden                                                               |
| SSE Controller               | ✅     | `NotificationsController`  | `backend/src/nest/notifications/notifications.controller.ts` — `@Sse('stream')`                                                     |
| SSE Handler Factory          | ✅     | gleich                     | `createSSEHandler(messageType, dataKey, tenantId, eventSubject)`                                                                    |
| Feature-Notification Service | ✅     | `NotificationAddonService` | `backend/src/nest/notifications/notification-addon.service.ts` — `createAddonNotification()`                                        |
| Persistent Insert            | ✅     | gleich                     | `INSERT INTO notifications (tenant_id, type, title, message, priority, recipient_type, recipient_id, ...)`                          |
| Mark as Read                 | ✅     | gleich                     | `markFeatureTypeAsRead(type, userId, tenantId)` — Batch mit CTE                                                                     |
| Notification Store           | 🔄     | `NotificationCounts`       | `frontend/src/lib/stores/notification.store.svelte.ts` — `{ total, surveys, documents, kvp, chat, blackboard, calendar, vacation }` |
| SSE→Count Mapping            | 🔄     | gleich                     | `SSE_EVENT_TO_COUNT Map` — muss TPM-Events hinzufügen                                                                               |
| Recipient Types              | ✅     | DB                         | `ENUM ('user', 'department', 'team', 'all')`                                                                                        |
| Priority Levels              | ✅     | DB                         | `ENUM ('low', 'normal', 'medium', 'high', 'urgent')`                                                                                |

### Konkretes Dual-Notification-Pattern (aus Vacation)

```typescript
// vacation-notification.service.ts — Dual: EventBus + DB
notifyCreated(tenantId: number, request: VacationRequest): void {
  // 1. Real-time (SSE)
  eventBus.emitVacationRequestCreated(tenantId, this.toEventPayload(request));
  // 2. Persistent (DB)
  void this.createPersistentNotification(tenantId, recipientId, title, message, ...);
}
```

### Neue TPM-Events (müssen gebaut werden)

| Event                       | Trigger                        | Priority        | Empfänger                          |
| --------------------------- | ------------------------------ | --------------- | ---------------------------------- |
| `TPM_MAINTENANCE_DUE`       | Karte wird ROT                 | `normal`        | `user` (zugewiesener MA)           |
| `TPM_MAINTENANCE_OVERDUE`   | Eskalationsfrist überschritten | `high`/`urgent` | `user` (Team-Lead)                 |
| `TPM_MAINTENANCE_COMPLETED` | MA klickt "Done"               | `normal`        | `user` (Admin bei Freigabe-Karten) |
| `TPM_APPROVAL_REQUIRED`     | Karte wird GELB                | `medium`        | `user` (Team-Lead/Deputy)          |
| `TPM_APPROVAL_REJECTED`     | Admin lehnt ab                 | `high`          | `user` (MA der erledigt hat)       |

### Was muss gemacht werden

- 🔄 `NotificationCounts` Interface: `tpm: number` hinzufügen
- 🔄 `SSE_EVENT_TO_COUNT` Map: TPM-Events → `'tpm'` Mapping
- 🔄 `DashboardCountsSchema`: `tpm: CountItemSchema`
- ❌ EventBus: 5 neue `emit*()` Methoden für TPM
- ❌ SSE Controller: TPM-Handler registrieren (Feature-gefiltert)
- ❌ `tpm-notification.service.ts` — Dual-Pattern: EventBus + DB

### ADR-Referenz

- **ADR-003** Notification System — SSE-Pattern
- **ADR-004** Persistent Notification Counts — Badge-Counts

---

## 22. Intervall-Typen

> Brainstorming: Sektion "9. Intervall-Typen" + Entscheidung E4

### Backend-Andockpunkte

- Keine existierende Intervall-Logik im System — komplett neu

### DB-Enum (muss erstellt werden)

```sql
CREATE TYPE tpm_interval_type AS ENUM (
  'daily', 'weekly', 'monthly', 'quarterly', 'semi_annual', 'annual', 'long_runner', 'custom'
);
```

### Kaskade-Ordnung (für Batch-Updates)

| Intervall       | interval_order | Kürzel |
| --------------- | -------------- | ------ |
| Täglich         | 1              | T      |
| Wöchentlich     | 2              | W      |
| Monatlich       | 3              | M      |
| Vierteljährlich | 4              | VJ     |
| Halbjährlich    | 5              | HJ     |
| Jährlich        | 6              | J      |
| Langläufer      | 7              | LL     |
| Custom          | 8              | C      |

### Was muss gemacht werden

- ❌ ENUM + `interval_order` Spalte auf `tpm_cards` — ermöglicht Kaskade via `WHERE interval_order <= X`

---

## Zusammenfassung: Andockpunkte-Scorecard

### Direkt nutzbar (kein neuer Code)

| #   | Was                            | Andockpunkt                                                                            |
| --- | ------------------------------ | -------------------------------------------------------------------------------------- |
| 1   | Machine CRUD + UUID + RLS      | `MachinesService` → `backend/src/nest/machines/machines.service.ts`                    |
| 2   | Machine ↔ Team Assignment      | `MachineTeamService.setMachineTeams()` → `asset-team.service.ts`                       |
| 3   | User ↔ Team (Multi-Team)       | `user_teams` (kein UNIQUE) → Migration `20260218000040`                                |
| 4   | Machine Availability CRUD      | `MachineAvailabilityService.updateAvailability()` → `asset-availability.service.ts`    |
| 5   | Machine Availability Batch     | `MachineAvailabilityService.getMachineAvailabilityBatch()` → gleich                    |
| 6   | Machine Availability DateRange | `MachineAvailabilityService.getMachineAvailabilityForDateRange()` → gleich             |
| 7   | User Availability Batch        | `UserAvailabilityService.getUserAvailabilityBatch()` → `user-availability.service.ts`  |
| 8   | Shifts + Machine FK            | `ShiftsService.findAll({ asset_Id })` → `shifts.service.ts`                            |
| 9   | Route Groups                   | `(admin)/`, `(shared)/` → `frontend/src/routes/(app)/`                                 |
| 10  | requireAddon()                 | `frontend/src/lib/utils/addon-guard.ts`                                                |
| 11  | TenantAddonGuard               | `@RequireAddon('tpm')` → `tenant-addon.guard.ts`                                       |
| 12  | Permission Registry            | `PermissionRegistryService.register()` → `permission-registry/`                        |
| 13  | Activity Logger                | `ActivityLoggerService` → ADR-009                                                      |
| 14  | Notification Addon Service     | `NotificationAddonService.createAddonNotification()` → `notification-addon.service.ts` |
| 15  | EventBus Singleton             | `eventBus.emit*()` → `backend/src/utils/eventBus.ts`                                   |
| 16  | SSE Stream                     | `NotificationsController.stream()` → `notifications.controller.ts`                     |
| 17  | Multi-Tenant RLS               | Alle Tabellen mit `tenant_id` + RLS Policy                                             |
| 18  | Org-Hierarchie                 | `areas` → `departments` → `teams` → `user_teams`                                       |
| 19  | Deputy Lead                    | `teams.deputy_lead_id` → für Freigabe-Vertretung                                       |

### Muss erweitert werden (bestehende Module ändern)

| #   | Was                           | Wo                              | Änderung                                 |
| --- | ----------------------------- | ------------------------------- | ---------------------------------------- |
| 1   | Navigation Config             | `navigation-config.ts`          | TPM-Einträge + badgeType Union           |
| 2   | Notification Store            | `notification.store.svelte.ts`  | `tpm: number` in Interface + SSE Mapping |
| 3   | Dashboard Counts              | `dashboard.service.ts` + DTO    | `fetchTpmCount()` + Schema-Erweiterung   |
| 4   | Machine Availability Auto-Set | `asset-availability.service.ts` | `createFromTpmPlan()` Methode            |
| 5   | Shift-Grid Toggle             | `/shifts/` Frontend             | "Wartungstermine anzeigen" Toggle        |
| 6   | SSE Handler                   | `notifications.controller.ts`   | TPM Event-Handler registrieren           |
| 7   | EventBus                      | `eventBus.ts`                   | 5 neue `emit*()` Methoden                |
| 8   | machine_maintenance_history   | `asset-maintenance.service.ts`  | Bridge: TPM-Abschluss → History-Eintrag  |

### Muss neu gebaut werden

| #   | Komponente                  | Neue Dateien                                                                                                                                                                                 |
| --- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | TPM Backend Module          | `backend/src/nest/tpm/` (Service, Controller, DTOs, Module)                                                                                                                                  |
| 2   | TPM DB-Tabellen             | Migration: `tpm_maintenance_plans`, `tpm_cards`, `tpm_card_executions`, `tpm_card_execution_photos`, `tpm_time_estimates`, `tpm_card_templates`, `tpm_escalation_config`, `tpm_color_config` |
| 3   | TPM Permission              | `tpm.permissions.ts` + `tpm-permission.registrar.ts`                                                                                                                                         |
| 4   | TPM Feature Flag            | Migration: `INSERT INTO addons` + `tenant_addons`                                                                                                                                            |
| 5   | TPM Notification Service    | `tpm-notification.service.ts` — Dual EventBus + DB                                                                                                                                           |
| 6   | Slot Availability Assistant | `tpm-slot-assistant.service.ts` — 4 Datenquellen                                                                                                                                             |
| 7   | Interval Cascade Logic      | In `tpm-cards.service.ts` — Batch-Update                                                                                                                                                     |
| 8   | Duplicate Detection         | In `tpm-cards.service.ts` — ILIKE-Suche                                                                                                                                                      |
| 9   | Approval Flow               | `tpm-executions.service.ts` — FOR UPDATE + Status-Branching                                                                                                                                  |
| 10  | Escalation Engine           | `tpm-escalation.service.ts` — @Cron + Notification                                                                                                                                           |
| 11  | Machine Documents Backend   | `asset-documents.service.ts` — CRUD für existierende Tabelle                                                                                                                                 |
| 12  | Kamishibai Board Frontend   | `frontend/src/lib/tpm/KamishibaiBoard.svelte`                                                                                                                                                |
| 13  | Card Flip Component         | `frontend/src/lib/tpm/KamishibaiCard.svelte`                                                                                                                                                 |
| 14  | TPM Dashboard Page          | `routes/(app)/(admin)/lean-management/tpm/+page.svelte`                                                                                                                                      |
| 15  | TPM Board Page              | `routes/(app)/(shared)/lean-management/tpm/board/+page.svelte`                                                                                                                               |
| 16  | TPM Plan Pages              | `routes/(app)/(admin)/lean-management/tpm/plan/`                                                                                                                                             |

---

## Referenz-Patterns (Dateipfade)

| Pattern                 | Quelle        | Dateipfad                                                                                |
| ----------------------- | ------------- | ---------------------------------------------------------------------------------------- |
| Permission Registration | Vacation      | `backend/src/nest/vacation/vacation.permissions.ts` + `vacation-permission.registrar.ts` |
| Approval Flow           | Vacation      | `backend/src/nest/vacation/vacation.service.ts` (respondToRequest)                       |
| Dual Notification       | Vacation      | `backend/src/nest/vacation/vacation-notification.service.ts`                             |
| Cron Scheduler          | Chat          | `backend/src/nest/chat/scheduled-message-processor.service.ts`                           |
| Color Config            | KVP           | `backend/src/nest/kvp/dto/create-custom-category.dto.ts`                                 |
| Addon Guard Backend     | Common        | `backend/src/nest/common/guards/tenant-addon.guard.ts`                                   |
| Addon Guard Frontend    | Utils         | `frontend/src/lib/utils/addon-guard.ts`                                                  |
| SSE Stream              | Notifications | `backend/src/nest/notifications/notifications.controller.ts`                             |
| Dashboard Counts        | Dashboard     | `backend/src/nest/dashboard/dashboard.service.ts`                                        |
| Machine Availability    | Machines      | `backend/src/nest/machines/asset-availability.service.ts`                                |
