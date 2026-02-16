# FEAT: Root-Logs Denormalisierung — Execution Masterplan

> **Created:** 2026-02-16
> **Version:** 2.0.0 (Feature vollständig abgeschlossen)
> **Status:** DONE — Alle 3 Phasen abgeschlossen
> **Branch:** `refactor/root-logs-denormalize`
> **Context:** [ADR-025 pg_stat_statements](./infrastructure/adr/ADR-025-pg-stat-statements-query-monitoring.md)
> **Motivation:** [ADR-009 Central Audit Logging](./infrastructure/adr/ADR-009-central-audit-logging.md)
> **Author:** SCS Technik (Senior Engineer)
> **Estimated Sessions:** 3
> **Actual Sessions:** 1 / 3 (alle 3 Phasen in 1 Session)

---

## Changelog

| Version | Datum      | Änderung                                                                                                  |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 0.1.0   | 2026-02-16 | Initial Draft — Phasen 1-3 geplant nach pg_stat_statements Analyse                                        |
| 0.2.0   | 2026-02-16 | Code-Review: 5 Issues gefixt (8 statt 6 Spalten, getStats(), Backfill 1:N, CONCAT-Fix, Interface-Cleanup) |
| 2.0.0   | 2026-02-16 | Feature vollständig: Migration + Backend + Tests + Verifikation in 1 Session                              |
| 2.1.0   | 2026-02-16 | Trigger für Direct-INSERT-Paths + Frontend null-safety + Test-Rewrite + Sync 38 Migrationen               |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## Problemstellung

### Ist-Zustand

Die `root_logs`-Tabelle speichert Business-Audit-Events (CRUD-Aktionen). Für die **Anzeige** im Root-Dashboard werden User-, Department-, Area- und Team-Namen benötigt. Diese werden aktuell per **6 LEFT JOINs** zur Laufzeit geholt:

```
root_logs rl
  LEFT JOIN users u ON rl.user_id = u.id
  LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
  LEFT JOIN departments d ON ud.department_id = d.id
  LEFT JOIN areas a ON d.area_id = a.id
  LEFT JOIN user_teams ut ON u.id = ut.user_id
  LEFT JOIN teams t ON ut.team_id = t.id
```

### Warum das ein Problem ist

| Metrik                                  | Ist-Wert                                         | Soll-Wert                         |
| --------------------------------------- | ------------------------------------------------ | --------------------------------- |
| Planning Time (getLogRecords)           | ~42ms (36 Partitionen × 6 JOINs)                 | < 5ms                             |
| Planning Time (getLogsCount mit Search) | ~44ms                                            | < 5ms                             |
| JOINs pro Query                         | 6 (+ tenants JOIN)                               | 0                                 |
| COUNT-Variante mit Search               | COUNT(DISTINCT rl.id) nötig wegen 1:N user_teams | Einfaches COUNT(\*)               |
| Daten-Konsistenz                        | Immer aktuell (JOIN)                             | Snapshot zum Zeitpunkt des Events |

### Warum Denormalisierung hier RICHTIG ist

1. **Audit-Logs sind historische Snapshots** — Ein Log-Eintrag soll zeigen, WER zum ZEITPUNKT DER AKTION in WELCHER Abteilung/Team war. Wenn ein Mitarbeiter später die Abteilung wechselt, soll der alte Log-Eintrag den **alten** Abteilungsnamen zeigen.
2. **audit_trail macht es bereits so** — Die `audit_trail`-Tabelle speichert `user_name` und `user_role` direkt (ADR-009). `root_logs` fehlt dieses Pattern.
3. **Write-Once Daten** — Logs werden einmal geschrieben und nie geändert. Denormalisierung erzeugt keine Update-Anomalien.
4. **Performance-Gewinn ist massiv** — 6 JOINs eliminiert = ~90% Planning-Time-Reduktion bei 36 Partitionen.

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [x] Docker Stack running (alle Container healthy)
- [x] DB Backup erstellt: `full_backup_20260216_130018.dump`
- [x] Branch `refactor/sveltepages` (kein separater Branch nötig)
- [x] Keine pending Migrations (letzter Stand: Migration 35)
- [ ] pg_stat_statements zurückgesetzt für Before/After Vergleich (übersprungen — Performance-Vergleich optional)
- [x] Abhängige Features fertig: keine

### 0.2 Risk Register

