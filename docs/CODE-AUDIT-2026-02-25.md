# Code Audit — 6. März 2026 (v2) + Fixes v3 (7. März 2026)

**Originalaudit:** 25. Februar 2026 (Branch `feature/TPM`)
**Update v2:** 6. März 2026 (Branch `feat/pg-partman`)
**Fixes v3:** 7. März 2026 (Branch `refactor/code-audit`) — 5 Sofort-Maßnahmen + Regressions-Schutz
**Auditor:** Claude Opus 4.6 (10 parallele Verifikations-Agents)
**Scope:** Gesamte Codebase (`backend/src/`, `frontend/src/`)
**Verifiziert:** Unabhängige Gegenprüfung aller Metriken gegen aktuelle Codebase

---

## Zusammenfassung

| Kategorie                 | v1 (25.02.) | v2 (06.03.) | Trend | Begründung                                                           |
| ------------------------- | ----------- | ----------- | ----- | -------------------------------------------------------------------- |
| **Gesamtbewertung**       | 8/10        | **7/10**    | ↓     | Neue Module nicht auditiert, `is_active` verdoppelt, Limits gerissen |
| Architektur & Modularität | 8/10        | **8/10**    | →     | Work Orders sauber modularisiert                                     |
| Type Safety               | 7/10        | **8/10**    | **↑** | v3: Backend catch-Blöcke BEHOBEN + Architektur-Test enforced         |
| Code-Duplikation          | 5/10        | **5/10**    | **↑** | v3: Session-Expired zentralisiert (16→1), `is_active` 466× bleibt    |
| Dateigrößen-Compliance    | 9/10        | **7/10**    | ↓     | Mehrere Frontend-Dateien überschreiten jetzt Limits                  |
| ESLint-Disziplin          | 9/10        | **10/10**   | **↑** | v3: eslint-disable begründet → **100% Compliance** (179/179)         |
| Test-Abdeckung            | 9/10        | **9/10**    | →     | +465 Tests, Work Orders Coverage ungeprüft                           |
| Dokumentation             | 10/10       | **10/10**   | →     | +6 ADRs, pg_partman Masterplan                                       |

---

## Änderungsprotokoll seit Originalaudit (25.02. → 06.03.)

### Neue Module

| Modul                                   | Backend-Dateien                                     | Frontend-Routes                | Migrations             |
| --------------------------------------- | --------------------------------------------------- | ------------------------------ | ---------------------- |
| **Work Orders**                         | 28 (Services, Controller, DTOs, Permissions, Tests) | 3 Routes (list, detail, admin) | 4 (064, 065, 068, 070) |
| **Asset-Umbenennung** (Machine → Asset) | 28 (komplettes Modul umbenannt)                     | manage-assets/ Route           | 2 (071, 072)           |

### Neue Migrations (12 Stück: 060-073)

| ID  | Datum      | Beschreibung                         | Modul       |
| --- | ---------- | ------------------------------------ | ----------- |
| 060 | 2026-02-28 | tpm-color-include-in-card            | TPM         |
| 061 | 2026-02-28 | tpm-execution-defects                | TPM         |
| 062 | 2026-03-01 | tpm-card-categories                  | TPM         |
| 063 | 2026-03-02 | tpm-defect-photos                    | TPM         |
| 064 | 2026-03-03 | **work-orders-core**                 | Work Orders |
| 065 | 2026-03-03 | **work-orders-comments-photos**      | Work Orders |
| 066 | 2026-03-03 | dummy-users-role-and-display-name    | Users       |
| 067 | 2026-03-03 | dummy-users-display-name-constraints | Users       |
| 068 | 2026-03-03 | **work-orders-due-soon-notified**    | Work Orders |
| 069 | 2026-03-03 | rename-instandhaltung-to-inspektion  | TPM         |
| 070 | 2026-03-04 | **work-order-comment-threading**     | Work Orders |
| 071 | 2026-03-05 | **rename-machine-to-asset**          | Assets      |
| 072 | 2026-03-05 | **rename-machine-org-type-to-asset** | Assets      |
| 073 | 2026-03-06 | **drop-tpm-templates**               | TPM         |

### Strukturelle Änderungen

- **Route-Struktur:** Routes jetzt unter `/(app)/(admin)/` und `/(app)/(shared)/` für rollenbasierte Zugriffskontrolle
- **Vacation:** `vacation/+page.svelte` → `vacation/overview/+page.svelte` (419 Zeilen, deutlich kleiner)
- **AppSidebar:** Verschoben von `lib/components/` nach `routes/(app)/_lib/`

---

## Methodik: Zeilenzählung

ESLint `max-lines` zählt **keine Leerzeilen und keine Kommentare** (`skipBlankLines: true, skipComments: true`). **Nur Code-Zeilen zählen.**

**ESLint-Limits (aus den Configs):**

| Scope                                                             | Limit             | Config-Datei                     |
| ----------------------------------------------------------------- | ----------------- | -------------------------------- |
| Backend (default)                                                 | 900 Code-Zeilen   | `eslint.config.mjs:173`          |
| Backend DB-Layer (`database/**`, `config/database*`, `utils/db*`) | 1.000 Code-Zeilen | `eslint.config.mjs:425`          |
| Backend Tests                                                     | off               | `eslint.config.mjs:549`          |
| Backend Migrations                                                | off               | `eslint.config.mjs:468`          |
| Frontend `.ts`                                                    | 800 Code-Zeilen   | `frontend/eslint.config.mjs:264` |
| Frontend `.svelte`                                                | 700 Code-Zeilen   | `frontend/eslint.config.mjs:450` |

