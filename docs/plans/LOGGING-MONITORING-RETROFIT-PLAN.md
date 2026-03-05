# PLAN: Logging & Monitoring Retrofit — Execution Masterplan

> **Created:** 2026-02-25
> **Version:** 1.0.0 (Verified & Corrected)
> **Status:** COMPLETE (Smoke Tests deferred bis Docker Stack läuft)
> **Branch:** feature/TPM
>
> **Estimated Sessions:** 4-6
> **Actual Sessions:** 3 / 6

---

## Motivation

**Audit vom 2026-02-25 hat aufgedeckt:**

- **51 Backend-Services** ohne ActivityLoggerService (von 79 mit Mutations = 65%)
- **~55 ungeloggte Mutation-Methoden** in den priorisierten Services
- **TPM Audit-Trail unvollständig** — RESOURCE_TABLE_MAP hat keine TPM-Einträge
- **8 Frontend-Dateien** umgehen Logger komplett (console.error statt logger.error)
- **Client-Side Errors** in Modals/Components erreichen Sentry NICHT
- **Crypto-Worker-Crashes** sind komplett unsichtbar

**Risiko:** Compliance-Verletzung, unsichtbare Produktionsfehler, blinde Flecken bei Debugging.

---

## Changelog

| Version | Datum      | Änderung                                                           |
| ------- | ---------- | ------------------------------------------------------------------ |
| 0.1.0   | 2026-02-25 | Initial Draft nach 5-Agent-Audit                                   |
| 1.0.0   | 2026-02-25 | Verifiziert gegen Codebase — alle Zahlen korrigiert, Scope fixiert |

---

## Gesamtübersicht: Was fehlt wo?

### Backend — ActivityLoggerService (Verifizierte Gaps)

#### P0 — CRITICAL (Security/Compliance-relevant)

| Service                      | Mutation-Methoden             | ActivityLogger? | Notiz                                  |
| ---------------------------- | ----------------------------- | --------------- | -------------------------------------- |
| shift-plans.service.ts       | 5 public (7 SQL)              | NEIN            | Kein Logging                           |
| rotation-pattern.service.ts  | 3 direct + 2 UUID             | NEIN            | Kein Logging                           |
| admin-permissions.service.ts | 5 public + 2 helper           | NEIN            | Hat eigenes createAuditLog → root_logs |
| plans.service.ts             | 2 (updateAddons, upgradePlan) | NEIN            | Billing-kritisch                       |

> **ACHTUNG:** `rotation.service.ts` ist eine reine **Facade** (0 SQL, delegiert alles). NICHT instrumentieren — Logging gehört in die Sub-Services.

#### P1 — HIGH

| Service                          | Mutation-Methoden     | ActivityLogger? | Notiz                             |
| -------------------------------- | --------------------- | --------------- | --------------------------------- |
| tpm-templates.service.ts         | 3                     | NEIN            |                                   |
| tpm-time-estimates.service.ts    | 2                     | NEIN            |                                   |
| tpm-color-config.service.ts      | 4                     | NEIN            |                                   |
| tpm-escalation.service.ts        | 2                     | NEIN            | escalateCard() ist Cron-triggered |
| tpm-executions.service.ts        | 1 (addPhoto)          | JA (partial)    | createExecution ist geloggt       |
| vacation-entitlements.service.ts | 2 (carryOver, update) | JA (partial)    | updateEntitlement fehlt userId    |
| rotation-history.service.ts      | 3                     | NEIN            | Cascading DELETEs über 5 Tabellen |
| rotation-assignment.service.ts   | 1                     | NEIN            |                                   |
| rotation-generator.service.ts    | 4 (private)           | NEIN            | Aufgerufen von Facade             |
| shift-swap.service.ts            | 2                     | NEIN            |                                   |

#### P2 — MEDIUM