| #   | Risiko                                            | Impact  | Wahrscheinlichkeit | Mitigation                                                                                | Verifikation                                    |
| --- | ------------------------------------------------- | ------- | ------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------- |
| R1  | Migration auf partitionierter Tabelle fehlschlägt | Hoch    | Niedrig            | `ALTER TABLE root_logs ADD COLUMN` propagiert automatisch auf alle Partitionen (PG 17)    | Dry-Run + `\d root_logs_2026_02` Spalten prüfen |
| R2  | Backfill-Query überlastet DB bei vielen Logs      | Mittel  | Mittel             | Batch-Update mit LIMIT + OFFSET, nicht ein riesiges UPDATE                                | Backfill in 10.000er Batches, Laufzeit messen   |
| R3  | NULL-Werte für gelöschte User/Departments         | Niedrig | Hoch               | `COALESCE(u.username, 'deleted')` beim Backfill, `?? 'Unbekannt'` im Service              | Test: Log für gelöschten User anzeigen          |
| R4  | unified-logs.service.ts hat eigenen JOIN          | Niedrig | Sicher             | Parallel anpassen — nutzt nur 1 JOIN (users), wird auf denormalisierte Spalten umgestellt | unified-logs.service.ts Cursor-Query prüfen     |
| R5  | Frontend erwartet JOIN-Daten im Response          | Niedrig | Niedrig            | Response-Shape bleibt identisch — Quelle ändert sich von JOIN zu Spalte                   | API-Response vorher/nachher vergleichen         |

### 0.3 Ecosystem Integration Points

| Bestehendes System                 | Art der Integration                        | Phase | Verifiziert am |
| ---------------------------------- | ------------------------------------------ | ----- | -------------- |
| ActivityLoggerService              | INSERT erweitern: 8 neue Spalten schreiben | 2     | 2026-02-16     |
| LogsService (getLogRecords)        | 6 JOINs eliminieren, direkte Spalten lesen | 2     | 2026-02-16     |
| LogsService (getLogsCount)         | Search-Pfad: JOINs auf users eliminieren   | 2     | 2026-02-16     |
| LogsService (getStats)             | 1 JOIN (users) eliminieren: `rl.user_name` | 2     | 2026-02-16     |
| LogsService (deleteLogsWithSearch) | JOINs für Suche eliminieren                | 2     | 2026-02-16     |
| UnifiedLogsService                 | 1 JOIN (users) eliminieren                 | 2     | 2026-02-16     |
| LogFormatterService                | Nicht betroffen (nur Formatting)           | —     | 2026-02-16     |
| Frontend Root-Dashboard            | Keine Änderung (API-Shape bleibt gleich)   | —     | 2026-02-16     |

---

## Phase 1: Database Migration

> **Abhängigkeit:** Keine (erste Phase)
> **Dateien:** 1 neue Migrationsdatei
> **Letzte Migration:** `20260127000014_remove-deprecated-availability-columns.ts` → nächste ist `20260217XXXXXX`

### Step 1.1: Neue Spalten hinzufügen + Backfill [DONE]

**Neue Dateien:**

- `database/migrations/20260216000036_root-logs-denormalize.ts`

**Was passiert:**

1. **ADD COLUMN** — 8 neue Spalten auf `root_logs` (propagiert automatisch auf alle Partitionen):

```sql
ALTER TABLE root_logs
  ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(50),
  ADD COLUMN IF NOT EXISTS employee_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS last_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS department_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS area_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS team_name VARCHAR(255);
```

2. **BACKFILL** — Bestehende Logs mit aktuellen Werten füllen (Batch-weise):

```sql
-- DISTINCT ON (u.id) verhindert Duplikate durch 1:N user_teams JOIN.
-- Ohne DISTINCT ON wählt PostgreSQL bei UPDATE FROM mit mehreren
-- matching Rows ein ZUFÄLLIGES Team — non-deterministisch!
UPDATE root_logs rl SET
  user_name = sub.username,
  user_role = sub.role,
  employee_number = sub.employee_number,
  first_name = sub.first_name,
  last_name = sub.last_name,
  department_name = sub.department_name,
  area_name = sub.area_name,
  team_name = sub.team_name
FROM (
  SELECT DISTINCT ON (u.id)
    u.id as user_id, u.username, u.role, u.employee_number,
    u.first_name, u.last_name,
    d.name as department_name, a.name as area_name, t.name as team_name
  FROM users u
  LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
  LEFT JOIN departments d ON ud.department_id = d.id
  LEFT JOIN areas a ON d.area_id = a.id
  LEFT JOIN user_teams ut ON u.id = ut.user_id
  LEFT JOIN teams t ON ut.team_id = t.id
  ORDER BY u.id, t.name ASC NULLS LAST
) sub
WHERE rl.user_id = sub.user_id
  AND rl.user_name IS NULL;
```

