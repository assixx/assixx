# FEAT: TPM Schedule Projection — Execution Masterplan

> **Created:** 2026-02-23
> **Version:** 2.0.0
> **Status:** COMPLETE — All 8 sessions done
> **Branch:** `feature/TPM`
> **Spec:** [brainstorming-TPM.md](./brainstorming-TPM.md)
> **Context:** [FEAT_TPM_MASTERPLAN.md](./FEAT_TPM_MASTERPLAN.md) (v2.0.0 — TPM Feature complete)
> **ADR:** [ADR-026-tpm-architecture.md](./infrastructure/adr/ADR-026-tpm-architecture.md)
> **Author:** SCS + Claude (Senior Engineer)
> **Estimated Sessions:** 8
> **Actual Sessions:** 8 / 8

---

## Changelog

| Version | Datum      | Änderung                                                             |
| ------- | ---------- | -------------------------------------------------------------------- |
| 0.1.0   | 2026-02-23 | Initial Draft — 6 Phasen, 8 Sessions geplant                         |
| 1.1.0   | 2026-02-23 | Phase 1 complete: Migration 049 + Types + DTOs + Helpers + Service   |
| 1.2.0   | 2026-02-23 | Phase 2 complete: ScheduleProjectionService + Endpoint + Module      |
| 1.3.0   | 2026-02-23 | Phase 3 complete: SlotAssistant 5th data source tpm_schedule         |
| 1.4.0   | 2026-02-23 | Phase 4 complete: Frontend PlanForm bufferHours input + types        |
| 1.5.0   | 2026-02-24 | Phase 5a complete: SlotAssistant Kalender-Grid + Schedule Projection |
| 1.6.0   | 2026-02-24 | Phase 5b complete: TimelineDayView + Day click interaction           |
| 1.7.0   | 2026-02-24 | Phase 6 Steps 6.1+6.2 complete: 20 Unit + 13 API Integration Tests   |
| 2.0.0   | 2026-02-24 | FEATURE COMPLETE: ADR-026 updated, Post-Mortem, all 8 sessions done  |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## Motivation

### Problem (IST-Zustand)

Wenn ein Admin einen neuen TPM-Wartungsplan erstellt, sieht er **nicht**, welche Zeitfenster
bereits durch bestehende TPM-Pläne (auf anderen Anlagen) belegt sind. Das führt zu:

1. **Ressourcenkonflikte** — Dasselbe Wartungsteam kann nicht gleichzeitig 2 Anlagen warten
2. **Blinde Planung** — Admin muss manuell in jedem Plan nachschauen, welche Zeiten belegt sind
3. **Keine Zeitfenster** — `base_time` existiert, aber es gibt kein Dauer/Puffer-Konzept
4. **90-Tage-Limit** — Quartals-/Halbjahres-/Jahresintervalle nicht planbar

### Was der Slot Assistant heute zeigt (4 Datenquellen)

| Quelle                | Was geprüft wird                             | Status                                                         |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| Schichtpläne          | Existiert eine Schicht an dem Tag?           | OK                                                             |
| Anlagenstillstand     | `machine_availability` Status != operational | OK                                                             |
| Bestehende TPM-Karten | Nur `status IN ('red', 'overdue')`           | **Falsch** — zeigt nur FÄLLIGE Karten, nicht den Plan-Rhythmus |
| User-Verfügbarkeit    | Urlaub, krank, etc.                          | OK                                                             |

### Was fehlt

1. **Projizierte Termine** — Berechneter Rhythmus aller bestehenden Pläne in die Zukunft
2. **Zeitfenster mit Puffer** — `base_time` + `buffer_hours` = Wartungsfenster (z.B. 09:00–14:00)
3. **Cross-Plan Sichtbarkeit** — Alle TPM-Pläne des Tenants auf einen Blick
4. **Zeitleisten-Ansicht** — Tages-Timeline mit Uhrzeiten, nicht nur "Tag verfügbar ja/nein"
5. **365-Tage-Range** — Für jährliche Intervalle