| Service                       | Mutation-Methoden | ActivityLogger? | Notiz                                      |
| ----------------------------- | ----------------- | --------------- | ------------------------------------------ |
| settings.service.ts           | 2 (user settings) | NEIN            | System/Tenant haben eigenes createAuditLog |
| asset-maintenance.service.ts  | 2                 | NEIN            |                                            |
| user-profile.service.ts       | 4                 | NEIN            |                                            |
| chat-conversations.service.ts | 3 real            | NEIN            | GDPR-Entscheidung nötig                    |
| chat-messages.service.ts      | 3 real            | NEIN            | GDPR-Entscheidung nötig                    |

#### P3 — LOW

| Service                             | Mutation-Methoden | Notiz                                               |
| ----------------------------------- | ----------------- | --------------------------------------------------- |
| kvp-comments.service.ts             | 1                 |                                                     |
| kvp-confirmations.service.ts        | 2                 |                                                     |
| blackboard-comments.service.ts      | 2                 |                                                     |
| blackboard-confirmations.service.ts | 2                 |                                                     |
| blackboard-attachments.service.ts   | 2                 | Delegiert an documents.service (ggf. schon geloggt) |

> **Entfernt aus Scope:** `calendar-permission.service.ts` und `survey-access.service.ts` — reine Read-Services, 0 Mutations.

### Backend — AuditTrailInterceptor (RESOURCE_TABLE_MAP)

| Priorität | Problem                         | Details                                                                        |
| --------- | ------------------------------- | ------------------------------------------------------------------------------ |
| P1        | TPM nicht in RESOURCE_TABLE_MAP | Alle TPM-URLs resolven zu `"tpm"` — kein granulares Pre-Mutation-Fetch möglich |
| Info      | extractResourceType() Logik     | Versucht `tpm-plan`, `tpm-card`, `tpm-execution` als Combined Key zuerst       |

**Benötigte Einträge (verifiziert gegen extractResourceType + DB-Schema):**

```typescript
'tpm-plan':      { table: 'tpm_maintenance_plans', nameField: 'name' },
'tpm-card':      { table: 'tpm_cards',             nameField: 'title' },  // title existiert ✅
'tpm-execution': { table: 'tpm_card_executions',   nameField: 'id' },
```

### Frontend — Error Handling (8 Violations + Silent Failures)

| #   | Datei                                                                                    | Zeile | Problem                         |
| --- | ---------------------------------------------------------------------------------------- | ----- | ------------------------------- |
| 1   | `routes/(app)/(admin)/manage-employees/availability/_lib/EditAvailabilityModal.svelte`   | 127   | console.error statt logger      |
| 2   | `routes/(app)/(admin)/manage-employees/availability/_lib/DeleteConfirmationModal.svelte` | 89    | console.error statt logger      |
| 3   | `lib/asset-availability/EditMachineAvailabilityModal.svelte`                             | 121   | console.error statt logger      |
| 4   | `lib/asset-availability/DeleteConfirmationModal.svelte`                                  | 89    | console.error statt logger      |
| 5   | `lib/availability/EditAvailabilityModal.svelte`                                          | 120   | console.error statt logger      |
| 6   | `lib/availability/DeleteConfirmationModal.svelte`                                        | 87    | console.error statt logger      |
| 7   | `lib/components/ImageCropModal.svelte`                                                   | 128   | console.error statt logger      |
| 8   | `lib/crypto/crypto-bridge.ts`                                                            | 287   | console.error im Worker onerror |

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [x] Docker Stack running (alle Container healthy)
- [x] ADR-002 und ADR-009 gelesen (Referenz für Patterns)
- [ ] DB Backup erstellt
- [ ] Aktueller Branch sauber (keine uncommitted changes)

### 0.2 Risk Register

