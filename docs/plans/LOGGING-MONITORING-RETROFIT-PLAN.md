# PLAN: Logging & Monitoring Retrofit — Execution Masterplan

> **Created:** 2026-02-25
> **Version:** 0.1.0 (Draft)
> **Status:** DRAFT — Awaiting Approval
> **Branch:** TBD (eigener Branch oder pro Feature-Branch)
>
> **Estimated Sessions:** 8-12
> **Actual Sessions:** 0 / 12

---

## Motivation

**Audit vom 2026-02-25 hat aufgedeckt:**

- **197+ Backend-Mutations** ohne ActivityLoggerService (61% aller Services)
- **TPM Audit-Trail unvollständig** — DELETE/UPDATE ohne Pre-Mutation-Daten
- **6 Frontend-Dateien** umgehen Logger komplett (console.error statt logger.error)
- **Client-Side Errors** in Modals/Components erreichen Sentry NICHT
- **Crypto-Worker-Crashes** sind komplett unsichtbar

**Risiko:** Compliance-Verletzung, unsichtbare Produktionsfehler, blinde Flecken bei Debugging.

---

## Changelog

| Version | Datum      | Änderung                         |
| ------- | ---------- | -------------------------------- |
| 0.1.0   | 2026-02-25 | Initial Draft nach 5-Agent-Audit |

---

## Gesamtübersicht: Was fehlt wo?

### Backend — ActivityLoggerService (197+ ungeloggte Mutations)

| Priorität | Modul             | Service                               | Fehlende Mutations | Severity |
| --------- | ----------------- | ------------------------------------- | ------------------ | -------- |
| 🔴 P0     | shifts            | shift-plans.service.ts                | 25                 | CRITICAL |
| 🔴 P0     | shifts            | rotation-pattern.service.ts           | 22                 | CRITICAL |
| 🔴 P0     | shifts            | rotation.service.ts                   | 22                 | CRITICAL |
| 🔴 P0     | admin-permissions | admin-permissions.service.ts          | 24                 | CRITICAL |
| 🔴 P0     | plans             | plans.service.ts                      | 58                 | CRITICAL |
| 🟡 P1     | tpm               | tpm-templates.service.ts              | 3                  | HIGH     |
| 🟡 P1     | tpm               | tpm-time-estimates.service.ts         | 2                  | HIGH     |
| 🟡 P1     | tpm               | tpm-color-config.service.ts           | 4                  | HIGH     |
| 🟡 P1     | tpm               | tpm-escalation.service.ts             | 1                  | HIGH     |
| 🟡 P1     | tpm               | tpm-executions.service.ts (addPhoto)  | 1                  | HIGH     |
| 🟡 P1     | vacation          | entitlements.carryOverRemainingDays() | 1                  | HIGH     |
| 🟡 P1     | vacation          | entitlements.updateEntitlement()      | 1                  | HIGH     |
| 🟡 P1     | shifts            | rotation-history.service.ts           | 14                 | HIGH     |
| 🟠 P2     | settings          | settings.service.ts                   | 27                 | HIGH     |
| 🟠 P2     | machines          | machine-maintenance.service.ts        | 7                  | HIGH     |
| 🟠 P2     | users             | user-profile.service.ts               | 36                 | HIGH     |
| 🟠 P2     | chat              | chat-conversations.service.ts         | 35                 | HIGH     |
| 🟠 P2     | chat              | chat-messages.service.ts              | 15                 | HIGH     |
| ⚪ P3     | kvp               | kvp-comments.service.ts               | 4                  | MEDIUM   |
| ⚪ P3     | kvp               | kvp-confirmations.service.ts          | 1                  | MEDIUM   |
| ⚪ P3     | blackboard        | blackboard-comments.service.ts        | 6                  | MEDIUM   |
| ⚪ P3     | blackboard        | blackboard-confirmations.service.ts   | 1                  | MEDIUM   |
| ⚪ P3     | blackboard        | blackboard-attachments.service.ts     | 4                  | MEDIUM   |
| ⚪ P3     | calendar          | calendar-permission.service.ts        | 2                  | MEDIUM   |
| ⚪ P3     | survey            | survey-access.service.ts              | 2                  | MEDIUM   |

### Backend — AuditTrailInterceptor (Pre-Mutation-Daten)