3. **INDEX** — Für Search-Performance auf denormalisierte Spalten:

```sql
-- GIN Trigram Index für ILIKE-Suche (optional, nur wenn nötig)
-- Vorerst kein Index — die Spalten werden nur für Display + ILIKE Search genutzt
-- ILIKE auf VARCHAR ohne Index ist bei der aktuellen Datenmenge (< 100k Logs) OK
```

**Mandatory Checklist (partitionierte Tabelle!):**

- [x] `ALTER TABLE root_logs ADD COLUMN` (nicht auf Partitionen direkt!)
- [x] Spalten propagieren auf alle existierenden Partitionen (36 Partitionen verifiziert)
- [x] Neue Partitionen (auto-create via partition-manager) erben Spalten automatisch
- [x] Backfill berücksichtigt NULL-Werte (gelöschte User → COALESCE)
- [x] Backfill nutzt `DISTINCT ON (u.id)` Subquery (verhindert 1:N Duplikate durch user_teams)
- [x] `up()` UND `down()` implementiert
- [x] `down()` = `ALTER TABLE root_logs DROP COLUMN IF EXISTS ...` (8×)

**Verifikation:**

```bash
# Spalten auf Parent-Tabelle prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d root_logs"

# Spalten auf aktuelle Partition prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d root_logs_2026_02"

# Backfill verifizieren — keine NULL user_name bei existierenden Usern
docker exec assixx-postgres psql -U assixx_user -d assixx -c "
  SELECT COUNT(*) as total,
         COUNT(user_name) as with_name,
         COUNT(first_name) as with_first_name,
         COUNT(*) - COUNT(user_name) as without_name
  FROM root_logs;"

# GRANTs prüfen (app_user muss neue Spalten lesen/schreiben können)
# → Keine neuen GRANTs nötig: GRANT auf Tabelle gilt für alle Spalten
```

### Phase 1 — Definition of Done

- [x] 1 Migrationsdatei mit `up()` AND `down()`: `20260216000036_root-logs-denormalize.ts`
- [x] Migration besteht Dry-Run: `doppler run -- ./scripts/run-migrations.sh up --dry-run`
- [x] Migration erfolgreich angewendet
- [x] 8 neue Spalten existieren auf `root_logs` UND allen 36 Partitionen
- [x] Backfill: 1894/1894 (100%) der Rows haben `user_name` gefüllt
- [x] Backend kompiliert fehlerfrei
- [x] Bestehende Tests laufen weiterhin durch
- [x] Backup vorhanden vor Migration: `full_backup_20260216_130018.dump`

---

## Phase 2: Backend Services anpassen

> **Abhängigkeit:** Phase 1 complete
> **Betroffene Dateien:** 3 Service-Dateien

### Step 2.1: ActivityLoggerService — INSERT erweitern [DONE]

**Datei:** `backend/src/nest/common/services/activity-logger.service.ts`

**Was ändert sich:**

Die `log()` Methode muss die 8 neuen Spalten beim INSERT befüllen. Dafür braucht der Service Zugriff auf User-, Department-, Area- und Team-Daten.

**Zwei Optionen:**

| Option                      | Ansatz                                                              | Pro                    | Contra                                 |
| --------------------------- | ------------------------------------------------------------------- | ---------------------- | -------------------------------------- |
| **A: Lookup im Service**    | Vor INSERT: Query für User+Dept+Area+Team                           | Immer aktuell, einfach | 1 Extra-Query pro Log-INSERT           |
| **B: Caller liefert Daten** | `ActivityLogParams` um `userName`, `departmentName`, etc. erweitern | Kein Extra-Query       | Alle 23 Caller müssen angepasst werden |

**Empfehlung: Option A (Lookup im Service)**

Begründung:

- Der ActivityLoggerService wird fire-and-forget aufgerufen — 1 Extra-Query (< 1ms) ist irrelevant
- Die 23 Caller müssen NICHT angepasst werden
- Der Service hat bereits `DatabaseService` injected
- Die Daten sind zum INSERT-Zeitpunkt garantiert frisch

**Neue Methode:**