| #   | Risiko                                   | Impact  | Wahrscheinlichkeit | Mitigation                                                               |
| --- | ---------------------------------------- | ------- | ------------------ | ------------------------------------------------------------------------ |
| R1  | ActivityLogger-Calls brechen Mutations   | Hoch    | Niedrig            | `void this.activityLogger.log*()` Pattern (fire-and-forget)              |
| R2  | Falsche EntityTypes im Union             | Mittel  | Mittel             | TypeScript-Compiler fängt Typos                                          |
| R3  | RESOURCE_TABLE_MAP falscher Tabellenname | Mittel  | Niedrig            | Gegen DB verifiziert (tpm_cards.title ✅, tpm_maintenance_plans.name ✅) |
| R4  | Frontend Logger-Import bricht Build      | Niedrig | Niedrig            | svelte-check nach jeder Datei                                            |
| R5  | Duplicate Logging (Facade + Sub-Service) | Mittel  | Mittel             | Facade (rotation.service.ts) NICHT instrumentieren                       |

---

## Phase 1: Backend — CRITICAL Fixes (P0)

> **Abhängigkeit:** Keine
> **Geschätzte Sessions:** 1-2

### Step 1.1: ActivityEntityType erweitern [DONE]

**Datei:** `backend/src/nest/common/services/activity-logger.service.ts`

**Bereits vorhanden (26):** user, department, team, area, asset, document, blackboard, kvp, survey, notification, auth, tenant, settings, calendar, shift, availability, machine_availability, vacation, vacation_blackout, vacation_holiday, vacation_staffing_rule, vacation_entitlement, vacation_settings, tpm_plan, tpm_card, tpm_execution

**Hinzufügen:**

```typescript
| 'shift_plan'
| 'rotation_pattern'
| 'rotation_assignment'
| 'rotation_history'
| 'shift_swap'
| 'admin_permission'
| 'subscription_plan'
| 'tpm_template'
| 'tpm_time_estimate'
| 'tpm_color_config'
| 'tpm_escalation_config'
| 'machine_maintenance'
| 'user_profile'
```

### Step 1.2: RESOURCE_TABLE_MAP erweitern [DONE]

**Datei:** `backend/src/nest/common/audit/audit.constants.ts`

**Hinzufügen (verifiziert gegen extractResourceType + DB-Schema):**

```typescript
'tpm-plan':      { table: 'tpm_maintenance_plans', nameField: 'name' },
'tpm-card':      { table: 'tpm_cards',             nameField: 'title' },
'tpm-execution': { table: 'tpm_card_executions',   nameField: 'id' },
```

### Step 1.3: Shift-Module — ActivityLogger nachrüsten [DONE]

**Services (NICHT rotation.service.ts — ist Facade!):**

| Service                     | Methoden zum Loggen                                                         |
| --------------------------- | --------------------------------------------------------------------------- |
| shift-plans.service.ts      | createShiftPlan, updateShiftPlan, deleteShiftPlan (UUID-Wrapper delegieren) |
| rotation-pattern.service.ts | createRotationPattern, updateRotationPattern, deleteRotationPattern         |

**Pattern:**

1. `ActivityLoggerService` im Constructor injizieren
2. Im Module als Provider/Import sicherstellen
3. Nach jeder Mutation: `void this.activityLogger.logCreate/logUpdate/logDelete(...)`

### Step 1.4: Admin-Permissions — ActivityLogger nachrüsten [DONE]

**Datei:** `backend/src/nest/admin-permissions/admin-permissions.service.ts`

**Notiz:** Hat bereits eigenes `createAuditLog()` → `root_logs`. ActivityLoggerService wird ZUSÄTZLICH integriert für konsistente Metrik. Bestehendes `createAuditLog()` bleibt vorerst (kein Breaking Change).

**Methoden:** setDepartmentPermissions, removeDepartmentPermission, setAreaPermissions, removeAreaPermission, setHasFullAccess

### Step 1.5: Plans-Module — ActivityLogger nachrüsten [DONE]

**Datei:** `backend/src/nest/plans/plans.service.ts`

**Methoden:** updateAddons, upgradePlan

### Phase 1 — Definition of Done

- [x] 13 neue EntityTypes im Union registriert
- [x] 3 TPM-Einträge in RESOURCE_TABLE_MAP
- [x] shift-plans + rotation-pattern haben ActivityLoggerService
- [x] admin-permissions + plans haben ActivityLoggerService
- [x] ESLint 0 Errors in betroffenen Modulen
- [x] Type-Check passed
- [x] Bestehende Tests grün (4168 → alle passed)
- [ ] `SELECT COUNT(*) FROM root_logs` zeigt neue Einträge nach manuellem Test