| Priorität | Problem                         | Betroffene Endpoints                            |
| --------- | ------------------------------- | ----------------------------------------------- |
| 🟡 P1     | TPM nicht in RESOURCE_TABLE_MAP | PATCH/DELETE /tpm/cards/:uuid, /tpm/plans/:uuid |
| ✅ OK     | Vacation korrekt gemappt        | Alle Vacation-Endpoints                         |

### Frontend — Error Handling (6 Violations + Silent Failures)

| Priorität | Problem                                      | Dateien                                |
| --------- | -------------------------------------------- | -------------------------------------- |
| 🔴 P0     | console.error statt logger                   | 6 Modal/Component-Dateien              |
| 🔴 P0     | Crypto-Worker-Crashes unsichtbar             | crypto-bridge.ts                       |
| 🟡 P1     | TPM Client-Modals: Errors nicht geloggt      | tpm/+page.svelte + Sub-Components      |
| 🟡 P1     | Vacation Client-Modals: Errors nicht geloggt | vacation/+page.svelte + Sub-Components |
| 🟠 P2     | Keine Error Boundaries für Component-Crashes | Systemweit                             |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [ ] Docker Stack running (alle Container healthy)
- [ ] DB Backup erstellt
- [ ] Aktueller Branch sauber (keine uncommitted changes)
- [ ] ADR-002 und ADR-009 gelesen (Referenz für Patterns)
- [ ] `HOW-TO-INTEGRATE-FEATURE.md` Sektion 2.7 als Referenz offen

### 0.2 Risk Register

| #   | Risiko                                   | Impact  | Wahrscheinlichkeit | Mitigation                                                  | Verifikation                                            |
| --- | ---------------------------------------- | ------- | ------------------ | ----------------------------------------------------------- | ------------------------------------------------------- |
| R1  | ActivityLogger-Calls brechen Mutations   | Hoch    | Niedrig            | `void this.activityLogger.log*()` Pattern (fire-and-forget) | Unit Test: Logger-Fehler → Mutation geht trotzdem durch |
| R2  | Falsche EntityTypes im Union             | Mittel  | Mittel             | TypeScript-Compiler fängt Typos                             | `pnpm run type-check` nach jeder Änderung               |
| R3  | RESOURCE_TABLE_MAP falscher Tabellenname | Mittel  | Mittel             | Gegen DB verifizieren                                       | `\dt tpm_*` Query vor Eintragung                        |
| R4  | Frontend Logger-Import bricht Build      | Niedrig | Niedrig            | `svelte-check` nach jeder Datei                             | CI Pipeline                                             |
| R5  | Zu viele Logs → DB-Wachstum              | Mittel  | Hoch               | Retention Job läuft bereits (ADR-009 Phase 4)               | `SELECT COUNT(*) FROM root_logs` vor/nach               |

---

## Phase 1: Backend — CRITICAL Fixes (P0)

> **Abhängigkeit:** Keine
> **Geschätzte Sessions:** 3

### Step 1.1: ActivityEntityType erweitern [PENDING]

**Datei:** `backend/src/nest/common/services/activity-logger.service.ts`

**Fehlende EntityTypes hinzufügen:**

```typescript
// Shifts (fehlen komplett)
| 'shift_plan'
| 'rotation_pattern'
| 'rotation'
| 'rotation_history'
// Admin
| 'admin_permission'
// Plans/Billing
| 'subscription_plan'
// TPM (bereits vorhanden, aber prüfen)
| 'tpm_template'
| 'tpm_time_estimate'
| 'tpm_color_config'
| 'tpm_escalation_config'
// Settings
| 'system_settings'
// Machines
| 'machine_maintenance'
// Chat (bewusste Entscheidung: GDPR → NICHT loggen?)
```

**Verifikation:**

```bash
docker exec assixx-backend pnpm run type-check
```

### Step 1.2: Shift-Module — ActivityLogger nachrüsten [PENDING]

**Dateien:**

- `backend/src/nest/shifts/shift-plans.service.ts` (25 Mutations)
- `backend/src/nest/shifts/rotation-pattern.service.ts` (22 Mutations)
- `backend/src/nest/shifts/rotation.service.ts` (22 Mutations)

**Pattern pro Service:**

1. `ActivityLoggerService` im Constructor injizieren
2. Im Module als Provider/Import sicherstellen
3. Nach jeder Mutation: `void this.activityLogger.logCreate/logUpdate/logDelete(...)`

**Pro Mutation-Methode:**

```typescript
void this.activityLogger.logCreate(tenantId, userId, 'shift_plan', entityId, `Schichtplan erstellt: ${name}`, {
  relevantFields,
});
```