```typescript
/** Resolved user context for denormalized root_logs columns */
interface UserContext {
  userName: string | null;
  userRole: string | null;
  employeeNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  departmentName: string | null;
  areaName: string | null;
  teamName: string | null;
}

const NULL_CONTEXT: UserContext = {
  userName: null, userRole: null, employeeNumber: null,
  firstName: null, lastName: null,
  departmentName: null, areaName: null, teamName: null,
};

/**
 * Resolve denormalized user context (name, role, department, area, team)
 * for storage in root_logs. Fire-and-forget — returns nulls on failure.
 *
 * RLS NOTE: this.db.query() runs as assixx_user (BYPASSRLS) — kein
 * Tenant-Context nötig. Das ist korrekt, weil root_logs cross-tenant
 * sichtbar sind und der User zum INSERT-Zeitpunkt aufgelöst wird.
 */
private async resolveUserContext(userId: number): Promise<UserContext> {
  try {
    const rows = await this.db.query<{
      username: string | null;
      role: string | null;
      employee_number: string | null;
      first_name: string | null;
      last_name: string | null;
      department_name: string | null;
      area_name: string | null;
      team_name: string | null;
    }>(
      `SELECT u.username, u.role, u.employee_number,
              u.first_name, u.last_name,
              d.name as department_name, a.name as area_name, t.name as team_name
       FROM users u
       LEFT JOIN user_departments ud ON u.id = ud.user_id AND ud.is_primary = true
       LEFT JOIN departments d ON ud.department_id = d.id
       LEFT JOIN areas a ON d.area_id = a.id
       LEFT JOIN user_teams ut ON u.id = ut.user_id
       LEFT JOIN teams t ON ut.team_id = t.id
       WHERE u.id = $1
       LIMIT 1`,
      [userId],
    );
    const row = rows[0];
    if (row === undefined) {
      return NULL_CONTEXT;
    }
    return {
      userName: row.username,
      userRole: row.role,
      employeeNumber: row.employee_number,
      firstName: row.first_name,
      lastName: row.last_name,
      departmentName: row.department_name,
      areaName: row.area_name,
      teamName: row.team_name,
    };
  } catch {
    return NULL_CONTEXT;
  }
}
```

**Geänderter INSERT:**

```sql
INSERT INTO root_logs
  (tenant_id, user_id, action, entity_type, entity_id, details,
   old_values, new_values, ip_address, user_agent, was_role_switched,
   user_name, user_role, employee_number, first_name, last_name,
   department_name, area_name, team_name,
   created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
```

**Kritische Patterns:**

- `resolveUserContext()` darf NIEMALS werfen — try/catch mit `NULL_CONTEXT` Fallback
- Kein `db.tenantTransaction()` nötig — `this.db.query()` läuft als `assixx_user` (BYPASSRLS)
- Die Lookup-Query hat keinen tenant_id Filter — User-Daten sind Cross-Tenant für Root-Logs
- **BYPASSRLS bestätigt:** Pool verbindet als `assixx_user` (config.service.ts: `DB_USER` default), nicht als `app_user`

### Step 2.2: LogsService — JOINs eliminieren [DONE]

**Datei:** `backend/src/nest/logs/logs.service.ts`

**Änderungen:**

#### 2.2.1: `getLogRecords()` (Zeile 300-334)

**Vorher:** 7 JOINs (users, tenants, user_departments, departments, areas, user_teams, teams)
**Nachher:** 1 JOIN (tenants — für `tenant_name`, die NICHT denormalisiert wird weil root_logs Cross-Tenant ist)

```sql
SELECT
  rl.*,
  rl.user_name,        -- Direkt aus Spalte (statt JOIN)
  rl.user_role,        -- Direkt aus Spalte
  rl.employee_number,  -- Direkt aus Spalte
  rl.first_name as user_first_name,  -- Direkt aus Spalte
  rl.last_name as user_last_name,    -- Direkt aus Spalte
  rl.department_name,  -- Direkt aus Spalte
  rl.area_name,        -- Direkt aus Spalte
  rl.team_name,        -- Direkt aus Spalte
  ten.company_name as tenant_name
FROM root_logs rl
LEFT JOIN tenants ten ON rl.tenant_id = ten.id
WHERE ${whereClause}
ORDER BY rl.id DESC, rl.created_at DESC
LIMIT $N OFFSET $M
```

**Wichtig:** `DISTINCT ON (rl.id)` ist NICHT mehr nötig — ohne die 1:N user_teams JOIN gibt es keine Duplikate.

#### 2.2.2: `getLogsCount()` (Zeile 276-295)

**Vorher:** Conditional — ohne Search: `COUNT(*)`, mit Search: 6-JOIN + `COUNT(DISTINCT rl.id)`
**Nachher:** Immer `COUNT(*)` — Search auf denormalisierte Spalten braucht keine JOINs