### Ziel (SOLL-Zustand)

Beim Erstellen/Bearbeiten eines TPM-Plans sieht der Admin:

```
Plan erstellen für: Anlage B

┌─ ZEITLEISTE: Montag, 03.03.2026 ─────────────────────────────┐
│  06   08   10   12   14   16   18   20   22                   │
│  │    │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│    │    │    │    │                  │
│  │    │ Plan X (Masch.A)│    │    │    │    │                  │
│  │    │ Wöchentlich      │    │    │    │    │                  │
│  │    │ 09:00–14:00      │    │    │    │    │                  │
│  │    │    │    │    │    │▓▓▓▓▓▓▓▓▓▓▓▓│    │                  │
│  │    │    │    │    │    │ Plan Z (C) │    │                  │
│  │    │    │    │    │    │ 14:00–18:00│    │                  │
│  ├────┤    │    │    │    │    │    │    ├────┤                  │
│  │FREI│    │    │    │    │    │    │    │FREI│                  │
│  │6-9 │    │    │    │    │    │    │    │18+ │                  │
└───────────────────────────────────────────────────────────────┘
```

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] Branch `feature/TPM` checked out
- [ ] Keine pending Migrations (aktueller Stand: Migration 048)
- [ ] TPM Feature v2.0.0 complete (29 Sessions)
- [ ] Enhanced Execution Fields (Session 30) deployed

### 0.2 Risk Register

| #   | Risiko                                                 | Impact  | Wahrscheinlichkeit | Mitigation                                                      | Verifikation                                                                |
| --- | ------------------------------------------------------ | ------- | ------------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| R1  | Performance: Projektion aller Pläne × 365 Tage = N×365 | Mittel  | Mittel             | Lazy Loading: nur 90 Tage default, 365 auf Anfrage. Caching.    | API-Test: 10 Pläne × 365 Tage < 500ms                                       |
| R2  | Intervall-Berechnung divergiert Frontend/Backend       | Hoch    | Niedrig            | NUR Backend rechnet, Frontend zeigt nur an                      | Unit Test: Projektion vs. `isMaintenanceDate()` Ergebnisse                  |
| R3  | `buffer_hours` Migration bricht bei bestehenden Plänen | Niedrig | Niedrig            | `DEFAULT 4` — bestehende Pläne bekommen automatisch 4h          | `SELECT count(*) FROM tpm_maintenance_plans WHERE buffer_hours IS NULL` = 0 |
| R4  | Slot Assistant Regression durch 5. Datenquelle         | Mittel  | Mittel             | Bestehende Tests unverändert, neue Tests NUR für `tpm_schedule` | Alle 22 Slot-Tests bleiben grün                                             |
| R5  | Frontend Timeline-Ansicht zu komplex für V1            | Mittel  | Hoch               | Phase 5a (Kalender-Update) und Phase 5b (Timeline) trennen      | 5a liefert bereits Wert ohne 5b                                             |

### 0.3 Ecosystem Integration Points

| Bestehendes System   | Art der Integration                                         | Phase | Verifiziert am |
| -------------------- | ----------------------------------------------------------- | ----- | -------------- |
| SlotAssistantService | 5. Datenquelle: `tpm_schedule` Conflict-Type                | 3     | 2026-02-23     |
| PlanForm.svelte      | Neues `buffer_hours` Input-Feld                             | 4     | 2026-02-23     |
| SlotAssistant.svelte | Kalender-Grid: `tpm_schedule` Conflict-Anzeige + Range 365d | 5a    | 2026-02-24     |
| PlansIntervalService | Wiederverwendung für Termin-Projektion                      | 2     | 2026-02-23     |
| ADR-026              | Section 3, 4, 5, 6, 10 aktualisiert                         | 6     | 2026-02-24     |

---