**Verifikation:**

```bash
docker exec assixx-backend pnpm exec eslint backend/src/nest/shifts/
docker exec assixx-backend pnpm run type-check
```

### Step 1.3: Admin-Permissions — ActivityLogger nachrüsten [PENDING]

**Datei:** `backend/src/nest/admin-permissions/admin-permissions.service.ts` (24 Mutations)

**Kritisch:** Security-relevante Änderungen MÜSSEN geloggt werden.

**Verifikation:**

```bash
docker exec assixx-backend pnpm exec eslint backend/src/nest/admin-permissions/
```

### Step 1.4: Plans-Module — ActivityLogger nachrüsten [PENDING]

**Datei:** `backend/src/nest/plans/plans.service.ts` (58 Mutations)

**Kritisch:** Billing/Subscription-Änderungen MÜSSEN geloggt werden.

### Phase 1 — Definition of Done

- [ ] Alle P0-Services haben ActivityLoggerService injiziert
- [ ] Alle Mutation-Methoden in P0-Services rufen `void this.activityLogger.log*()` auf
- [ ] Neue EntityTypes im Union registriert
- [ ] ESLint 0 Errors in betroffenen Modulen
- [ ] Type-Check passed
- [ ] Bestehende Tests laufen weiterhin durch
- [ ] `SELECT COUNT(*) FROM root_logs` zeigt neue Einträge nach manuellem API-Test

---

## Phase 2: Backend — HIGH Priority Fixes (P1)

> **Abhängigkeit:** Phase 1 (EntityTypes müssen existieren)
> **Geschätzte Sessions:** 2-3

### Step 2.1: TPM-Module — Fehlende Services nachrüsten [PENDING]

**4 Services + 1 Methode:**

| Service                 | Methoden                                                                         | EntityType              |
| ----------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| TpmTemplatesService     | createTemplate, updateTemplate, deleteTemplate                                   | `tpm_template`          |
| TpmTimeEstimatesService | setEstimate, deleteEstimate                                                      | `tpm_time_estimate`     |
| TpmColorConfigService   | updateColor, resetToDefaults, updateIntervalColor, resetIntervalColorsToDefaults | `tpm_color_config`      |
| TpmEscalationService    | updateConfig                                                                     | `tpm_escalation_config` |
| TpmExecutionsService    | addPhoto (zusätzlich)                                                            | `tpm_execution`         |

### Step 2.2: TPM — RESOURCE_TABLE_MAP erweitern [PENDING]

**Datei:** `backend/src/nest/common/audit/audit.constants.ts` (oder wo RESOURCE_TABLE_MAP definiert ist)

**Hinzufügen:**

```typescript
'tpm-plan': { table: 'tpm_maintenance_plans', nameField: 'name' },
'tpm-card': { table: 'tpm_cards', nameField: 'title' },
'tpm-execution': { table: 'tpm_executions', nameField: 'id' },
```

**Verifikation:**

```bash
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_maintenance_plans"
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d tpm_cards"
```

### Step 2.3: Vacation — 2 fehlende Methoden nachrüsten [PENDING]

**Datei:** `backend/src/nest/vacation/vacation-entitlements.service.ts`

**Problem:** `carryOverRemainingDays()` und `updateEntitlement()` haben keinen `userId` Parameter.

**Fix:**

1. Method-Signature erweitern: `carryOverRemainingDays(tenantId, userId, ...)` — **Breaking Change prüfen!**
2. Method-Signature erweitern: `updateEntitlement(tenantId, userId, ...)` — **Breaking Change prüfen!**
3. ActivityLogger-Calls hinzufügen

**Verifikation:**

```bash
docker exec assixx-backend pnpm exec eslint backend/src/nest/vacation/
docker exec assixx-backend pnpm run type-check
# Caller-Stellen prüfen (Controller, andere Services)
```

### Step 2.4: Rotation-History — ActivityLogger nachrüsten [PENDING]

**Datei:** `backend/src/nest/shifts/rotation-history.service.ts` (14 Mutations)

### Phase 2 — Definition of Done

- [ ] Alle P1-Services haben ActivityLoggerService injiziert
- [ ] TPM RESOURCE_TABLE_MAP erweitert (3 Einträge)
- [ ] Vacation Entitlement-Methoden haben userId Parameter
- [ ] DELETE/UPDATE auf TPM-Ressourcen speichern Pre-Mutation-Daten in audit_trail.changes
- [ ] ESLint 0 Errors
- [ ] Type-Check passed
- [ ] Bestehende Unit Tests + API Tests grün

