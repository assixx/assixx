# FEAT: TPM-Modus Schicht-Zuordnung — Execution Masterplan

> **Created:** 2026-02-26
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Phase 0 (Planung)
> **Branch:** `feature/TPM`
> **Context:** TPM Gesamtansicht braucht Info welches Instandhaltungsteam welcher Wartung zugeordnet ist
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 4
> **Actual Sessions:** 0 / 4

---

## Changelog

| Version | Datum      | Änderung                           |
| ------- | ---------- | ---------------------------------- |
| 0.1.0   | 2026-02-26 | Initial Draft — Phasen 1-4 geplant |

---

## Problemstellung

### Was fehlt

Die TPM-Gesamtansicht (`/lean-management/tpm/gesamtansicht`) zeigt pro Maschine:

- **Zeile 1:** Geplante Wartungstermine (Monatlich, Vierteljährlich, Halbjährlich, Jährlich, Custom)
- **Zeile 2:** Zeitschätzungen (Mitarbeiteranzahl, Vorbereitung, Durchführung, Nachbereitung)
- **Zeile 3:** ❌ FEHLT — Welche Mitarbeiter sind der Wartung zugeordnet?

### Warum brauchen wir ein DB-Flag?

Mehrere Teams können am selben Tag/Schicht eingeplant sein:

- **Team A:** Produktionsteam — bedient die Maschine regulär
- **Team B:** Instandhaltungsteam — macht Wartung

Ein reiner JOIN `shifts ⨝ tpm_scheduled_dates` kann **nicht unterscheiden** ob ein Team für Produktion oder Wartung eingeplant ist. Der **TPM-Modus** markiert explizit: "Dieser Schichtplan ist ein Wartungsplan."

### Lösung

`is_tpm_mode BOOLEAN NOT NULL DEFAULT false` auf `shift_plans`.

**Warum `shift_plans` und nicht `shifts`?**

| Kriterium         | `shift_plans`                                | `shifts`                             |
| ----------------- | -------------------------------------------- | ------------------------------------ |
| Granularität      | 1 Zeile pro Team/Woche                       | N Zeilen pro Mitarbeiter/Tag         |
| Redundanz         | Kein Flag-Duplikat                           | Flag auf jeder Zeile redundant       |
| Semantik          | "Dieser Plan ist ein Wartungsplan"           | "Diese einzelne Schicht ist Wartung" |
| UNIQUE Constraint | `(tenant_id, team_id, start_date, end_date)` | —                                    |
| Query-Effizienz   | JOIN über `plan_id` (FK existiert)           | Direkter Filter                      |

**Verifikation (DB-Double-Check 2026-02-26):**

- `shifts.plan_id` ist NULLABLE, aber TPM-Schichten werden immer über einen Plan gespeichert ✅
- UNIQUE `(tenant_id, team_id, start_date, end_date)` auf `shift_plans` garantiert: 1 Plan pro Team/Woche ✅
- 21 existierende Shifts haben alle `plan_id IS NOT NULL` ✅
- 285 Rotation-only Einträge (ohne Plan) sind Vorgenerierungen — TPM-Zuordnung erfordert bewusstes Speichern ✅
- `shifts.metadata JSONB` existiert, ist aber überall NULL — kein Pattern dafür ✅

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] Branch `feature/TPM` checked out
- [ ] Keine pending Migrations (aktueller Stand: Migration 56 `shift-times`)
- [ ] TPM Feature komplett (Phase 6 done, 4764 Tests pass)
- [ ] Gesamtansicht funktioniert mit Terminen + Zeitschätzungen

### 0.2 Risk Register

| #   | Risiko                                          | Impact  | Wahrscheinlichkeit | Mitigation                                              | Verifikation                                                                   |
| --- | ----------------------------------------------- | ------- | ------------------ | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| R1  | Migration bricht bestehende Plans               | Hoch    | Niedrig            | `DEFAULT false` — alle bestehenden Plans unverändert    | `SELECT COUNT(*) FROM shift_plans WHERE is_tpm_mode = true` = 0 nach Migration |
| R2  | Frontend-Toggle nicht synchron mit DB           | Mittel  | Mittel             | `is_tpm_mode` wird bei jedem Save explizit mitgeschickt | API-Test: Plan erstellen mit `isTpmMode: true`, reload, Wert prüfen            |
| R3  | Gesamtansicht-Query zu langsam bei vielen Plans | Niedrig | Niedrig            | Partial Index `WHERE is_tpm_mode = true`                | EXPLAIN ANALYZE auf Query                                                      |

### 0.3 Ecosystem Integration Points