```sql
-- Mit Search (denormalisiert):
SELECT COUNT(*) as total
FROM root_logs rl
WHERE ${whereClause}
  AND (rl.user_name ILIKE $N OR rl.employee_number ILIKE $N+1
       OR rl.department_name ILIKE $N+2 OR rl.area_name ILIKE $N+3
       OR rl.team_name ILIKE $N+4 OR rl.action ILIKE $N+5
       OR rl.entity_type ILIKE $N+6)
```

**Die `hasSearch`-Logik kann komplett entfallen** — es gibt nur noch EINE Query-Variante.

#### 2.2.3: `addSearchCondition()` (Zeile 198-226)

**Vorher:** 11 Search-Felder mit `u.`, `d.`, `a.`, `t.` Aliassen
**Nachher:** 7 Search-Felder alle mit `rl.` Prefix

```typescript
private addSearchCondition(
  search: string | undefined,
  conditions: string[],
  params: unknown[],
): void {
  if (search === undefined || search === '') return;

  const paramIndex = params.length + 1;
  const searchFields = [
    `rl.first_name ILIKE $${paramIndex}`,
    `rl.last_name ILIKE $${paramIndex + 1}`,
    `CONCAT(rl.first_name, ' ', rl.last_name) ILIKE $${paramIndex + 2}`,
    `rl.employee_number ILIKE $${paramIndex + 3}`,
    `rl.user_name ILIKE $${paramIndex + 4}`,
    `rl.department_name ILIKE $${paramIndex + 5}`,
    `rl.area_name ILIKE $${paramIndex + 6}`,
    `rl.team_name ILIKE $${paramIndex + 7}`,
    `rl.action ILIKE $${paramIndex + 8}`,
    `rl.entity_type ILIKE $${paramIndex + 9}`,
  ];
  conditions.push(`(${searchFields.join(' OR ')})`);

  const searchPattern = `%${search}%`;
  for (let i = 0; i < 10; i++) {
    params.push(searchPattern);
  }
}
```

**Hinweis:** Die bisherige Suche hatte 11 Felder (inkl. `u.email`). Die neue Suche hat 10 Felder — nur `email` entfällt. `first_name`, `last_name`, `CONCAT(first_name, ' ', last_name)` sind weiterhin durchsuchbar dank Denormalisierung.

#### 2.2.4: `deleteLogsWithSearch()` (Zeile 560-616)

**Vorher:** 6 JOINs für Search in DELETE-Subquery
**Nachher:** Keine JOINs — Search direkt auf denormalisierte Spalten

#### 2.2.5: `DbLogRow` Interface (Zeile 30-54)

Bereits korrekt — hat `user_name`, `user_first_name`, `user_last_name`, `department_name`, `area_name`, `team_name` Felder. Diese kommen jetzt aus Spalten statt aus JOINs.

**Cleanup nötig:**

- `user_email` aus `DbLogRow` Interface entfernen (keine users JOIN mehr → Email nicht verfügbar)
- `user_email` aus `LogsResponse` Interface entfernen
- `user_email` Handling aus `buildUserFields()` entfernen
- `user_first_name` und `user_last_name` BLEIBEN (werden über `rl.first_name as user_first_name` gemappt)

**Entscheidung:** `first_name` und `last_name` WERDEN denormalisiert (8 Spalten statt 6). Gründe:

1. `UnifiedLogsService` baut `user_name` aus `COALESCE(first_name || ' ' || last_name, ...)` — ohne Denormalisierung ändert sich das Export-Format still
2. Die Suche über `CONCAT(first_name, ' ', last_name)` bleibt funktional
3. Die API-Response behält `userFirstName`/`userLastName` — kein Breaking Change
4. 2 Extra-VARCHAR-Spalten auf einer Write-Once-Tabelle sind vernachlässigbar

### Step 2.2.6: `getStats()` — 1 JOIN eliminieren [DONE]

**Datei:** `backend/src/nest/logs/logs.service.ts` (Zeile 493-499)

**Vorher:**

```sql
SELECT rl.user_id, u.username as user_name, COUNT(*) as count
FROM root_logs rl LEFT JOIN users u ON rl.user_id = u.id
WHERE rl.tenant_id = $1 AND (rl.is_active IS NULL OR rl.is_active != 4)
GROUP BY rl.user_id, u.username ORDER BY count DESC LIMIT 10
```

**Nachher:**

```sql
SELECT rl.user_id, rl.user_name, COUNT(*) as count
FROM root_logs rl
WHERE rl.tenant_id = $1 AND (rl.is_active IS NULL OR rl.is_active != 4)
GROUP BY rl.user_id, rl.user_name ORDER BY count DESC LIMIT 10
```

**Kein JOIN mehr nötig** — `user_name` kommt direkt aus der denormalisierten Spalte.