---

## Phase 3: Frontend — CRITICAL Fixes (P0)

> **Abhängigkeit:** Keine (parallel zu Phase 1+2 möglich)
> **Geschätzte Sessions:** 1-2

### Step 3.1: console.error → logger.error ersetzen [PENDING]

**6 Dateien mit Violations:**

| Datei                                                               | Zeile | Aktuell                              | Fix                                       |
| ------------------------------------------------------------------- | ----- | ------------------------------------ | ----------------------------------------- |
| `manage-employees/availability/_lib/EditAvailabilityModal.svelte`   | ~127  | `console.error('Error updating...')` | `log.error({err}, 'Error updating...')`   |
| `manage-employees/availability/_lib/DeleteConfirmationModal.svelte` | TBD   | `console.error(...)`                 | `log.error(...)`                          |
| `manage-employees/_lib/DeleteConfirmationModal.svelte`              | TBD   | `console.error(...)`                 | `log.error(...)`                          |
| `machines/_lib/EditMachineAvailabilityModal.svelte`                 | ~121  | `console.error(...)`                 | `log.error(...)`                          |
| `_lib/ImageCropModal.svelte`                                        | ~128  | `console.error(...)`                 | `log.error(...)`                          |
| `lib/crypto/crypto-bridge.ts`                                       | ~287  | `console.error('[CryptoBridge]...')` | `log.error({event}, '[CryptoBridge]...')` |

**Pattern:**

```typescript
// NACHHER (erreicht Sentry + Loki)
import { createLogger } from '$lib/utils/logger';

// VORHER (unsichtbar für Sentry + Loki)
console.error('Error:', errorMessage);

const log = createLogger('ComponentName');
log.error({ err }, 'Error description');
```

### Step 3.2: Crypto-Worker Crash-Handling [PENDING]

**Datei:** `frontend/src/lib/crypto/crypto-bridge.ts`

**Problem:** Worker.onerror loggt nur console.error → Sentry sieht nichts.

**Fix:**

```typescript
this.worker.onerror = (event: ErrorEvent) => {
  log.error({ message: event.message, filename: event.filename, lineno: event.lineno }, 'CryptoBridge worker crashed');
  this.handleCrash();
};
```

### Phase 3 — Definition of Done

- [ ] 0 console.error() Calls in Modal-/Component-Dateien (außer logger.ts, perf-logger.ts, crypto-worker.ts)
- [ ] Crypto-Bridge Worker-Fehler erreichen Logger (→ Sentry + Loki)
- [ ] `cd frontend && pnpm exec svelte-check --tsconfig ./tsconfig.json` — 0 Errors
- [ ] `cd frontend && pnpm exec eslint src/` — 0 Errors in betroffenen Dateien

---

## Phase 4: Frontend — TPM + Vacation Client-Side Error Tracking (P1)

> **Abhängigkeit:** Phase 3 (Logger-Pattern etabliert)
> **Geschätzte Sessions:** 1-2

### Step 4.1: TPM Client-Modals — Error-Logging nachrüsten [PENDING]

**Betroffene Dateien:** Alle `+page.svelte` und Modal-Komponenten in:

- `frontend/src/routes/(app)/(admin)/lean-management/tpm/`

**Pattern für jeden catch-Block:**

```typescript
catch (err: unknown) {
  const msg = err instanceof Error ? err.message : 'Unbekannter Fehler';
  log.error({ err }, 'TPM API call failed');  // ← NEU: Erreicht Sentry
  showErrorAlert(msg);                         // Bestehendes UI-Feedback
}
```

### Step 4.2: Vacation Client-Modals — Error-Logging nachrüsten [PENDING]

**Betroffene Dateien:** Alle Modals/Actions in:

- `frontend/src/routes/(app)/(shared)/vacation/`

### Phase 4 — Definition of Done

- [ ] Alle try/catch-Blöcke in TPM-Modals nutzen logger
- [ ] Alle try/catch-Blöcke in Vacation-Modals nutzen logger
- [ ] Manuelle Tests: Fehler im Browser → erscheint in Sentry/Loki
- [ ] svelte-check 0 Errors

---

## Phase 5: Backend — MEDIUM Priority Fixes (P2)

> **Abhängigkeit:** Phase 1 (EntityTypes + Pattern etabliert)
> **Geschätzte Sessions:** 2-3