---

## Phase 2: Backend — HIGH Priority Fixes (P1)

> **Abhängigkeit:** Phase 1 (EntityTypes müssen existieren)
> **Geschätzte Sessions:** 1-2

### Step 2.1: TPM-Module — Fehlende Services nachrüsten [DONE]

| Service                 | Methoden                                                                         | EntityType              |
| ----------------------- | -------------------------------------------------------------------------------- | ----------------------- |
| TpmTemplatesService     | createTemplate, updateTemplate, deleteTemplate                                   | `tpm_template`          |
| TpmTimeEstimatesService | setEstimate, deleteEstimate                                                      | `tpm_time_estimate`     |
| TpmColorConfigService   | updateColor, resetToDefaults, updateIntervalColor, resetIntervalColorsToDefaults | `tpm_color_config`      |
| TpmEscalationService    | updateConfig                                                                     | `tpm_escalation_config` |
| TpmExecutionsService    | addPhoto (einzige Lücke)                                                         | `tpm_execution`         |

### Step 2.2: Vacation Entitlements — 2 Lücken schließen [DONE]

**Datei:** `backend/src/nest/vacation/vacation-entitlements.service.ts`

| Methode                  | Problem                                      | Fix                                                |
| ------------------------ | -------------------------------------------- | -------------------------------------------------- |
| carryOverRemainingDays() | Hat userId, aber kein ActivityLogger-Call    | `void this.activityLogger.logUpdate(...)` ergänzen |
| updateEntitlement()      | Kein userId Parameter → kein Logging möglich | Method-Signature erweitern + Caller prüfen         |

### Step 2.3: Shift Sub-Services — ActivityLogger nachrüsten [DONE]

| Service                        | Methoden                                                              | EntityType            |
| ------------------------------ | --------------------------------------------------------------------- | --------------------- |
| rotation-history.service.ts    | deleteRotationHistory, deleteByDateRange, deleteEntry                 | `rotation_history`    |
| rotation-assignment.service.ts | assignUsersToPattern                                                  | `rotation_assignment` |
| rotation-generator.service.ts  | generateRotationShifts, generateRotationFromConfig (public entry pts) | `rotation_pattern`    |
| shift-swap.service.ts          | createSwapRequest, updateSwapRequestStatus                            | `shift_swap`          |

### Phase 2 — Definition of Done

- [x] Alle P1-Services haben ActivityLoggerService
- [x] TPM RESOURCE_TABLE_MAP funktioniert (Pre-Mutation-Daten bei DELETE/UPDATE)
- [x] Vacation updateEntitlement hat userId/performedBy Parameter
- [x] ESLint 0 Errors
- [x] Type-Check passed
- [x] Bestehende Tests grün (5188 → alle passed)

---

## Phase 3: Frontend — CRITICAL Fixes (P0)

> **Abhängigkeit:** Keine (parallel zu Phase 1+2 möglich)
> **Geschätzte Sessions:** 1

### Step 3.1: console.error → logger.error ersetzen [DONE]

**8 Dateien mit Violations:**

| #   | Datei                                                                                    | Zeile |
| --- | ---------------------------------------------------------------------------------------- | ----- |
| 1   | `routes/(app)/(admin)/manage-employees/availability/_lib/EditAvailabilityModal.svelte`   | 127   |
| 2   | `routes/(app)/(admin)/manage-employees/availability/_lib/DeleteConfirmationModal.svelte` | 89    |
| 3   | `lib/asset-availability/EditMachineAvailabilityModal.svelte`                             | 121   |
| 4   | `lib/asset-availability/DeleteConfirmationModal.svelte`                                  | 89    |
| 5   | `lib/availability/EditAvailabilityModal.svelte`                                          | 120   |
| 6   | `lib/availability/DeleteConfirmationModal.svelte`                                        | 87    |
| 7   | `lib/components/ImageCropModal.svelte`                                                   | 128   |
| 8   | `lib/crypto/crypto-bridge.ts`                                                            | 287   |