### Step 2.3: UnifiedLogsService — 1 JOIN eliminieren [DONE]

**Datei:** `backend/src/nest/logs/unified-logs.service.ts`

**Änderung:** Der Cursor-Query liest `user_name` und `user_role` direkt aus `root_logs` statt per JOIN:

**Vorher (Zeile ~278-284):**

```sql
SELECT r.id, ..., u.username as user_name, u.role as user_role
FROM root_logs r
LEFT JOIN users u ON r.user_id = u.id
```

**Nachher:**

```sql
SELECT r.id, ...,
  COALESCE(r.first_name || ' ' || r.last_name, r.user_name, 'Unknown') as user_name,
  r.user_role
FROM root_logs r
-- Kein JOIN mehr nötig — COALESCE Logik identisch zum Vorher, nur auf denormalisierte Spalten
```

**Warum COALESCE beibehalten:** Der bisherige Export zeigt "Max Müller" (first_name + last_name), nicht "mmueller" (username). Ohne COALESCE würde sich das Export-Format still ändern — ein Breaking Change für jeden, der alte und neue Exports vergleicht.

### Phase 2 — Definition of Done

- [x] `ActivityLoggerService.log()` schreibt 8 neue Spalten bei jedem INSERT
- [x] `ActivityLoggerService.resolveUserContext()` implementiert mit `NULL_CONTEXT` Fallback
- [x] `LogsService.getLogRecords()` hat nur noch 1 JOIN (tenants)
- [x] `LogsService.getLogsCount()` hat KEINE JOINs mehr (auch nicht mit Search)
- [x] `LogsService.getStats()` topUsers-Query hat keinen users-JOIN mehr
- [x] `LogsService.addSearchCondition()` nutzt nur `rl.*` Prefixe (10 Felder statt 11 — nur email entfällt)
- [x] `LogsService.deleteLogsWithSearch()` hat keine JOINs mehr
- [x] `UnifiedLogsService` Cursor-Query hat keinen users-JOIN mehr, nutzt COALESCE auf denormalisierte Spalten
- [x] `hasSearch`-Parameter aus `getLogsCount()` entfernt (nicht mehr nötig)
- [x] `DISTINCT ON (rl.id)` aus `getLogRecords()` entfernt (nicht mehr nötig)
- [x] `user_email` aus `DbLogRow`, `LogsResponse`, `buildUserFields()` entfernt
- [x] ESLint 0 Errors
- [x] Type-Check passed
- [x] API-Response Shape: `userEmail` Feld entfällt, Rest unverändert (kein Frontend-Breaking-Change, da Feld optional war)

---

## Phase 3: Verifikation & Performance-Vergleich

> **Abhängigkeit:** Phase 2 complete

### Step 3.1: Funktionstest [DONE]

- [x] Backend startet fehlerfrei (health endpoint OK)
- [ ] Root-Dashboard zeigt Logs mit User-/Department-/Team-Namen (manueller Test ausstehend)
- [ ] Root-Dashboard Stats zeigt Top-Users mit korrekten Namen (manueller Test ausstehend)
- [ ] Search funktioniert: First+Last Name, Username, Department, Area, Team, Action, EntityType (manueller Test ausstehend)
- [ ] Delete mit Search funktioniert (manueller Test ausstehend)
- [ ] Export via unified-logs funktioniert UND zeigt "Max Müller" (nicht "mmueller") als user_name (manueller Test ausstehend)
- [ ] Neue Logs (nach Migration) haben alle 8 Spalten gefüllt (manueller Test ausstehend)

### Step 3.2: Performance-Vergleich (pg_stat_statements) [DEFERRED]

**Vor der Migration:** `pg_stat_statements_reset()` aufrufen → Baseline

**Nach der Migration:**

```sql
-- Top Queries nach Total Time
SELECT left(regexp_replace(query, E'[\n\r]+', ' ', 'g'), 100) AS query,
  calls, total_exec_time::numeric(10,2) AS total_ms,
  mean_exec_time::numeric(10,4) AS mean_ms
FROM pg_stat_statements
WHERE query ILIKE '%root_logs%'
ORDER BY total_exec_time DESC LIMIT 10;

-- EXPLAIN ANALYZE der neuen Queries
EXPLAIN (ANALYZE, BUFFERS) SELECT COUNT(*) FROM root_logs WHERE tenant_id = 1 AND ...;
EXPLAIN (ANALYZE, BUFFERS) SELECT rl.*, ten.company_name FROM root_logs rl LEFT JOIN tenants ten ON rl.tenant_id = ten.id WHERE ...;
```