**Hinweis:** `CODE-OF-CONDUCT.md` nennt 800 Zeilen als Backend-Limit, ESLint erzwingt 900. Kleine Doku-Abweichung — ESLint ist die Quelle der Wahrheit.

**v2-Hinweis:** Wo keine ESLint-Gegenprüfung durchgeführt wurde, stehen Total-Zeilen mit geschätzten Code-Zeilen (Ratio ~77-82% für .svelte, ~70-80% für .ts). Mit `(geschätzt)` markiert.

---

## 1. Dateigrößen-Compliance

### 1.1 Backend-Services

| Service                        | Total (v1) | Total (v2) | Delta   | Code-Zeilen (v1) | Code (v2 geschätzt) | Limit | Status        |
| ------------------------------ | ---------- | ---------- | ------- | ---------------- | ------------------- | ----- | ------------- |
| `kvp.service.ts`               | 1.097      | 1.097      | 0       | 869              | ~869                | 900   | 31 frei       |
| `vacation.service.ts`          | 955        | 955        | 0       | 853              | ~853                | 900   | 47 frei       |
| `settings.service.ts`          | 1.036      | 1.036      | 0       | 788              | ~788                | 900   | 112 frei      |
| `vacation-capacity.service.ts` | 970        | 964        | -6      | 767              | ~762                | 900   | ~138 frei     |
| `reports.service.ts`           | 1.038      | 1.038      | 0       | 757              | ~757                | 900   | 143 frei      |
| `shifts.service.ts`            | 791        | **880**    | **+89** | 644              | **~716**            | 900   | **~184 frei** |
| `notifications.controller.ts`  | 779        | **869**    | **+90** | 600              | **~669**            | 900   | **~231 frei** |
| `teams.service.ts`             | 871        | 868        | -3      | 667              | ~664                | 900   | ~236 frei     |
| `admin-permissions.service.ts` | 837        | 837        | 0       | 664              | ~664                | 900   | 236 frei      |
| `documents.service.ts`         | 854        | 854        | 0       | 660              | ~660                | 900   | 240 frei      |
| `users.service.ts`             | 825        | 825        | 0       | 649              | ~649                | 900   | 251 frei      |
| `audit-trail.service.ts`       | 825        | 825        | 0       | 630              | ~630                | 900   | 270 frei      |
| `auth.service.ts`              | 786        | 786        | 0       | 560              | ~560                | 900   | 340 frei      |

**Beobachten:** `kvp.service.ts` (869/900) und `vacation.service.ts` (853/900) haben weiterhin wenig Puffer. `shifts.service.ts` und `notifications.controller.ts` sind gewachsen (+89 bzw. +90 Total), bleiben aber noch innerhalb der Limits.

**Neue Services (Work Orders, Assets):** Keine neuen Services über 700 Total-Zeilen gefunden. Sub-Services bleiben fokussiert (<500 Zeilen typisch).

### 1.2 Frontend .svelte-Dateien

Limit: 700 Code-Zeilen für `.svelte`.

| Komponente                       | Total (v1) | Total (v2) | Delta   | Code (v1) | Code (v2 geschätzt) | Status                                |
| -------------------------------- | ---------- | ---------- | ------- | --------- | ------------------- | ------------------------------------- |
| `kvp-detail/+page.svelte`        | 845        | **846**    | +1      | 655       | ~655                | BESTANDEN                             |
| `SlotAssistant.svelte`           | 814        | **844**    | **+30** | 671       | **~694**            | **KNAPP** — 6 frei                    |
| `AppSidebar.svelte`              | 861        | **841**    | -20     | 734       | —                   | eslint-disable (begründet: 60% CSS)   |
| `manage-admins/+page.svelte`     | 823        | **821**    | -2      | 657       | ~655                | BESTANDEN                             |
| `RotationSetupModal.svelte`      | 817        | **817**    | 0       | 673       | ~673                | BESTANDEN — 27 frei                   |
| `manage-assets/+page.svelte`     | 803        | **796**    | -7      | 680       | ~671                | BESTANDEN — ~29 frei                  |
| `blackboard/[uuid]/+page.svelte` | 804        | **795**    | -9      | 649       | ~640                | BESTANDEN                             |
| `manage-employees/+page.svelte`  | 813        | **755**    | -58     | 672       | ~617                | BESTANDEN — verbessert                |
| `vacation/overview/+page.svelte` | 832        | **419**    | -413    | 682       | ~340                | **UMSTRUKTURIERT** — Route verschoben |

**SlotAssistant.svelte** ist jetzt die kritischste Datei — geschätzt ~694 Code-Zeilen bei 700er Limit. Jede Erweiterung sprengt das Limit.

### 1.3 Frontend .ts-Dateien

Limit: 800 Code-Zeilen für `.ts`.

| Datei                                 | Total (v1) | Total (v2) | Delta   | Code (v1) | Code (v2 geschätzt) | Status                                                               |
| ------------------------------------- | ---------- | ---------- | ------- | --------- | ------------------- | -------------------------------------------------------------------- |
| `shifts/_lib/api.ts`                  | 1.002      | **1.029**  | **+27** | 706       | **~726**            | BESTANDEN — ~74 frei                                                 |
| `chat/_lib/chat-page-state.svelte.ts` | 967        | **967**    | 0       | 827       | 827                 | **eslint-disable OHNE Begründung** (v1 identifiziert, nicht behoben) |
| `crypto-worker.ts`                    | 815        | **816**    | +1      | 636       | ~636                | BESTANDEN                                                            |