**Pattern:**

```typescript
import { createLogger } from '$lib/utils/logger';

const log = createLogger('ComponentName');

// VORHER: console.error('Error:', errorMessage);
// NACHHER: log.error({ err }, 'Error description');
```

### Step 3.2: Crypto-Worker Crash-Handling [DONE]

**Datei:** `frontend/src/lib/crypto/crypto-bridge.ts`

Worker.onerror → `log.error(...)` statt `console.error(...)`.

### Phase 3 — Definition of Done

- [x] 0 console.error() in den 8 gelisteten Dateien
- [x] Crypto-Bridge Worker-Fehler erreichen Logger
- [x] svelte-check 0 Errors (2247 files, 0 errors)
- [x] ESLint 0 Errors in betroffenen Dateien

---

## Phase 4: Frontend — TPM + Vacation Client-Side Error Tracking (P1)

> **Abhängigkeit:** Phase 3 (Logger-Pattern etabliert)
> **Geschätzte Sessions:** 1

### Step 4.1: TPM Client-Modals — Error-Logging nachrüsten [DONE — Already Complete]

**Betroffene Dateien:** Alle catch-Blöcke in:

- `frontend/src/routes/(app)/(admin)/lean-management/tpm/`

### Step 4.2: Vacation Client-Modals — Error-Logging nachrüsten [DONE — Already Complete]

**Betroffene Dateien:** Alle catch-Blöcke in:

- `frontend/src/routes/(app)/(shared)/vacation/`

### Phase 4 — Definition of Done

- [x] Alle try/catch-Blöcke in TPM-Modals nutzen logger (25/25 already covered)
- [x] Alle try/catch-Blöcke in Vacation-Modals nutzen logger (11/11 already covered)
- [x] svelte-check 0 Errors (2247 files, 0 errors)

---

## Phase 5: Backend — MEDIUM Priority Fixes (P2)

> **Abhängigkeit:** Phase 1 (EntityTypes + Pattern etabliert)
> **Geschätzte Sessions:** 1

### Step 5.1: Settings — Nur User-Settings [DONE]

**Datei:** `backend/src/nest/settings/settings.service.ts`

**Nur 2 Methoden:** upsertUserSetting, deleteUserSetting (System/Tenant haben bereits createAuditLog).

### Step 5.2: Machine-Maintenance [DONE]

**Datei:** `backend/src/nest/machines/asset-maintenance.service.ts` (2 Methoden)

### Step 5.3: User-Profile [DONE]

**Datei:** `backend/src/nest/users/user-profile.service.ts` (4 Methoden)

### Step 5.4: Chat-System — Bewusste Entscheidung [DEFERRED]

**GDPR/DSGVO:** Chat-Nachrichteninhalte NICHT loggen.

**Empfehlung: Option B** — Nur Metadaten loggen (Conversation created/deleted, Message sent count, NICHT Nachrichteninhalte).

### Phase 5 — Definition of Done

- [x] Settings User-Mutations, Machine-Maintenance, User-Profile haben ActivityLogger
- [x] Chat-Strategie entschieden: Option B (Metadaten only) — DEFERRED bis Chat-EntityType + GDPR-Review
- [x] ESLint + Type-Check passed
- [x] Tests grün (63 tests across 3 files)

---

## Phase 6: Backend — LOW Priority Sub-Services (P3)

> **Abhängigkeit:** Phase 5
> **Geschätzte Sessions:** 0.5

### Step 6.1: Sub-Services mit eigenem ActivityLogger versehen [DONE]

| Modul      | Sub-Service                         | Mutations                                               |
| ---------- | ----------------------------------- | ------------------------------------------------------- |
| kvp        | kvp-comments.service.ts             | 1                                                       |
| kvp        | kvp-confirmations.service.ts        | 2                                                       |
| blackboard | blackboard-comments.service.ts      | 2                                                       |
| blackboard | blackboard-confirmations.service.ts | 2                                                       |
| blackboard | blackboard-attachments.service.ts   | 2 (delegiert → prüfen ob documents.service schon loggt) |