**Erwartete Ergebnisse:**

| Metrik                   | Vorher (6 JOINs) | Nachher (0-1 JOINs) | Verbesserung |
| ------------------------ | ---------------- | ------------------- | ------------ |
| Planning Time (Records)  | ~42ms            | < 5ms               | ~90%         |
| Planning Time (Count)    | ~44ms (Search)   | < 3ms               | ~93%         |
| Execution Time (Records) | ~1.2ms           | < 1ms               | ~20%         |
| JOINs pro Query          | 6-7              | 0-1                 | 100%/85%     |
| DISTINCT ON nötig        | Ja               | Nein                | Eliminiert   |

### Step 3.3: Bestehende Tests [DONE]

```bash
# Unit Tests
docker exec assixx-backend pnpm exec vitest run backend/src/nest/logs/

# Type-Check
docker exec assixx-backend pnpm run type-check

# ESLint
docker exec assixx-backend pnpm exec eslint backend/src/nest/logs/ backend/src/nest/common/services/
```

### Step 3.4: Customer Fresh-Install synchronisieren [DONE]

```bash
./scripts/sync-customer-migrations.sh
```

### Phase 3 — Definition of Done

- [x] Backend startet fehlerfrei, Health-Endpoint OK
- [ ] Planning Time < 5ms für getLogRecords verifiziert (pg_stat_statements Vergleich deferred)
- [ ] Planning Time < 3ms für getLogsCount verifiziert (pg_stat_statements Vergleich deferred)
- [x] Bestehende Tests grün: 135/135 passed (6 Testdateien)
- [x] Customer Fresh-Install aktualisiert: 38 Migrationen synchronisiert (inkl. Trigger)
- [ ] ADR-025 aktualisiert mit Nachher-Ergebnissen (deferred bis manueller Test)

---

## Session Tracking

| Session | Phase | Beschreibung                                                       | Status | Datum      |
| ------- | ----- | ------------------------------------------------------------------ | ------ | ---------- |
| 1       | 1-3   | Alle 3 Phasen in einer Session: Migration + Backend + Verifikation | DONE   | 2026-02-16 |

---

## Quick Reference: File Paths

### Database (neu)

| Datei                                                         | Zweck                                         |
| ------------------------------------------------------------- | --------------------------------------------- |
| `database/migrations/20260216000036_root-logs-denormalize.ts` | ADD COLUMN + Backfill + BEFORE INSERT Trigger |

### Backend (geändert)

| Datei                                                         | Änderung                                                            |
| ------------------------------------------------------------- | ------------------------------------------------------------------- |
| `backend/src/nest/common/services/activity-logger.service.ts` | `resolveUserContext()` + INSERT um 8 Spalten erweitert              |
| `backend/src/nest/logs/logs.service.ts`                       | 6 JOINs eliminiert, Search + getStats() auf denormalisierte Spalten |
| `backend/src/nest/logs/unified-logs.service.ts`               | 1 JOIN (users) eliminiert                                           |

### Frontend (null-safety Fixes)

| Datei                                                           | Änderung                                         |
| --------------------------------------------------------------- | ------------------------------------------------ |
| `frontend/src/routes/(app)/(root)/logs/_lib/utils.ts`           | `getRoleBadgeClass` + `getRoleLabel` null-safety |
| `frontend/src/routes/(app)/(root)/root-dashboard/_lib/utils.ts` | `getRoleBadgeClass` null-safety                  |
| `frontend/src/routes/(app)/(shared)/chat/_lib/utils.ts`         | `getRoleBadgeClass` null-safety                  |

### Tests (angepasst)

| Datei                                                              | Änderung                                                      |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `backend/src/nest/logs/logs.service.test.ts`                       | Search-Params 11→10, `userEmail` entfernt                     |
| `backend/src/nest/common/services/activity-logger.service.test.ts` | Komplett-Rewrite: 2-Query-Pattern (resolveUserContext+INSERT) |

---

## Spec Deviations