### Step 5.1: Settings-Module [PENDING]

**Datei:** `backend/src/nest/settings/settings.service.ts` (27 Mutations)

### Step 5.2: Machine-Maintenance [PENDING]

**Datei:** `backend/src/nest/machines/machine-maintenance.service.ts` (7 Mutations)

### Step 5.3: User-Profile [PENDING]

**Datei:** `backend/src/nest/users/user-profile.service.ts` (36 Mutations)

### Step 5.4: Chat-System — Bewusste Entscheidung [PENDING]

**ACHTUNG:** Chat ist bewusst vom AuditTrailInterceptor ausgeschlossen (GDPR/DSGVO).

**Entscheidung nötig:**

- Option A: Chat-Mutations NICHT loggen (GDPR-konform, kein Audit Trail für Nachrichten)
- Option B: Nur Metadaten loggen (Conversation created/deleted, NICHT Nachrichteninhalte)
- Option C: Voll loggen mit Retention Policy (90 Tage, dann löschen)

→ **Empfehlung: Option B** — Metadaten ohne Inhalt loggen.

### Phase 5 — Definition of Done

- [ ] Settings, Machine-Maintenance, User-Profile haben ActivityLogger
- [ ] Chat-Strategie entschieden und dokumentiert
- [ ] ESLint + Type-Check passed
- [ ] Bestehende Tests grün

---

## Phase 6: Backend — LOW Priority Sub-Services (P3)

> **Abhängigkeit:** Phase 5
> **Geschätzte Sessions:** 1-2

### Step 6.1: Sub-Services mit eigenem ActivityLogger versehen [PENDING]

| Modul      | Sub-Service                         | Mutations |
| ---------- | ----------------------------------- | --------- |
| kvp        | kvp-comments.service.ts             | 4         |
| kvp        | kvp-confirmations.service.ts        | 1         |
| blackboard | blackboard-comments.service.ts      | 6         |
| blackboard | blackboard-confirmations.service.ts | 1         |
| blackboard | blackboard-attachments.service.ts   | 4         |
| calendar   | calendar-permission.service.ts      | 2         |
| survey     | survey-access.service.ts            | 2         |

**Begründung:** Sub-Services werden aktuell nur über Facades aufgerufen, aber wenn sie direkt importiert werden, fehlt das Logging. Defense-in-depth.

### Phase 6 — Definition of Done

- [ ] Alle Sub-Services haben eigenen ActivityLogger
- [ ] ESLint + Type-Check passed
- [ ] Tests grün

---

## Phase 7: Verifikation & Abnahme

> **Abhängigkeit:** Alle vorherigen Phasen
> **Geschätzte Sessions:** 1

### Step 7.1: Vollständiger Logging-Audit [PENDING]

```bash
# Prüfe: Jeder Service mit Mutations hat ActivityLoggerService
grep -rn "ActivityLoggerService" backend/src/nest/ | wc -l

# Prüfe: Keine console.error in Frontend (außer Whitelist)
grep -rn "console.error" frontend/src/routes/ frontend/src/lib/ | grep -v "logger.ts" | grep -v "perf-logger"

# Prüfe: root_logs werden geschrieben
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT action, entity_type, COUNT(*) FROM root_logs GROUP BY action, entity_type ORDER BY count DESC;"

# Prüfe: audit_trail hat Pre-Mutation-Daten für TPM
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT resource_type, action, changes IS NOT NULL as has_changes FROM audit_trail WHERE resource_type LIKE 'tpm%' ORDER BY created_at DESC LIMIT 20;"
```

### Step 7.2: Smoke Tests [PENDING]

| Test                            | Erwartung                                      |
| ------------------------------- | ---------------------------------------------- |
| TPM Card erstellen              | root_logs + audit_trail Eintrag                |
| TPM Card löschen                | root_logs + audit_trail mit Pre-Mutation-Daten |
| TPM Template ändern             | root_logs Eintrag (NEU!)                       |
| Vacation Request erstellen      | root_logs + audit_trail Eintrag                |
| Vacation Entitlement Carry-Over | root_logs Eintrag (NEU!)                       |
| Schichtplan erstellen           | root_logs Eintrag (NEU!)                       |
| Admin-Berechtigung ändern       | root_logs Eintrag (NEU!)                       |
| Frontend-Modal Fehler           | Sentry Event + Loki Log                        |
| Crypto-Worker Crash             | Loki Log (NEU!)                                |