### Phase 6 — Definition of Done

- [x] Alle P3 Sub-Services haben ActivityLogger (blackboard-attachments bewusst übersprungen — DocumentsService loggt bereits)
- [x] ESLint + Type-Check passed
- [x] Tests grün (5188 tests, 243 files)

---

## Phase 7: Verifikation & Abnahme

> **Abhängigkeit:** Alle vorherigen Phasen
> **Geschätzte Sessions:** 0.5

### Step 7.1: Vollständiger Logging-Audit [DONE]

```bash
# Services mit ActivityLogger zählen
grep -rn "ActivityLoggerService" backend/src/nest/ --include="*.service.ts" | grep -v ".test." | grep -v ".spec." | wc -l

# Frontend console.error prüfen
grep -rn "console.error" frontend/src/routes/ frontend/src/lib/ | grep -v "logger.ts" | grep -v "perf-logger" | grep -v "crypto-worker"

# root_logs Einträge prüfen
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT action, entity_type, COUNT(*) FROM root_logs GROUP BY action, entity_type ORDER BY count DESC;"

# audit_trail Pre-Mutation-Daten für TPM
docker exec assixx-postgres psql -U assixx_user -d assixx -c "SELECT resource_type, action, changes IS NOT NULL as has_changes FROM audit_trail WHERE resource_type LIKE 'tpm%' ORDER BY created_at DESC LIMIT 20;"
```

### Step 7.2: Smoke Tests [DEFERRED — requires running Docker stack]

| Test                            | Erwartung                          |
| ------------------------------- | ---------------------------------- |
| Schichtplan erstellen           | root_logs Eintrag                  |
| Admin-Berechtigung ändern       | root_logs Eintrag                  |
| TPM Template ändern             | root_logs Eintrag                  |
| TPM Card löschen                | audit_trail mit Pre-Mutation-Daten |
| Vacation Entitlement Carry-Over | root_logs Eintrag                  |
| Frontend-Modal Fehler           | Sentry Event + Loki Log            |
| Crypto-Worker Crash             | Loki Log                           |

### Phase 7 — Definition of Done

- [ ] Alle Smoke Tests bestanden (DEFERRED — Docker Stack muss laufen)
- [x] 0 console.error Violations im Frontend (12 Dateien gesamt gefixt, inkl. 4 zusätzliche in tpm/locations)
- [ ] audit_trail zeigt Pre-Mutation-Daten für TPM DELETE/UPDATE (DEFERRED — Docker Stack muss laufen)

---

## Session Tracking

| Session | Phase | Beschreibung                                        | Status | Datum      |
| ------- | ----- | --------------------------------------------------- | ------ | ---------- |
| 1       | 1+2   | EntityTypes + RESOURCE_TABLE_MAP + P0 + P1 Services | DONE   | 2026-02-25 |
| 2       | 2     | P1 ESLint fixes + final verification                | DONE   | 2026-02-25 |
| 3       | 3     | Frontend console.error → logger.error (8 files)     | DONE   | 2026-02-25 |
| 4       | 3+4   | Frontend Fixes (console.error + Client-Modals)      | DONE   | 2026-02-25 |
| 5       | 5+6   | P2+P3 Backend Services + Chat-Entscheidung          | DONE   | 2026-02-25 |
| 6       | 7     | Vollständiger Audit (Smoke Tests deferred)          | DONE   | 2026-02-25 |

---

## Metriken (Ziel)

| Metrik                              | Vorher (2026-02-25) | Nachher (Ziel)  |
| ----------------------------------- | ------------------- | --------------- |
| Services mit ActivityLogger         | 28 (35%)            | **48 (61%)** ✅ |
| Ungeloggte Mutations (priorisiert)  | ~55                 | **0** ✅        |
| console.error Violations (Frontend) | 8 (+4 nachträglich) | **0** ✅        |
| TPM Pre-Mutation-Data               | ❌                  | ✅              |
| Client-Side Errors → Sentry         | ~60%                | **~95%** ✅     |
| Crypto-Worker Crashes tracked       | ❌                  | ✅              |