## Phase 1: Database Migration

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** 1 neue Migrationsdatei
> **Letzte Migration:** `20260223000048_tpm-execution-enhanced-fields.ts` → nächste ist `049`

### Step 1.1: buffer_hours Spalte [PENDING]

**Neue Datei:** `database/migrations/20260223000049_tpm-plan-buffer-hours.ts`

**Was passiert:**

1. `ALTER TABLE tpm_maintenance_plans ADD COLUMN buffer_hours NUMERIC(4,1) NOT NULL DEFAULT 4`
2. `ALTER TABLE tpm_maintenance_plans ADD CONSTRAINT chk_tpm_plans_buffer CHECK (buffer_hours > 0 AND buffer_hours <= 24)`
3. Bestehende Pläne bekommen automatisch 4h Default

**Bedeutung:**

- `base_time` + `buffer_hours` = Wartungsfenster
- Plan mit `base_time=09:00`, `buffer_hours=5` → Fenster 09:00–14:00
- Plan mit `base_time=NULL`, `buffer_hours=4` → Ganztägig (keine feste Uhrzeit, nur Tag belegt)
- `NUMERIC(4,1)` erlaubt 0.5h-Schritte (z.B. 2.5, 4.0, 8.0)

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_maintenance_plans"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT uuid, name, base_time, buffer_hours FROM tpm_maintenance_plans WHERE is_active = 1"
```

### Phase 1 — Definition of Done

- [x] 1 Migrationsdatei mit `up()` AND `down()`
- [x] Migration erfolgreich angewendet
- [x] Bestehende Pläne haben `buffer_hours = 4.0`
- [x] Constraint `chk_tpm_plans_buffer` verifiziert (0 < buffer_hours <= 24)
- [x] Backend-Types aktualisiert (`TpmPlanRow.buffer_hours`, `TpmPlan.bufferHours`)
- [x] DTOs aktualisiert (`CreatePlanSchema`, `UpdatePlanSchema`)
- [x] `tpm-plans.helpers.ts` Mapping aktualisiert
- [x] Bestehende Tests laufen weiterhin durch (318/318)
- [x] ESLint 0, Type-Check 0

---

## Phase 2: Backend — Schedule Projection Service

> **Abhängigkeit:** Phase 1 complete
> **Referenz:** `tpm-slot-assistant.service.ts` (ähnliches Pattern)

### Step 2.1: Types + DTO [PENDING]

**Geänderte Datei:** `backend/src/nest/tpm/tpm.types.ts`

**Neue Types:**

```typescript
/** Ein projizierter TPM-Termin (berechnet, nicht in DB) */
interface ProjectedSlot {
  planUuid: string;
  planName: string;
  asset_Id: number;
  assetName: string;
  intervalTypes: IntervalType[]; // Alle Intervalle dieses Plans
  date: string; // ISO date (YYYY-MM-DD)
  startTime: string | null; // HH:MM (aus base_time) oder null (ganztägig)
  endTime: string | null; // HH:MM (base_time + buffer_hours) oder null
  bufferHours: number;
  isFullDay: boolean; // true wenn base_time === null
}