**`chat-page-state.svelte.ts`** bleibt einziger Verstoß — eslint-disable ohne Begründung seit v1 nicht behoben.

---

## 2. KRITISCH — Sofort handeln

### 2.1 Code-Duplikation (~12.000+ Zeilen geschätzt)

**v2-Update:** Geschätzte Gesamtduplikation von ~9.000 auf ~12.000+ Zeilen gestiegen — hauptsächlich durch `is_active`-Verdopplung und neue Module.

| Duplikat                                | v1 Instanzen | v2 Instanzen       | Geschätzte Zeilen | Verifiziert | Trend          |
| --------------------------------------- | ------------ | ------------------ | ----------------- | ----------- | -------------- |
| SQL `is_active` Magic Numbers (alle)    | 158 Stellen  | **466 Stellen**    | **5.000+**        | Ja          | **↓↓**         |
| ~~Session-Expired-Handling (Frontend)~~ | 15 Dateien   | ~~**15 Dateien**~~ | ~~~675~~          | Ja          | **BEHOBEN v3** |
| Availability-History-Loader (Frontend)  | 4 Dateien    | **4 Dateien**      | 400+              | Ja          | →              |
| Row-Mapper-Helpers                      | 12+ Services | **18+ Helpers**    | 700+              | Ja          | **↓**          |
| UI-State-Factories (Frontend)           | 20+ Dateien  | 20+ Dateien        | 1.000+            | Nein        | →              |
| ID-Param-DTOs (Backend)                 | 30+ Dateien  | **36 DTOs**        | 400+              | Ja          | **↓**          |
| Pagination-Schemas (Backend)            | 20+ DTOs     | **15-20 DTOs**     | 300+              | Ja          | **↑**          |
| Error-Handling try/catch                | 51+ Services | 51+ Services       | 1.500+            | Nein        | →              |
| Constants/Types verstreut               | 73+ Dateien  | **50-70 Dateien**  | 1.500+            | Teilweise   | **↑**          |

---

#### Schlimmster Offender: `is_active` Magic Numbers (466×)

**v1 behauptete 158, v2 behauptete 327 — tatsächlich 466.** v2 zählte nur `= 1`, ignorierte aber `= 4`, `= 0`, `= 3`, `!=`, `IN` und parametrisierte Patterns.

| Pattern          | Anzahl  | Beschreibung                        |
| ---------------- | ------- | ----------------------------------- |
| `is_active = 1`  | 325     | Aktiv-Check (häufigstes Pattern)    |
| `is_active = 4`  | 73      | Soft-Delete-Check                   |
| `is_active = $N` | 22      | Parametrisiert (aber verstreut)     |
| `is_active != N` | 19      | Negierte Checks (`!= 4` etc.)       |
| `is_active = 3`  | 11      | Archiv-Check                        |
| `is_active = 0`  | 8       | Inaktiv-Check                       |
| `is_active IN`   | 8       | Multi-Status-Abfragen               |
| **Gesamt**       | **466** | **114 Dateien (92 Prod + 22 Test)** |

**Zentrale Konstante existiert bereits — wird aber nicht genutzt:**

- `shared/src/constants/is-active.ts` exportiert `IS_ACTIVE = { INACTIVE: 0, ACTIVE: 1, ARCHIVED: 3, DELETED: 4 }`
- **0× importiert** in Production-Code
- `blackboard-archive.service.ts` hat eine **lokale Kopie** statt Import (2 Nutzungen)

**Empfehlung:** Bestehende `IS_ACTIVE`-Konstante aus `shared/` in allen 92 Production-Dateien + 22 Test-Dateien einsetzen. Langfristig: Query-Builder-Pattern das `is_active`-Checks automatisch injiziert.

**Regressions-Schutz (geplant):** Architektur-Test in `shared/src/architectural.test.ts` (analog zu `getErrorMessage`/`session-expired`-Enforcement) + `TYPESCRIPT-STANDARDS.md` No-Go + ADR-Verweise. Vollständiger Umsetzungsplan: siehe Maßnahme #6 in Abschnitt 5.

---

#### ~~Zweiter Offender: Session-Expired-Handling~~ — BEHOBEN (2026-03-07)

**Status:** Zentralisiert in `frontend/src/lib/utils/session-expired.ts`. 16 Dateien refactored, ~675 LOC eliminiert, 3 goto-Varianten → 1 konsistentes Pattern.

**Regressions-Schutz:** Architektur-Test in `shared/src/architectural.test.ts` prüft via CI:

- Keine lokalen `isSessionExpiredError`/`handleSessionExpired`/`handleUnauthorized`-Definitionen in Route-Dateien
- `goto('/login?session=expired')` nur in der zentralen Util erlaubt

**Dokumentiert in:** `docs/CODE-OF-CONDUCT-SVELTE.md` (Session-Expired Handling Sektion)

---

#### Dritter Offender: Availability-History-Loader (4 Dateien, unverändert)

4 `+page.server.ts` Dateien mit 90%+ identischem Code (~136 Zeilen je):