### Phase 7 — Definition of Done

- [ ] Alle Smoke Tests bestanden
- [ ] Kein Service mit >1 Mutation ohne ActivityLogger
- [ ] 0 console.error Violations im Frontend
- [ ] audit_trail zeigt Pre-Mutation-Daten für TPM DELETE/UPDATE

---

## Session Tracking

| Session | Phase | Beschreibung                                                                   | Status | Datum |
| ------- | ----- | ------------------------------------------------------------------------------ | ------ | ----- |
| 1       | 1     | EntityTypes erweitern + Shift-Module (shift-plans, rotation-pattern, rotation) |        |       |
| 2       | 1     | Admin-Permissions + Plans-Module                                               |        |       |
| 3       | 1     | Verifikation Phase 1                                                           |        |       |
| 4       | 2     | TPM Services + RESOURCE_TABLE_MAP                                              |        |       |
| 5       | 2     | Vacation Entitlements + Rotation-History                                       |        |       |
| 6       | 3     | Frontend console.error Fixes + Crypto-Bridge                                   |        |       |
| 7       | 4     | TPM + Vacation Client-Modals Error-Logging                                     |        |       |
| 8       | 5     | Settings + Machine-Maintenance + User-Profile                                  |        |       |
| 9       | 5     | Chat-Entscheidung + Umsetzung                                                  |        |       |
| 10      | 6     | Sub-Services (KVP, Blackboard, Calendar, Survey)                               |        |       |
| 11      | 7     | Vollständiger Audit + Smoke Tests                                              |        |       |

---

## Metriken (Ziel)

| Metrik                              | Vorher (2026-02-25) | Nachher (Ziel) |
| ----------------------------------- | ------------------- | -------------- |
| Services mit ActivityLogger         | 16 (39%)            | 41 (100%)      |
| Ungeloggte Mutations                | 197+                | 0              |
| console.error Violations (Frontend) | 6                   | 0              |
| TPM Pre-Mutation-Data               | ❌                  | ✅             |
| Client-Side Errors → Sentry         | ~60%                | ~95%           |
| Crypto-Worker Crashes tracked       | ❌                  | ✅             |

---

## Bewusste Entscheidungen

| #   | Entscheidung                              | Begründung                                                        |
| --- | ----------------------------------------- | ----------------------------------------------------------------- |
| D1  | Chat-Nachrichteninhalte NICHT loggen      | GDPR/DSGVO — persönliche Kommunikation                            |
| D2  | TpmCardStatusService NICHT separat loggen | Wird nur als interner Helper aufgerufen, Logging auf Caller-Ebene |
| D3  | TpmSchedulingService NICHT separat loggen | Interner Helper, Logging bei Card-Creation/Execution              |
| D4  | perf-logger.ts console.log akzeptiert     | Gated durch localStorage Flag, nur für Dev                        |

---

## Known Limitations (V1)

1. **Keine Error Boundaries im Frontend** — Svelte hat kein natives Error-Boundary-Pattern. Component-Crashes → globaler +error.svelte. Verbesserung für V2.
2. **Kein automatischer @LogActivity Decorator** — Jeder Service muss manuell loggen. Decorator-Pattern für V2 evaluieren.
3. **Keine Sentry Breadcrumbs vor Client-API-Calls** — Würde jede API-Funktion ändern. Für V2 mit Wrapper-Pattern lösen.
4. **IndexedDB-Fehler im Crypto-Worker nicht erfasst** — Worker hat keinen Zugang zum Logger. Für V2 mit postMessage-Bridge lösen.

---

## Referenzen

- [ADR-002: Alerting & Monitoring](../infrastructure/adr/ADR-002-alerting-monitoring.md) — Pino, Sentry, PLG Stack
- [ADR-009: Central Audit Logging](../infrastructure/adr/ADR-009-central-audit-logging.md) — audit_trail, root_logs
- [ADR-009 Implementation Plan](../infrastructure/adr/ADR-009-implementation-plan.md) — AuditTrailInterceptor Details
- [HOW-TO-INTEGRATE-FEATURE](../HOW-TO-INTEGRATE-FEATURE.md) — Sektion 2.7: Activity Logging
- [activity-logger.service.ts](../../backend/src/nest/common/services/activity-logger.service.ts) — ActivityEntityType Union

---

_Dieses Dokument ist der Execution Plan. Jede Session startet hier, nimmt das nächste unchecked Item, und markiert es als done._