| Bestehendes System        | Art der Integration                                      | Phase |
| ------------------------- | -------------------------------------------------------- | ----- |
| `shift_plans` Tabelle     | Neue Spalte `is_tpm_mode`                                | 1     |
| `ShiftPlansService`       | `is_tpm_mode` bei Create/Update lesen + schreiben        | 2     |
| `ShiftControls.svelte`    | Toggle "TPM-Modus" bereits vorhanden (Session heute)     | 2     |
| `TpmPlansController`      | Neuer Endpoint für Mitarbeiter-Zuordnung                 | 2     |
| `OverallViewTable.svelte` | Neue Zeile "Zugewiesene Mitarbeiter"                     | 3     |
| Audit Trail               | `is_tpm_mode` Change wird automatisch geloggt (existing) | —     |

---

## Phase 1: Database Migration

> **Abhängigkeit:** Keine
> **Dateien:** 1 Migrationsdatei
> **Letzte Migration:** `20260225000056_shift-times.ts` → nächste ist `20260226000057`

### Step 1.1: `is_tpm_mode` Spalte auf `shift_plans` [PENDING]

**Neue Datei:** `database/migrations/20260226000057_shift-plans-tpm-mode.ts`

**Was passiert:**

```sql
-- up()
ALTER TABLE shift_plans ADD COLUMN is_tpm_mode BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX idx_shift_plans_tpm_mode ON shift_plans (tenant_id) WHERE is_tpm_mode = true;
GRANT SELECT, INSERT, UPDATE ON shift_plans TO app_user;  -- already granted, safe re-grant

-- down()
DROP INDEX IF EXISTS idx_shift_plans_tpm_mode;
ALTER TABLE shift_plans DROP COLUMN IF EXISTS is_tpm_mode;
```

**Warum Partial Index?** Nur TPM-Pläne werden gequeried — Full-Table-Scan bei `is_tpm_mode = true` wäre Verschwendung.

**Verifikation:**

```bash
doppler run -- ./scripts/run-migrations.sh up --dry-run
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d shift_plans" | grep tpm
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT COUNT(*) FROM shift_plans WHERE is_tpm_mode = true;"
```

### Phase 1 — Definition of Done

- [ ] Migration mit `up()` AND `down()` implementiert
- [ ] Dry-Run bestanden
- [ ] Migration erfolgreich angewendet
- [ ] `is_tpm_mode` Spalte existiert mit `DEFAULT false`
- [ ] Partial Index existiert
- [ ] Bestehende Plans alle `is_tpm_mode = false` (0 betroffene Rows)
- [ ] Backend type-check passed

---

## Phase 2: Backend — Service + Controller + DTO

> **Abhängigkeit:** Phase 1 complete
> **Betroffene Dateien:** Bestehende Dateien modifizieren (KEINE neuen Module)

### Step 2.1: DTO anpassen [PENDING]

**Dateien:**

- `backend/src/nest/shifts/dto/shift-plan.dto.ts` — `CreateShiftPlanSchema` + `isTpmMode` Feld
- `backend/src/nest/shifts/dto/update-shift-plan.dto.ts` — `UpdateShiftPlanSchema` + `isTpmMode` Feld

**Änderung:** `isTpmMode: z.boolean().optional().default(false)` in beide Schemas

### Step 2.2: ShiftPlansService anpassen [PENDING]

**Datei:** `backend/src/nest/shifts/shift-plans.service.ts`

**Änderungen:**

1. `createShiftPlan()` — `is_tpm_mode` in INSERT aufnehmen
2. `updateShiftPlan()` → `applyShiftPlanUpdates()` — `is_tpm_mode` in UPDATE aufnehmen
3. `getShiftPlanById()` / Response-Mapping — `is_tpm_mode` im Response zurückgeben

**Kritisch:** Nur bestehende Methoden erweitern, KEINE neuen Services.

### Step 2.3: Neuer Endpoint — TPM-Mitarbeiter-Zuordnung [PENDING]

**Datei:** Neue Datei `backend/src/nest/tpm/tpm-shift-assignments.service.ts`

**Warum neuer Service?** Die Logik gehört zum TPM-Modul, nicht zum Shifts-Modul. Sie queried `shift_plans` + `shifts` + `tpm_scheduled_dates` zusammen.

**Endpoint:** `GET /tpm/plans/shift-assignments?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`

**Query-Logik:**