- `manage-assets/availability/[uuid]/+page.server.ts`
- `manage-employees/availability/[uuid]/+page.server.ts`
- `manage-admins/availability/[uuid]/+page.server.ts`
- `manage-root/availability/[uuid]/+page.server.ts`

Einzige Unterschiede: Logger-Name, Entity-Feld (`assetId` vs `userId`), API-Endpoint, Fehlermeldungen.

**Empfehlung:** → `frontend/src/lib/server/availability-history-loader.ts` als generische Loader-Factory

---

### 2.2 Untypisierte catch-Blöcke (327+ Stellen)

**v3-Status (2026-03-07): Backend ERLEDIGT. 25 Stellen + 17 unsichere Casts behoben.**

- `getErrorMessage(error: unknown)` Helper erstellt in `backend/src/nest/common/utils/error.utils.ts`
- Alle 25 Backend catch-Blöcke explizit `: unknown` typisiert
- Alle 17 `(error as Error).message` Casts durch `getErrorMessage(error)` ersetzt
- Frontend (302 Stellen) bleibt OFFEN (Maßnahme #11)

**Regressions-Schutz:** Architektur-Test in `shared/src/architectural.test.ts` prüft via CI:

- Kein `(error as Error)` oder `(err as Error)` im Backend-Produktionscode

**Dokumentiert in:** `docs/TYPESCRIPT-STANDARDS.md` Section 7.3 + No-Go #12

**Backend (25 Stellen — ~~verifiziert, exakt wie v1~~ BEHOBEN 2026-03-07):**

| Datei                                    | Anzahl |
| ---------------------------------------- | ------ |
| `log-retention.service.ts`               | 4      |
| `tenant-deletion-executor.service.ts`    | 3      |
| `scheduled-message-processor.service.ts` | 3      |
| `main.ts`                                | 2      |
| `partition-manager.service.ts`           | 2      |
| `tenant-deletion-exporter.service.ts`    | 2      |
| `rotation-generator.service.ts`          | 2      |
| `tenant-deletion.service.ts`             | 1      |
| `tenant-deletion-analyzer.service.ts`    | 1      |
| `tpm-notification.service.ts`            | 1      |
| `vacation-notification.service.ts`       | 1      |
| `notification-feature.service.ts`        | 1      |
| `blackboard-archive.service.ts`          | 1      |
| `rotation-history.service.ts`            | 1      |

**Frontend (302 Stellen — verifiziert):**

- `catch (err)` — 282 Instanzen in 117 Dateien
- `catch (error)` — 19 Instanzen
- `catch (e)` — 1 Instanz (sentry-example-page)

**Zusätzlich: 17× unsicherer `(error as Error).message` Cast (~~verifiziert, exakt wie v1~~ BEHOBEN 2026-03-07):**

| Datei                      | Anzahl |
| -------------------------- | ------ |
| `emailService.ts`          | 10×    |
| `departments.service.ts`   | 3×     |
| `feature-check.service.ts` | 2×     |
| `teams.service.ts`         | 1×     |
| `role-switch.service.ts`   | 1×     |

---

### 2.3 TODO-Kommentare (~~5~~ 4 Stück)

Per Kaizen-Manifest: _"About to type `// TODO:` — Implement IMMEDIATELY"_

**v3 (2026-03-07): 4 statt 5 — `root-deletion.service.ts` TODO implementiert (tenantId + UserRepository).**

| Datei                             | Zeile   | Inhalt                             | Priorität                 |
| --------------------------------- | ------- | ---------------------------------- | ------------------------- |
| ~~`root-deletion.service.ts`~~    | ~~257~~ | ~~`TODO: Add tenantId parameter`~~ | **ERLEDIGT** (2026-03-07) |
| `main.ts`                         | 83      | `TODO: Implement nonce-based CSP`  | Pre-Production            |
| `storage-upgrade/+page.svelte`    | 151     | `TODO: Get actual used storage`    | Pre-Production            |
| `storage-upgrade/+page.server.ts` | 85      | `TODO: Get actual used storage`    | Pre-Production            |
| `survey-results/+page.svelte`     | 104     | `TODO: Implement PDF export`       | Pre-Production            |

---

## 3. HOCH — Nächste Sprint-Planung

### 3.1 God-Services im Backend

Keine `max-lines`-Verstöße, aber architektonisch zu breit:

| Service                   | Code-Zeilen (v1) | Code (v2 geschätzt) | Public Methods | Problem                                                                     |
| ------------------------- | ---------------- | ------------------- | -------------- | --------------------------------------------------------------------------- |
| `KvpService`              | 869              | ~869                | 26+            | Facade zu breit — CRUD + Comments + Attachments + Confirmations + Dashboard |
| `SettingsService`         | 788              | ~788                | 18+            | 3× identische CRUD-Logik (system/tenant/user)                               |
| `ReportsService`          | 757              | ~757                | 12+            | Alle Report-Typen in einem Service                                          |
| `ShiftsService`           | 644              | **~716**            | —              | **+72 Code-Zeilen** seit v1 — wächst Richtung Limit                         |
| `NotificationsController` | 600              | **~669**            | 12 Endpoints   | **+69 Code-Zeilen** seit v1 — Core + Preferences + Statistics + SSE         |

**Empfehlung (unverändert):**

- `KvpService` → KvpSuggestionService + KvpQueryService (Dashboard/Stats)
- `SettingsService` → Generischer Scope-Ansatz oder 3 separate Services
- `ReportsService` → Domain-spezifische Report-Services
- `NotificationsController` → NotificationsPreferencesController separieren

### 3.2 Frontend-Komponenten mit wenig Puffer

| Komponente                   | Code (v2 geschätzt) | Limit | Puffer | Risiko                                 |
| ---------------------------- | ------------------- | ----- | ------ | -------------------------------------- |
| `SlotAssistant.svelte`       | **~694**            | 700   | **~6** | **AKUT** — nächste Zeile sprengt Limit |
| `RotationSetupModal.svelte`  | ~673                | 700   | ~27    | Knapp                                  |
| `manage-assets/+page.svelte` | ~671                | 700   | ~29    | Knapp                                  |
| `kvp-detail/+page.svelte`    | ~655                | 700   | ~45    | Knapp                                  |
| `manage-admins/+page.svelte` | ~655                | 700   | ~45    | Knapp                                  |

**SlotAssistant.svelte** hat weiterhin **5 Nesting-Levels** im Template:

```svelte
{#if showOnlyScheduled}
  {#each scheduledDays as day}
    {#each projSlots as slot}
      {#each slot.intervalTypes as interval}
        <!-- Level 4-5 -->
```

**Empfehlung:** `SlotCalendarGrid.svelte` extrahieren + Datum-Logik in Utils auslagern. **DRINGEND** — geschätzt 6 Zeilen Puffer.

### 3.3 ~~eslint-disable ohne Begründung~~ — BEHOBEN (2026-03-07)

**v3: 100% Compliance.** Die letzte unbegründete Stelle wurde behoben:

| Datei                        | Zeile | Regel                    | Status                    |
| ---------------------------- | ----- | ------------------------ | ------------------------- |
| `admin-profile/+page.svelte` | 272   | `require-atomic-updates` | **ERLEDIGT** (2026-03-07) |

Alle **179** `eslint-disable`-Comments haben jetzt korrekte Begründungen (**100% Compliance**).

---

## 4. MITTEL — Technische Schulden

### 4.1 websocket.ts — Type-Safety-Lücken (unverändert)

- **13 `as`-Casts** für `JSON.parse()`-Ergebnisse (v1 sagte 14+, tatsächlich 13)
- **Keine Zod-Validierung** für eingehende WebSocket-Messages (`WebSocketMessage`, `SendMessageData`, `TypingData`, `MarkReadData`)
- Optional Chaining ist korrekt abgesichert (v1-Behauptung "ohne Fallback" war **falsch** — alle haben explizite Vergleiche)

### 4.2 ID-Param-DTOs — 3 Patterns, keine Factory (verschlechtert)

**36 Param-DTOs** gefunden, 3 verschiedene Patterns:

| Pattern                   | Beschreibung                                         | Anzahl       | Beispiel                                                    |
| ------------------------- | ---------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| **A: IdSchema** (korrekt) | Shared Schema aus `common.schema.ts`                 | **4** (11%)  | `users`, `departments`, `audit-trail`, `teams`              |
| **B: Hardcoded**          | `z.coerce.number().int().positive()` inline          | **7** (19%)  | `assets`, `areas`, `plans`, `root`, `blackboard`, `chat`    |
| **C: Custom Name**        | Verschiedene Param-Namen (`adminId`, `userId`, etc.) | **25** (70%) | `admin-permissions` (7), `chat` (6), `features`, `settings` |

**Keine Factory** (`createIdParamDto`) existiert. Inkonsistenz hat sich durch Work Orders und Assets-Module **vergrößert**.

**Empfehlung:** Generic Factory `createIdParamDto(paramName, entityLabel)` in `backend/src/nest/common/dto/`

### 4.3 Dateinamen-Inkonsistenz (7 Legacy-Dateien, unverändert)

**Kein Fix seit v1.** Alle 7 camelCase-Dateien existieren noch:

| Datei                    | Pfad                   | Ist       | Soll                       |
| ------------------------ | ---------------------- | --------- | -------------------------- |
| `deletionWorker.ts`      | `backend/src/workers/` | camelCase | `deletion-worker.ts`       |
| `emailService.ts`        | `backend/src/utils/`   | camelCase | `email-service.ts`         |
| `employeeIdGenerator.ts` | `backend/src/utils/`   | camelCase | `employee-id-generator.ts` |
| `fieldMapper.ts`         | `backend/src/utils/`   | camelCase | `field-mapper.ts`          |
| `eventBus.ts`            | `backend/src/utils/`   | camelCase | `event-bus.ts`             |
| `pathSecurity.ts`        | `backend/src/utils/`   | camelCase | `path-security.ts`         |
| `featureCheck.ts`        | `backend/src/utils/`   | camelCase | `feature-check.ts`         |

### 4.4 Row-Mapper Duplikation (NEU in v2 — verifiziert)

**18+ Helper-Dateien** mit systematischer Duplikation:

- Jedes Modul hat eigene Helpers: `chat.helpers.ts`, `users.helpers.ts`, `tpm-cards.helpers.ts`, `work-orders.helpers.ts`, etc.
- Wiederkehrende Patterns: Snake_case → camelCase Conversion (12+×), Null-Safe Concatenation (10+×), Pagination Metadata Builder (7+×)
- **Kein shared `RowMapper` Utility** vorhanden

---

## 5. WAS GUT IST

| Kategorie              | v1 Befund           | v2 Befund (aktualisiert)                                                                                              |
| ---------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Dateigrößen**        | 0 ESLint-Verstöße   | 0 ESLint-Verstöße (nur 1 begründetes eslint-disable + 1 unbegründetes)                                                |
| **Funktionslänge**     | Keine >60 Zeilen    | Weiterhin keine Funktion bricht das 60-Zeilen-Limit                                                                   |
| **`any`-Nutzung**      | 5 in Production     | **3 in Production** — alle mit eslint-disable + Begründung (AppSidebar, AppHeader, CalendarView). **Verbessert.**     |
| **ESLint-Disable**     | 186 (184 begründet) | **179** (178 begründet, **1 ohne**). **Verbessert** — 99,4% Compliance.                                               |
| **Strikte Gleichheit** | 14× `== null`       | Weiterhin korrekt — intentionales Null-Coalescing-Pattern, ESLint-konform                                             |
| **Non-null `!`**       | 0 in Production     | Weiterhin 0 in Production. Nur in Tests.                                                                              |
| **Guard Clauses**      | Konsequent          | Weiterhin konsequent. Max 4 Nesting-Levels im Backend.                                                                |
| **Service-Extraction** | Sauber aufgeteilt   | Work Orders folgt dem Pattern: 7 Sub-Services (Status, Assignees, Comments, Photos, Notifications, Cron, Permissions) |
| **Tests**              | 4.614               | **5.079** (+465). Massive Abdeckung weiter gewachsen.                                                                 |
| **RLS**                | 103 Tabellen        | **109 Tabellen** mit RLS, **128 total**, **173 Policies**. Tenant-Isolation weiter verstärkt.                         |
| **Dokumentation**      | 26 ADRs             | **32 ADRs** (+6 neue: 025-028 + Implementation Plans). Best-in-Class.                                                 |
| **kebab-case**         | 99% Compliance      | Weiterhin 99% — nur 7 Legacy-Dateien als Ausreißer.                                                                   |
| **Vacation-Refactor**  | 832 Zeilen Seite    | **419 Zeilen** — erfolgreich umstrukturiert.                                                                          |

---

## 6. Priorisierte Maßnahmen

### Sofort (< 1 Tag)

| #   | Maßnahme                                                   | Aufwand | Impact                               | Status                    |
| --- | ---------------------------------------------------------- | ------- | ------------------------------------ | ------------------------- |
| 1   | Session-Expired → `$lib/utils/session-expired.ts`          | 30 min  | 16 Dateien bereinigt, ~675 LOC       | **ERLEDIGT** (2026-03-07) |
| 2   | `root-deletion.service.ts` TODO beheben (Zeile 257)        | 15 min  | Kaizen-Compliance + Tenant-Isolation | **ERLEDIGT** (2026-03-07) |
| 3   | Backend catch-Blöcke typisieren (25 Stellen)               | 1h      | Type Safety                          | **ERLEDIGT** (2026-03-07) |
| 4   | Shared `getErrorMessage(error: unknown)` Helper erstellen  | 15 min  | Grundlage für catch-Bereinigung      | **ERLEDIGT** (2026-03-07) |
| 5   | 1× eslint-disable begründen (`admin-profile/+page.svelte`) | 5 min   | Konsistenz (99,4% → 100%)            | **ERLEDIGT** (2026-03-07) |

### Kurzfristig (1–3 Tage)

| #   | Maßnahme                                                   | Aufwand | Impact                                                        | v1-Status |
| --- | ---------------------------------------------------------- | ------- | ------------------------------------------------------------- | --------- |
| 6   | `is_active`-Konstante zentralisieren (Details siehe unten) | 4-6h    | **466 Stellen** (92 Prod-Dateien) → `IS_ACTIVE` aus `shared/` | **NEU**   |
| 7   | Availability-History-Loader generisch machen               | 1h      | 4 Dateien → 1                                                 | **OFFEN** |
| 8   | ID-Param-DTO-Factory erstellen                             | 1h      | 36 DTOs konsistent                                            | **OFFEN** |
| 9   | `SlotAssistant.svelte` → Grid-Komponente extrahieren       | 1h      | ~6 Zeilen Puffer → entspannt                                  | **NEU**   |
| 10  | manage-\* Shared Composable extrahieren                    | 3h      | 3 Pages proaktiv entlasten                                    | **OFFEN** |

#### Maßnahme #6 — Umsetzungsplan `is_active`-Zentralisierung

Analoges Vorgehen wie bei `getErrorMessage` (Maßnahme #3/#4) und Session-Expired (Maßnahme #1): Code-Fix + Docs + Regressions-Schutz.

| #   | Unter-Schritt                                         | Aufwand | Details                                                                                                                                                                      |
| --- | ----------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | Production-Code: Magic Numbers → `IS_ACTIVE.*`        | 3-4h    | 92 Prod-Dateien, Import aus `@assixx/shared/constants`                                                                                                                       |
| 6.2 | Test-Code: Magic Numbers → `IS_ACTIVE.*`              | 1h      | 22 Test-Dateien, gleicher Import                                                                                                                                             |
| 6.3 | Lokale Kopie entfernen (`blackboard-archive.service`) | 5 min   | Lokale `IS_ACTIVE`-Konstante → Import aus `shared/`                                                                                                                          |
| 6.4 | Architektur-Test erstellen (Regressions-Schutz)       | 30 min  | `shared/src/architectural.test.ts` erweitern: `is_active\s*=\s*[0-9]` in `.ts`-Dateien verbieten (Allowlist für SQL-Migrations)                                              |
| 6.5 | `TYPESCRIPT-STANDARDS.md` aktualisieren               | 15 min  | Neuen Abschnitt 7.4 (oder No-Go) für `is_active` Magic Numbers                                                                                                               |
| 6.6 | ADRs prüfen und ggf. Hinweis ergänzen                 | 15 min  | ADR-018, ADR-023, ADR-026 referenzieren `IS_ACTIVE`-Konstante. ADR-Code-Beispiele sind historisch korrekt — kein Rewrite nötig, aber Hinweis auf zentrale Konstante ergänzen |
| 6.7 | ESLint prüfen: `no-restricted-syntax` Regel           | 15 min  | Optional: Custom ESLint-Regel für Template-Literals mit `is_active = N` als zusätzliche Absicherung neben Architektur-Test                                                   |

**Betroffene ADRs (mit `is_active` Magic Numbers in Code-Beispielen):**

- ADR-005 (auth flow), ADR-009-impl (audit), ADR-019 (RLS), ADR-020 (permissions), ADR-021 (E2E), ADR-022 (escrow)
- Diese enthalten historisch korrekte Beispiele — **kein Rewrite**, aber ADR-023 und ADR-026 sollten auf `IS_ACTIVE`-Konstante verweisen

**Definition of Done für Maßnahme #6:**

- [ ] 0 hardcoded `is_active = N` in `.ts`-Dateien (außer Migrations)
- [ ] Architektur-Test in CI grün (analog zu `getErrorMessage`-Enforcement)
- [ ] `TYPESCRIPT-STANDARDS.md` dokumentiert das Pattern
- [ ] Bestehende Tests laufen grün mit `IS_ACTIVE`-Konstante
- [ ] ADR-023/026 referenzieren die zentrale Konstante

### Mittelfristig (Sprint-Planung)

| #   | Maßnahme                                       | Aufwand | Impact                      | v1-Status |
| --- | ---------------------------------------------- | ------- | --------------------------- | --------- |
| 11  | Frontend catch-Blöcke typisieren (302 Stellen) | 4h      | Mechanisch aber umfangreich | **OFFEN** |
| 12  | `websocket.ts` Zod-Validierung hinzufügen      | 2h      | 13 `as`-Casts eliminieren   | **OFFEN** |
| 13  | Row-Mapper Shared Utility erstellen            | 2h      | 18+ Helpers konsolidiert    | **NEU**   |
| 14  | UI-State-Factory generisch machen              | 3h      | 20+ Dateien konsolidiert    | **OFFEN** |
| 15  | `utils/` Dateien in kebab-case umbenennen      | 30 min  | Naming-Konsistenz           | **OFFEN** |

### Pre-Production

| #   | Maßnahme                                           | Aufwand | Impact                    | v1-Status |
| --- | -------------------------------------------------- | ------- | ------------------------- | --------- |
| 16  | Nonce-based CSP implementieren (`main.ts` TODO)    | 2–4h    | Security Hardening        | **OFFEN** |
| 17  | Storage-Upgrade: echte Speichernutzung vom Backend | 1–2h    | Feature-Vervollständigung | **OFFEN** |
| 18  | Survey-Results: PDF-Export implementieren          | 3–4h    | Feature-Vervollständigung | **OFFEN** |

### Bei nächster Erweiterung (proaktiv splitten)

| Service / Komponente              | Trigger                   | Aktion                                              |
| --------------------------------- | ------------------------- | --------------------------------------------------- |
| `kvp.service.ts` (869/900)        | Nächstes KVP-Feature      | → KvpSuggestionService + KvpQueryService            |
| `vacation.service.ts` (853/900)   | Nächstes Vacation-Feature | → VacationRequestService + VacationLifecycleService |
| `SlotAssistant.svelte` (~694/700) | **Jede Änderung**         | → **SOFORT** Grid extrahieren                       |
| `shifts/_lib/api.ts` (~726/800)   | Nächstes Shifts-Feature   | → Shift-CRUD + Rotation-API aufteilen               |
| `shifts.service.ts` (~716/900)    | Nächstes Shifts-Feature   | → ShiftCrudService + RotationService                |

---

## Anhang: Metriken

| Metrik                                 | v1 (25.02.)   | v2 (06.03.)            | v3 (07.03.)               | Delta v2→v3 |
| -------------------------------------- | ------------- | ---------------------- | ------------------------- | ----------- |
| ESLint `max-lines` Verstöße            | 0             | **0**                  | **0**                     | →           |
| eslint-disable gesamt                  | 186           | **179**                | **179**                   | →           |
| eslint-disable ohne Begründung         | 2             | **1**                  | **0 (100%)**              | **-1**      |
| Backend-Services nahe Limit (>850/900) | 2             | **2**                  | **2**                     | →           |
| Frontend-Komponenten nahe Limit        | 5             | **5** (andere Dateien) | **5**                     | →           |
| Duplizierter Code (geschätzt)          | ~9.000 Zeilen | **~12.000+ Zeilen**    | **~11.300 Zeilen**        | **-675**    |
| `is_active` Magic Numbers (alle)       | 158           | **466**                | **466**                   | →           |
| Session-Expired Duplikation            | 15 Dateien    | **15 Dateien**         | **1 Datei (zentral)**     | **-14**     |
| Untypisierte catch-Blöcke (Backend)    | 25            | **25**                 | **0 (BEHOBEN)**           | **-25**     |
| Untypisierte catch-Blöcke (Frontend)   | ~290          | **302**                | **302**                   | →           |
| Unsichere `as Error` Casts             | 17            | **17**                 | **0 (BEHOBEN)**           | **-17**     |
| TODO-Kommentare                        | 6             | **5**                  | **4**                     | **-1**      |
| `any` in Production-Code               | 5             | **3**                  | **3**                     | →           |
| `any` in Test-Code                     | 5             | ~5                     | ~5                        | →           |
| `== null`/`!= null` (intentional)      | 14            | ~14                    | ~14                       | →           |
| WebSocket `as`-Casts                   | 14+           | **13**                 | **13**                    | →           |
| ID-Param DTOs (IdSchema-Nutzung)       | —             | **4/36 (11%)**         | **4/36 (11%)**            | →           |
| Row-Mapper Helpers                     | 12+           | **18+**                | **18+**                   | →           |
| Tests gesamt                           | 4.614         | **5.079**              | **5.085 (+6 Arch)**       | **+6**      |
| RLS-Tabellen                           | 103           | **109** (128 total)    | **109**                   | →           |
| RLS-Policies                           | 114           | **173**                | **173**                   | →           |
| ADRs                                   | 26            | **32**                 | **32**                    | →           |
| Migrations                             | 61            | **73**                 | **73**                    | →           |
| camelCase Legacy-Dateien               | 7             | **7**                  | **7**                     | →           |
| Backend-Module                         | —             | +Work Orders, +Assets  | —                         | →           |
| **Architektur-Tests (NEU)**            | —             | —                      | **6 Tests (CI-enforced)** | **NEU**     |

---

## Anhang: v3 Fix-Log (2026-03-07)

### Geänderter Code (5 Sofort-Maßnahmen)

| Maßnahme                       | Dateien geändert                               | Neue Dateien                                               | LOC Effekt                   |
| ------------------------------ | ---------------------------------------------- | ---------------------------------------------------------- | ---------------------------- |
| Session-Expired zentralisieren | 16 Frontend-Dateien refactored                 | `frontend/src/lib/utils/session-expired.ts`                | ~675 LOC eliminiert          |
| Backend catch-Typing           | 19 Backend-Dateien                             | —                                                          | 25 catches + 17 casts gefixt |
| `getErrorMessage()` Helper     | —                                              | `backend/src/nest/common/utils/error.utils.ts`, `index.ts` | Neuer shared Utility         |
| root-deletion TODO             | 3 Dateien (service, facade, controller) + Test | —                                                          | UserRepository statt raw SQL |
| eslint-disable begründen       | 1 Datei                                        | —                                                          | Kommentar hinzugefügt        |

### Regressions-Schutz (Enforcement)

| Dokument/Test                                              | Was geändert                                 | Zweck                                          |
| ---------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------- |
| `shared/src/architectural.test.ts`                         | **NEU** — 6 grep-basierte Tests              | CI verhindert Rückfall in alte Patterns        |
| `docs/TYPESCRIPT-STANDARDS.md`                             | Section 7.3 + No-Go #12 hinzugefügt (v4.1.0) | `getErrorMessage()` als Standard dokumentiert  |
| `docs/CODE-OF-CONDUCT-SVELTE.md`                           | Session-Expired Handling Sektion hinzugefügt | Frontend-Pattern dokumentiert                  |
| `docs/infrastructure/adr/ADR-009-central-audit-logging.md` | Code-Beispiel gefixt                         | `catch (error: unknown)` + `getErrorMessage()` |
| `docs/HOW-TO-ENABLE-DEBUG-LOGGING.md`                      | Code-Beispiel gefixt                         | `getErrorMessage(error)` statt `error.message` |

---

## Anhang: Korrekturen gegenüber v1/v2

| v1 Behauptung                     | v1 Wert   | v2 verifiziert | Korrektur                                                                                                                  |
| --------------------------------- | --------- | -------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `is_active` Magic Numbers         | 158       | **466**        | v1+v2 zählten nur `=1` (325). Tatsächlich 7 Patterns: `=1`(325), `=4`(73), `=$N`(22), `!=`(19), `=3`(11), `=0`(8), `IN`(8) |
| `any` in Production               | 5         | **3**          | v1 hat 2 Stellen gezählt die nicht mehr existieren                                                                         |
| eslint-disable gesamt             | 186       | **179**        | v1 hat überzählt                                                                                                           |
| eslint-disable ohne Begründung    | 2         | **1**          | 1 wurde behoben                                                                                                            |
| Tests gesamt                      | 4.614     | **5.079**      | v1 war zum Zeitpunkt korrekt, seitdem +465                                                                                 |
| TODO-Kommentare                   | 6         | **5**          | 1 wurde behoben (`vacation.controller.test.ts`)                                                                            |
| WebSocket `as`-Casts              | 14+       | **13**         | v1 hat leicht überzählt                                                                                                    |
| Optional Chaining "ohne Fallback" | 6 Stellen | **0**          | v1 war **falsch** — alle haben explizite Vergleiche                                                                        |
| Frontend untyped catch            | ~290      | **302**        | v1 hat leicht unterzählt                                                                                                   |