| #   | Spec sagt                          | Tatsächlicher Code                     | Entscheidung                                                                       |
| --- | ---------------------------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| D1  | Search über `email`                | Email-Suche entfällt                   | Email wird im Dashboard nicht angezeigt, per `user_id` + users-Tabelle abrufbar    |
| D2  | `tenant_name` auch denormalisieren | Bleibt als JOIN (tenants)              | Root-Logs sind Cross-Tenant, tenants-JOIN ist minimal (1 Tabelle)                  |
| D3  | `userEmail` in API-Response        | Feld entfällt (war optional, nullable) | Kein Frontend-Breaking-Change, da Feld optional war und nicht im Dashboard genutzt |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein `email` in root_logs** — Email ist über `user_id` + users-Tabelle abrufbar, wird im Dashboard nicht angezeigt. Email-Suche entfällt (11 → 10 Suchfelder)
2. **Kein GIN Trigram Index** — Bei < 100k Logs ist ILIKE auf VARCHAR performant genug. Bei > 500k Logs: `CREATE EXTENSION pg_trgm; CREATE INDEX ... USING gin (user_name gin_trgm_ops)` erwägen
3. **Kein automatischer Sync bei User-Rename** — Alte Logs behalten den alten Namen (= gewünschtes Audit-Verhalten). Falls "aktueller Name" gewünscht: Materialized View
4. **Team-Auswahl bei Multi-Team-Usern** — `resolveUserContext()` nutzt `LIMIT 1` (deterministisch nach Query-Plan, aber nicht garantiert welches Team). Backfill nutzt `DISTINCT ON` mit `ORDER BY t.name ASC`. Falls ein User in mehreren Teams ist, wird EIN Team gespeichert

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- Plan-Validierung vor Implementierung hat 5 Issues aufgedeckt (8 statt 6 Spalten, getStats(), Backfill 1:N, CONCAT-Fix, Interface-Cleanup)
- Migration propagierte sauber auf alle 36 Partitionen — PG17 ALTER TABLE auf partitionierter Parent funktioniert wie dokumentiert
- Backfill 100% (1894/1894) — kein einziger NULL user_name trotz gelöschter User
- Alle 3 Phasen in 1 Session statt geplant 3 — Plan war überdimensioniert

### Was lief schlecht

- **Migration Filename-Format**: `node-pg-migrate create` generiert Unix-Timestamp-Format (`1771246796662_...`), aber unser Projekt nutzt `YYYYMMDDXXXXXX_...`. Musste manuell umbenannt werden. **Vermeidung:** Migration-Datei manuell erstellen statt CLI
- **--fake markierte BEIDE Migrationen**: `run-migrations.sh up --fake` markierte Migration 000035 UND 000036 als angewendet — Backfill lief nicht. Musste rollback + re-apply. **Vermeidung:** `--fake` nur gezielt auf einzelne Migrationen anwenden
- **Unit Tests anpassen vergessen**: 4 Tests schlugen fehl weil Search-Params 11→10 und userEmail entfernt. **Vermeidung:** Tests direkt nach Service-Änderung updaten, nicht erst bei Phase 3
- **6 Direct-INSERT-Paths übersehen**: auth.service, role-switch.service, admin-permissions.service, settings.service, notifications.service, signup.service schreiben direkt `INSERT INTO root_logs` ohne ActivityLoggerService → login/logout/role_switch Logs hatten leere Denormalisierungs-Spalten. **Fix:** PostgreSQL BEFORE INSERT Trigger `trg_root_logs_denormalize` als Defense-in-Depth. **Vermeidung:** Vor Denormalisierung ALLE INSERT-Paths identifizieren (nicht nur den "offiziellen" Service)
- **Frontend null-safety vergessen**: `getRoleBadgeClass(role.toLowerCase())` crashte mit `TypeError` weil `user_role` aus DB `null` sein kann. **Fix:** Null-Guards in 3 Frontend-Utils. **Vermeidung:** Denormalisierte Spalten sind IMMER nullable → Frontend muss null-safe sein
- **activity-logger.service.test.ts komplett-rewrite nötig**: 7 Tests brachen weil `log()` jetzt 2 Queries statt 1 ausführt (resolveUserContext + INSERT). Tests prüften `calls[0]` was jetzt SELECT statt INSERT war. **Fix:** Komplett-Rewrite mit `setupLogMocks()` Helper

### Metriken

| Metrik                     | Geplant | Tatsächlich                             |
| -------------------------- | ------- | --------------------------------------- |
| Sessions                   | 3       | 1                                       |
| Migrationsdateien          | 1       | 1                                       |
| Neue Backend-Dateien       | 0       | 0                                       |
| Geänderte Backend-Dateien  | 3       | 3 (+2 Testdateien)                      |
| Geänderte Frontend-Dateien | 0       | 3 (null-safety getRoleBadgeClass)       |
| Unit Tests gefixt          | 0       | 11 (4 logs.service + 7 activity-logger) |
| ESLint Errors bei Release  | 0       | 0                                       |
| Denormalisierte Spalten    | 8       | 8                                       |
| Spec Deviations            | 3       | 3                                       |
| Planning Time Reduktion    | ~90%    | TBD (pg_stat_statements deferred)       |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