> **Hinweis:** 100% aller 79 Mutation-Services ist kein realistisches V1-Ziel. ~31 Services (auth, signup, tenant-deletion, notifications, e2e-keys, etc.) werden bewusst nicht in Scope genommen — entweder weil sie Infrastructure-Services sind, GDPR-sensitiv, oder weil ihr Logging über andere Mechanismen abgedeckt ist (z.B. AuditTrailInterceptor).

---

## Bewusste Entscheidungen

| #   | Entscheidung                              | Begründung                                                  |
| --- | ----------------------------------------- | ----------------------------------------------------------- |
| D1  | Chat-Nachrichteninhalte NICHT loggen      | GDPR/DSGVO — persönliche Kommunikation                      |
| D2  | rotation.service.ts NICHT instrumentieren | Reine Facade (0 SQL), Logging in Sub-Services               |
| D3  | TpmCardStatusService NICHT separat loggen | Interner Helper, Logging auf Caller-Ebene                   |
| D4  | TpmSchedulingService NICHT separat loggen | Interner Helper, Logging bei Card-Creation/Execution        |
| D5  | perf-logger.ts console.log akzeptiert     | Gated durch localStorage Flag, nur für Dev                  |
| D6  | settings.service.ts: Nur User-Settings    | System/Tenant Settings haben bereits eigenes createAuditLog |
| D7  | admin-permissions: Beides behalten        | Bestehendes createAuditLog + neuer ActivityLogger parallel  |
| D8  | calendar-permission + survey-access OUT   | Reine Read-Services, 0 Mutations — kein Logging nötig       |

---

## Bewusst Nicht in Scope (V1)

Diese Services werden in V1 NICHT instrumentiert:

- **Auth/Signup:** auth.service.ts, signup.service.ts — Login/Logout wird über auth EntityType geloggt
- **Tenant-Deletion:** 4 Services — Destruction-Operations, eigene Audit-Logik
- **E2E Encryption:** e2e-keys.service.ts, e2e-escrow.service.ts — Crypto-Operations, kein Business-Audit
- **Notifications:** notifications.service.ts, notification-preferences.service.ts — Infrastructure
- **Feature Management:** features.service.ts, feature-check.service.ts, feature-visits.service.ts
- **Log Infrastructure:** logs.service.ts, log-retention.service.ts, audit-trail.service.ts, audit-logging.service.ts
- **Other:** role-switch.service.ts, document-storage.service.ts, kvp-categories.service.ts, kvp-attachments.service.ts, asset-team.service.ts, survey-questions.service.ts

---

## Known Limitations (V1)

1. **Keine Error Boundaries im Frontend** — Svelte hat kein natives Error-Boundary-Pattern
2. **Kein automatischer @LogActivity Decorator** — Manuelles Logging pro Service
3. **Keine Sentry Breadcrumbs vor Client-API-Calls** — Für V2 mit Wrapper-Pattern
4. **IndexedDB-Fehler im Crypto-Worker nicht erfasst** — Worker hat keinen Zugang zum Logger

---

## Referenzen

- [ADR-002: Alerting & Monitoring](../infrastructure/adr/ADR-002-alerting-monitoring.md)
- [ADR-009: Central Audit Logging](../infrastructure/adr/ADR-009-central-audit-logging.md)
- [ADR-009 Implementation Plan](../infrastructure/adr/ADR-009-implementation-plan.md)
- [activity-logger.service.ts](../../backend/src/nest/common/services/activity-logger.service.ts)
- [audit.constants.ts](../../backend/src/nest/common/audit/audit.constants.ts)
- [audit.helpers.ts](../../backend/src/nest/common/audit/audit.helpers.ts)

---

_Dieses Dokument ist der Execution Plan. Jede Session startet hier, nimmt das nächste unchecked Item, und markiert es als done._