```sql
SELECT
  p.uuid AS plan_uuid,
  tsd.scheduled_date,
  c.interval_type,
  s.user_id,
  u.first_name,
  u.last_name,
  s.type AS shift_type
FROM tpm_scheduled_dates tsd
JOIN tpm_cards c ON c.id = tsd.card_id AND c.is_active = 1
JOIN tpm_maintenance_plans p ON p.id = c.plan_id AND p.is_active = 1
JOIN shifts s ON s.date = tsd.scheduled_date AND s.tenant_id = tsd.tenant_id
JOIN shift_plans sp ON sp.id = s.plan_id AND sp.is_tpm_mode = true
JOIN users u ON u.id = s.user_id
WHERE tsd.tenant_id = $1
  AND tsd.scheduled_date BETWEEN $2 AND $3
  AND c.interval_type IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'custom')
ORDER BY p.uuid, c.interval_type, tsd.scheduled_date;
```

**Response-Shape:**

```typescript
interface TpmShiftAssignment {
  planUuid: string; // TPM Maintenance Plan UUID
  scheduledDate: string; // YYYY-MM-DD
  intervalType: string; // monthly, quarterly, ...
  userId: number;
  firstName: string;
  lastName: string;
  shiftType: string; // early, late, night
}
```

**Gruppierung im Frontend:** `Map<planUuid, Map<intervalType, TpmShiftAssignment[]>>`

### Step 2.4: ShiftPlansService Response-Type [PENDING]

**Datei:** `backend/src/nest/shifts/shifts.types.ts`

**Änderung:** `ShiftPlanResponse` Interface erweitern um `isTpmMode: boolean`

### Phase 2 — Definition of Done

- [ ] `isTpmMode` in Create + Update DTOs (Zod validated)
- [ ] `is_tpm_mode` wird bei Create gespeichert
- [ ] `is_tpm_mode` wird bei Update gespeichert
- [ ] `isTpmMode` im Plan-Response zurückgegeben
- [ ] Neuer Endpoint `GET /tpm/plans/shift-assignments` funktioniert
- [ ] ESLint 0 Errors
- [ ] Type-Check passed
- [ ] Bestehende Shift-Tests laufen weiterhin

---

## Phase 3: Frontend — Schichtplan TPM-Modus Toggle → DB

> **Abhängigkeit:** Phase 2 complete
> **Betroffene Dateien:** Bestehende Shift-Frontend-Dateien

### Step 3.1: Save-Flow anpassen [PENDING]

**Dateien:**

- `frontend/src/routes/(app)/(shared)/shifts/_lib/api.ts` — `isTpmMode` in Save-Payload aufnehmen
- `frontend/src/routes/(app)/(shared)/shifts/_lib/state-shifts.svelte.ts` — `showTpmEvents` beim Save als `isTpmMode` mitschicken
- `frontend/src/routes/(app)/(shared)/shifts/+page.svelte` — Bereits vorhanden (Toggle existiert)

**Datenfluss:**

```
ShiftControls Toggle (TPM-Modus) → shiftsState.showTpmEvents = true
  ↓ (User speichert Plan)
handleSaveSchedule() → buildShiftSaveData()
  ↓ (isTpmMode: shiftsState.showTpmEvents)
PUT /shifts/plan/:uuid → Backend speichert is_tpm_mode = true
```

### Step 3.2: Plan-Load TPM-State wiederherstellen [PENDING]

**Problem:** Wenn der Admin die Seite neu lädt, muss der TPM-Toggle den gespeicherten Zustand aus der DB widerspiegeln.

**Lösung:** `loadShiftPlan()` Response enthält `isTpmMode` → setzt `shiftsState.showTpmEvents`

### Phase 3 — Definition of Done

- [ ] Save schickt `isTpmMode` an Backend
- [ ] Reload stellt TPM-Toggle korrekt wieder her
- [ ] Toggle-Wechsel ohne Save ändert NICHT die DB (nur lokaler State)
- [ ] svelte-check 0 Errors
- [ ] ESLint 0 Errors

---

## Phase 4: Frontend — Gesamtansicht Mitarbeiter-Zeile

> **Abhängigkeit:** Phase 2 + Phase 3 complete
> **Neue Datei:** 1 neue Komponente

### Step 4.1: API-Funktion [PENDING]

**Datei:** `frontend/src/routes/(app)/(shared)/lean-management/tpm/gesamtansicht/_lib/api.ts`

**Neue Funktion:** `fetchShiftAssignments(startDate, endDate): Promise<TpmShiftAssignment[]>`

### Step 4.2: Neue Komponente `OverallViewAssignments.svelte` [PENDING]

**Neue Datei:** `frontend/src/routes/(app)/(shared)/lean-management/tpm/gesamtansicht/_lib/OverallViewAssignments.svelte`

**Warum neue Komponente?**