/** Ergebnis der Schedule-Projektion */
interface ScheduleProjectionResult {
  slots: ProjectedSlot[];
  dateRange: { start: string; end: string };
  planCount: number;
}
```

**Neue DTO-Datei:** `backend/src/nest/tpm/dto/schedule-projection-query.dto.ts`

```typescript
// Query-Parameter: startDate, endDate (max 365 Tage), excludePlanUuid? (optional)
```

### Step 2.2: TpmScheduleProjectionService [PENDING]

**Neue Datei:** `backend/src/nest/tpm/tpm-schedule-projection.service.ts`

**Warum eigener Service:** Separation of Concerns — Slot Assistant bleibt für Anlagen-Verfügbarkeit,
Schedule Projection ist für Cross-Plan Terminplanung. Unterschiedliche Datenquellen, unterschiedliche Limits.

**Methoden:**

- `projectSchedules(tenantId, startDate, endDate, excludePlanUuid?)` → `ScheduleProjectionResult`
  1. Alle aktiven Pläne des Tenants laden (JOIN machines für Name)
  2. Optional: `excludePlanUuid` filtern (beim Bearbeiten eines Plans den eigenen ausschließen)
  3. Für jeden Plan: `TpmPlansIntervalService.isMaintenanceDate()` für jeden Tag im Range aufrufen
  4. Für jeden Treffer: Zeitfenster berechnen (`base_time` + `buffer_hours`)
  5. Alle Karten-Intervalle des Plans berücksichtigen (via `tpm_cards` JOIN)
  6. Sortiert nach Datum + Start-Time zurückgeben

**Abhängigkeiten:** `DatabaseService`, `TpmPlansIntervalService`

**Limit:** `MAX_PROJECTION_DAYS = 365`

**Kritische Patterns:**

- Alle Queries via `db.query()` (read-only, keine Transaction nötig)
- `$1, $2, $3` Placeholders (PostgreSQL)
- Performance: Pläne in einem Query laden, Dates client-side berechnen (CPU, nicht DB)

### Step 2.3: Controller Endpoint [PENDING]

**Geänderte Datei:** `backend/src/nest/tpm/tpm-plans.controller.ts`

**Neuer Endpoint:**

| Method | Route                            | Guard/Permission | Beschreibung                    |
| ------ | -------------------------------- | ---------------- | ------------------------------- |
| GET    | `/tpm/plans/schedule-projection` | canRead (tpm)    | Projizierte Termine aller Pläne |

**Query-Parameter:** `startDate`, `endDate`, `excludePlanUuid?`

### Phase 2 — Definition of Done

- [x] `ScheduleProjectionResult` + `ProjectedSlot` Types definiert
- [x] DTO mit Zod-Validierung (startDate, endDate, max 365 Tage, excludePlanUuid optional UUID)
- [x] `TpmScheduleProjectionService` implementiert
- [x] Controller-Endpoint registriert und erreichbar
- [ ] Performance-Test: 10 Pläne × 365 Tage < 500ms (deferred to Phase 6)
- [x] ESLint 0, Type-Check 0

---

## Phase 3: Backend — Slot Assistant erweitern

> **Abhängigkeit:** Phase 2 complete
> **Geänderte Datei:** `tpm-slot-assistant.service.ts`

### Step 3.1: 5. Datenquelle: tpm_schedule [PENDING]

**Was passiert:**

1. Neuer `SlotConflictType`: `'tpm_schedule'`
2. `buildDayConflicts()` bekommt 5. Parameter: projizierte TPM-Termine
3. Für jeden Tag: Prüfen ob projizierte Termine existieren
4. Conflict-Description: `"TPM Plan '{name}' ({intervalType}): {startTime}–{endTime}"`

**WICHTIG:** `'existing_tpm'` (bestehende fällige Karten) bleibt unverändert.
`'tpm_schedule'` ist ZUSÄTZLICH und zeigt den **geplanten Rhythmus**.

### Phase 3 — Definition of Done

- [x] `'tpm_schedule'` als neuer SlotConflictType
- [x] Bestehende 22 Slot-Tests bleiben grün (kein Breaking Change)
- [x] Neue Tests für `tpm_schedule` Conflict (mind. 5) — 5 neue Tests
- [x] ESLint 0, Type-Check 0

---

## Phase 4: Frontend — PlanForm erweitern

> **Abhängigkeit:** Phase 1 complete (buffer_hours Feld in API)
> **Geänderte Datei:** `PlanForm.svelte`

### Step 4.1: buffer_hours Input + Types [PENDING]

**Neues Feld im Formular:**

```
Wartungsdauer (Puffer)
[  4.0  ] Stunden
Berechnetes Zeitfenster: 09:00 – 13:00
```

- Input: Number, min=0.5, max=24, step=0.5
- Live-Berechnung des Zeitfensters (`base_time` + `buffer_hours`) als Preview
- Wenn `base_time=null`: "Ganztägig (keine feste Uhrzeit)"
- Neues Feld in `CreatePlanPayload` + `UpdatePlanPayload` Types
- Neues Feld in `api.ts` createPlan/updatePlan Functions
- Neue Messages in `constants.ts`

### Phase 4 — Definition of Done

- [x] `buffer_hours` Input mit 0.5er-Schritten
- [x] Live Zeitfenster-Preview
- [x] Create + Edit Mode funktionieren
- [x] Types + API-Client aktualisiert (TpmPlan, CreatePlanPayload, UpdatePlanPayload, SlotConflictType)
- [x] svelte-check 0, ESLint 0

---

## Phase 5: Frontend — SlotAssistant Redesign

> **Abhängigkeit:** Phase 2+3 complete (Backend-Endpoints)
> **Größte Phase — in 2 Teile gesplittet**

### Step 5a: Kalender-Grid erweitern [DONE]

**Geänderte Datei:** `SlotAssistant.svelte`

**Änderungen:**

1. **Range erhöhen:** Default 28 Tage → 90 Tage, Max 365 Tage (Backend unterstützt es)
2. **`tpm_schedule` Conflicts anzeigen:** Neue Conflict-Icons + Labels für projizierte Termine
3. **Tooltip erweitert:** Zeigt Plan-Name, Intervall, Zeitfenster bei Hover
4. **Schedule Projection laden:** Neuer `fetchScheduleProjection()` API-Call parallel zu Slots

**Neuer API-Client:** `fetchScheduleProjection(params)` in `api.ts`

### Step 5b: Zeitleisten-Ansicht (TimelineView) [DONE]

**Neue Datei:** `SlotAssistant` Unterkomponente `TimelineDayView.svelte`

**Konzept:**

- Klick auf einen Tag im Kalender-Grid → öffnet Zeitleisten-Ansicht für diesen Tag
- Horizontale Achse: 06:00–22:00 (oder Schichtzeiten)
- Vertikale Blöcke: Je ein bestehender TPM-Plan als farbiger Block
- Freie Zeitfenster grün hervorgehoben
- Vorschlag für neuen Plan basierend auf `baseWeekday` + `baseTime`

**Daten:** Schedule Projection API liefert `ProjectedSlot[]` — filtern nach ausgewähltem Datum

**UI-Elemente:**

- Zeitachse (horizontal, 1h-Raster)
- Planblöcke (farbig, mit Anlagen-Name + Intervall-Label)
- Freie Fenster (grün schraffiert)
- "Vorgeschlagen"-Marker für den neuen Plan

### Phase 5 — Definition of Done

- [x] Kalender-Grid zeigt `tpm_schedule` Conflicts
- [x] Range bis 365 Tage wählbar
- [x] Schedule Projection API integriert
- [x] TimelineDayView rendert korrekt
- [x] Klick auf Tag → Timeline öffnet
- [x] Freie Zeitfenster sichtbar
- [x] Responsive (Mobile: vereinfachte Ansicht, kein Timeline)
- [x] svelte-check 0, ESLint 0

---

## Phase 6: Tests + Dokumentation

> **Abhängigkeit:** Phase 5 complete

### Step 6.1: Unit Tests [DONE]

**Neue Testdatei:** `backend/src/nest/tpm/tpm-schedule-projection.service.test.ts`

**Szenarien (mind. 15 Tests):**

- Leerer Tenant (keine Pläne) → leeres Ergebnis
- 1 Plan, tägliches Intervall, 7 Tage → 7 Slots
- 1 Plan mit `base_time` + `buffer_hours` → korrekte Start/End-Berechnung
- 1 Plan ohne `base_time` → `isFullDay: true`
- Mehrere Pläne → alle Slots korrekt projiziert
- `excludePlanUuid` → eigener Plan ausgeschlossen
- 365-Tage-Limit → BadRequestException bei Überschreitung
- Verschiedene Intervalle (weekly, monthly, quarterly, annual)
- Performance: 10 Pläne × 365 Tage in < 500ms

### Step 6.2: API Integration Tests [DONE]

**Geänderte Testdatei:** `backend/test/tpm-executions.api.test.ts` oder neue Datei

**Szenarien (mind. 8 Tests):**

- `GET /schedule-projection` → 200 mit Struktur
- Fehlende Parameter → 400
- Range > 365 Tage → 400
- `excludePlanUuid` funktioniert
- Unauthenticated → 401

### Step 6.3: Dokumentation [DONE]

- [x] ADR-026 Section 3 (Slot Assistant) — 5th data source `tpm_schedule` documented
- [x] ADR-026 Section 4 (Module Architecture) — `TpmScheduleProjectionService` added
- [x] ADR-026 Section 5 (Integration Points) — Schedule Projection row added
- [x] ADR-026 New Section 10: Schedule Projection — full architecture description
- [x] ADR-026 Metadata, test counts, migration counts updated
- [x] Diesen Masterplan auf v2.0.0 gebumpt

### Phase 6 — Definition of Done

- [x] > = 15 Unit Tests für ScheduleProjectionService (20 Tests)
- [x] > = 8 API Integration Tests (13 Tests)
- [x] Alle bestehenden Tests bleiben grün (3875 Unit passed)
- [x] ADR-026 aktualisiert (Section 3, 4, 5, 6, new Section 10, metadata, references)
- [x] ESLint 0, Type-Check 0

---

## Session Tracking

| Session | Phase | Beschreibung                           | Status | Datum      |
| ------- | ----- | -------------------------------------- | ------ | ---------- |
| 31      | 1     | Migration: buffer_hours + Types + DTOs | DONE   | 2026-02-23 |
| 32      | 2     | ScheduleProjectionService + Endpoint   | DONE   | 2026-02-23 |
| 33      | 3     | SlotAssistant 5. Datenquelle           | DONE   | 2026-02-23 |
| 34      | 4     | Frontend: PlanForm buffer_hours Input  | DONE   | 2026-02-23 |
| 35      | 5a    | Frontend: Kalender-Grid erweitern      | DONE   | 2026-02-24 |
| 36      | 5b    | Frontend: TimelineDayView              | DONE   | 2026-02-24 |
| 37      | 6     | Tests (Unit + API)                     | DONE   | 2026-02-24 |
| 38      | 6     | Dokumentation + Polish + ADR           | DONE   | 2026-02-24 |

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                          | Zweck                      |
| -------------------------------------------------------------- | -------------------------- |
| `backend/src/nest/tpm/tpm-schedule-projection.service.ts`      | Core Projection Service    |
| `backend/src/nest/tpm/dto/schedule-projection-query.dto.ts`    | Query DTO (Zod)            |
| `backend/src/nest/tpm/tpm-schedule-projection.service.test.ts` | Unit Tests (20)            |
| `backend/test/tpm-schedule-projection.api.test.ts`             | API Integration Tests (13) |

### Backend (geändert)

| Datei                                                | Änderung                                  |
| ---------------------------------------------------- | ----------------------------------------- |
| `backend/src/nest/tpm/tpm.types.ts`                  | +ProjectedSlot, +ScheduleProjectionResult |
| `backend/src/nest/tpm/tpm-plans.helpers.ts`          | +bufferHours Mapping                      |
| `backend/src/nest/tpm/dto/create-plan.dto.ts`        | +bufferHours Field                        |
| `backend/src/nest/tpm/dto/update-plan.dto.ts`        | +bufferHours Field (optional)             |
| `backend/src/nest/tpm/tpm-plans.controller.ts`       | +schedule-projection Endpoint             |
| `backend/src/nest/tpm/tpm-slot-assistant.service.ts` | +tpm_schedule Conflict-Type               |
| `backend/src/nest/tpm/tpm.module.ts`                 | +ScheduleProjectionService Provider       |

### Database (neu)

| Datei                                                         | Zweck                       |
| ------------------------------------------------------------- | --------------------------- |
| `database/migrations/20260223000049_tpm-plan-buffer-hours.ts` | buffer_hours Spalte + Check |

### Frontend (neu)

| Pfad                                              | Zweck            |
| ------------------------------------------------- | ---------------- |
| `.../tpm/plan/[uuid]/_lib/TimelineDayView.svelte` | Tages-Zeitleiste |

### Frontend (geändert)

| Pfad                                                | Änderung                   |
| --------------------------------------------------- | -------------------------- |
| `.../tpm/plan/[uuid]/_lib/PlanForm.svelte`          | +buffer_hours Input        |
| `.../tpm/plan/[uuid]/_lib/SlotAssistant.svelte`     | +tpm_schedule, +365d Range |
| `.../(admin)/lean-management/tpm/_lib/api.ts`       | +fetchScheduleProjection   |
| `.../(admin)/lean-management/tpm/_lib/types.ts`     | +ProjectedSlot Types       |
| `.../(admin)/lean-management/tpm/_lib/constants.ts` | +Messages                  |

---

## Spec Deviations

| #   | Spec sagt    | Tatsächlicher Code | Entscheidung |
| --- | ------------ | ------------------ | ------------ |
| D1  | (noch keine) | —                  | —            |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein Drag & Drop in Timeline** — Zeitleiste ist read-only, kein direktes Verschieben von Blöcken. Grund: Komplexität vs. Nutzen in V1.
2. **Keine automatische Zeitvorschlag-Engine** — System zeigt freie Fenster an, schlägt aber nicht automatisch die "beste" Zeit vor. Admin entscheidet manuell.
3. **Keine Team-basierte Filterung** — Projektion zeigt ALLE Pläne des Tenants, nicht nur die des gleichen Wartungsteams. Grund: Team-Zuweisung zu Plänen existiert noch nicht als Datenmodell.
4. **Keine Gantt-Chart-Ansicht** — Timeline ist pro Tag, nicht als Wochen-/Monats-Gantt. Grund: Overkill für V1, Kalender + Tages-Timeline reicht.
5. **base_repeat_every Constraint bleibt 1-4** — Bestehender `chk_tpm_plans_repeat CHECK (base_repeat_every >= 1 AND base_repeat_every <= 4)` wird NICHT geändert. Reicht für "1.–4. Wochentag im Monat".

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- Saubere Phasen-Trennung: jede Session hatte klaren Scope, keine Phase brauchte Rework
- Backend-First-Ansatz: Service + Endpoint zuerst, Frontend baut darauf auf — keine API-Änderungen nach Phase 2
- Phase 5a/5b Split war richtig: Kalender-Grid liefert alleine Wert, Timeline ist Bonus
- Bestehende Tests blieben durchgehend grün (kein Regression in 3875 Tests)

### Was lief schlecht

- Phase 5b Kontext-Limit: TimelineDayView + SlotAssistant Änderungen waren groß genug, um den Kontext zu sprengen → nächstes Mal kleinere Commits innerhalb einer Phase
- Linter auto-refactored `buildDayTooltip` in SlotAssistant → überraschend, aber korrekt. Nächstes Mal proaktiv Funktionen unter 60 Zeilen halten

### Metriken

| Metrik                    | Geplant | Tatsächlich |
| ------------------------- | ------- | ----------- |
| Sessions                  | 8       | 8           |
| Migrationsdateien         | 1       | 1           |
| Neue Backend-Dateien      | 3       | 4           |
| Neue Frontend-Dateien     | 1       | 1           |
| Geänderte Dateien         | 12      | 12          |
| Unit Tests                | 15+     | 20          |
| API Tests                 | 8+      | 13          |
| ESLint Errors bei Release | 0       | 0           |
| Spec Deviations           | 0       | 0           |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