- `OverallViewTable.svelte` ist bei 671 Code-Zeilen / 700 Limit — KEIN Platz
- Eigene Komponente = eigener `<tbody>`, eingefügt nach Zeitschätzungen
- Gleiche `estColSpans` + `INTERVAL_COLUMNS` Logik

**Tabellen-Struktur:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Zugewiesene Mitarbeiter (Sub-Header)                                    │
├──────────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
│ Anlage       │ Monatl.  │ Viertelj.│ Halbj.   │ Jährl.   │ Custom       │
├──────────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ Machine A    │ Müller   │ Müller   │ Schmidt  │ Schmidt  │ —            │
│              │ Schmidt  │          │          │          │              │
└──────────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘
```

**Props:**

- `matrixRows` — Gleiche Matrix wie Schedule-Rows (für Maschinen-Reihenfolge)
- `assignments` — `Map<planUuid, Map<intervalType, TpmShiftAssignment[]>>`
- `maxDates` — Für Colspan-Berechnung
- `estColSpans` — Gleiche Verteilung wie Zeitschätzungen

### Phase 4 — Definition of Done

- [ ] API-Funktion holt Zuordnungsdaten
- [ ] Neue Komponente rendert Mitarbeiter-Zeile korrekt
- [ ] Colspan-Logik identisch mit Zeitschätzungen
- [ ] Sticky-Spalte "Anlage" funktioniert
- [ ] Leere Zellen wenn kein TPM-Plan für Intervall existiert
- [ ] svelte-check 0 Errors
- [ ] ESLint 0 Errors
- [ ] Responsive (horizontaler Scroll wie Rest der Tabelle)

---

## Session Tracking

| Session | Phase | Beschreibung                                   | Status | Datum |
| ------- | ----- | ---------------------------------------------- | ------ | ----- |
| 1       | 1 + 2 | Migration + Backend (DTO + Service + Endpoint) |        |       |
| 2       | 3     | Frontend Shift-Save + Load TPM-State           |        |       |
| 3       | 4     | Gesamtansicht API + Komponente                 |        |       |
| 4       | 4     | Polish, Edge Cases, Verifikation               |        |       |

---

## Quick Reference: File Paths

### Database (neu)

| Datei                                                        | Zweck                        |
| ------------------------------------------------------------ | ---------------------------- |
| `database/migrations/20260226000057_shift-plans-tpm-mode.ts` | `is_tpm_mode` Spalte + Index |

### Backend (geändert)

| Datei                                                  | Änderung                         |
| ------------------------------------------------------ | -------------------------------- |
| `backend/src/nest/shifts/dto/shift-plan.dto.ts`        | `isTpmMode` Feld                 |
| `backend/src/nest/shifts/dto/update-shift-plan.dto.ts` | `isTpmMode` Feld                 |
| `backend/src/nest/shifts/shift-plans.service.ts`       | Create/Update/Response erweitern |
| `backend/src/nest/shifts/shifts.types.ts`              | `ShiftPlanResponse.isTpmMode`    |

### Backend (neu)

| Datei                                                   | Zweck                               |
| ------------------------------------------------------- | ----------------------------------- |
| `backend/src/nest/tpm/tpm-shift-assignments.service.ts` | Query: shifts ⨝ tpm_scheduled_dates |

### Frontend (geändert)

| Datei                                | Änderung                          |
| ------------------------------------ | --------------------------------- |
| `shifts/_lib/api.ts`                 | `isTpmMode` in Save-Payload       |
| `shifts/_lib/state-shifts.svelte.ts` | TPM-State aus Plan-Response laden |
| `gesamtansicht/_lib/api.ts`          | `fetchShiftAssignments()`         |

### Frontend (neu)

| Datei                                              | Zweck                        |
| -------------------------------------------------- | ---------------------------- |
| `gesamtansicht/_lib/OverallViewAssignments.svelte` | Mitarbeiter-Zeile in Tabelle |

---

## Known Limitations (V1)

1. **Keine Mitarbeiter-pro-Maschine Zuordnung** — Alle Mitarbeiter im TPM-Shift gelten für alle Wartungen an dem Tag. Per-Maschine-Assignment ist V2.
2. **Keine Validierung gegen `staff_count`** — Gesamtansicht zeigt wer eingeteilt ist, warnt aber nicht wenn zu wenige/viele für die Zeitschätzung.
3. **Nur geplante Schichten** — `shift_rotation_history`-only Wochen (nicht gespeichert) haben kein TPM-Flag.
4. **Kein historisches Tracking** — Wenn `is_tpm_mode` geändert wird, wird nur der aktuelle State gespeichert (Audit Trail loggt die Änderung).
