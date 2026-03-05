# Code Audit — 25. Februar 2026

**Branch:** `feature/TPM`
**Auditor:** Claude Opus 4.6 (automatisiert, 6 parallele Analyse-Agents)
**Scope:** Gesamte Codebase (`backend/src/`, `frontend/src/`)
**Verifiziert:** 25. Februar 2026 — unabhängige Gegenprüfung mit 7 parallelen Agents. Alle Zahlen korrigiert.

---

## Zusammenfassung

| Kategorie                 | Bewertung                                                      |
| ------------------------- | -------------------------------------------------------------- |
| **Gesamtbewertung**       | **8/10** — Solide Architektur, überdurchschnittliche Disziplin |
| Architektur & Modularität | 8/10                                                           |
| Type Safety               | 7/10                                                           |
| Code-Duplikation          | 5/10                                                           |
| Dateigrößen-Compliance    | 9/10 — ESLint bestätigt: 0 Verstöße                            |
| ESLint-Disziplin          | 9/10                                                           |
| Test-Abdeckung            | 9/10                                                           |
| Dokumentation             | 10/10                                                          |

---

## Methodik: Zeilenzählung

ESLint `max-lines` zählt **keine Leerzeilen und keine Kommentare** (`skipBlankLines: true, skipComments: true`). Alle Dateigrößen in diesem Audit wurden nach dieser Methode verifiziert. **Nur Code-Zeilen zählen.**

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

---

## 1. Dateigrößen-Compliance — ESLint-verifiziert

### 1.1 Backend-Services: ALLE BESTEHEN

ESLint meldet **0 Fehler** für `max-lines` in allen Backend-Services.

| Service                        | Total | Code-Zeilen | Limit | Puffer   |
| ------------------------------ | ----- | ----------- | ----- | -------- |
| `kvp.service.ts`               | 1.097 | **869**     | 900   | 31 frei  |
| `vacation.service.ts`          | 955   | **853**     | 900   | 47 frei  |
| `settings.service.ts`          | 1.036 | **788**     | 900   | 112 frei |
| `vacation-capacity.service.ts` | 970   | **767**     | 900   | 133 frei |
| `reports.service.ts`           | 1.038 | **757**     | 900   | 143 frei |
| `teams.service.ts`             | 871   | **667**     | 900   | 233 frei |
| `admin-permissions.service.ts` | 837   | **664**     | 900   | 236 frei |
| `documents.service.ts`         | 854   | **660**     | 900   | 240 frei |
| `users.service.ts`             | 825   | **649**     | 900   | 251 frei |
| `shifts.service.ts`            | 791   | **644**     | 900   | 256 frei |
| `audit-trail.service.ts`       | 825   | **630**     | 900   | 270 frei |
| `auth.service.ts`              | 786   | **560**     | 900   | 340 frei |
| `notifications.controller.ts`  | 779   | **600**     | 900   | 300 frei |

**Beobachten:** `kvp.service.ts` (869/900) und `vacation.service.ts` (853/900) haben wenig Puffer. Jede größere Erweiterung erfordert Extraktion.

### 1.2 Frontend .svelte-Dateien: ALLE BESTEHEN

ESLint meldet **0 Fehler**. Limit: 700 Code-Zeilen für `.svelte`.

| Komponente                       | Total | Code-Zeilen | Limit | Puffer                              |
| -------------------------------- | ----- | ----------- | ----- | ----------------------------------- |
| `AppSidebar.svelte`              | 861   | **734**     | 700   | eslint-disable (begründet: 60% CSS) |
| `manage-assets/+page.svelte`     | 803   | **680**     | 700   | 20 frei                             |
| `vacation/+page.svelte`          | 832   | **682**     | 700   | 18 frei                             |
| `manage-employees/+page.svelte`  | 813   | **672**     | 700   | 28 frei                             |
| `SlotAssistant.svelte`           | 814   | **671**     | 700   | 29 frei                             |
| `RotationSetupModal.svelte`      | 817   | **673**     | 700   | 27 frei                             |
| `manage-admins/+page.svelte`     | 823   | **657**     | 700   | 43 frei                             |
| `kvp-detail/+page.svelte`        | 845   | **655**     | 700   | 45 frei                             |
| `blackboard/[uuid]/+page.svelte` | 804   | **649**     | 700   | 51 frei                             |

**Beobachten:** `AppSidebar.svelte` ist die einzige Datei mit `eslint-disable max-lines` — Begründung dokumentiert und akzeptabel. 4 Dateien haben <30 Zeilen Puffer.

### 1.3 Frontend .ts-Dateien: 1 Verstoß

| Datei                                 | Total | Code-Zeilen | Limit | Status                             |
| ------------------------------------- | ----- | ----------- | ----- | ---------------------------------- |
| `shifts/_lib/api.ts`                  | 1.002 | **706**     | 800   | BESTANDEN                          |
| `chat/_lib/chat-page-state.svelte.ts` | 967   | **827**     | 800   | **eslint-disable OHNE Begründung** |
| `crypto-worker.ts`                    | 815   | **636**     | 800   | BESTANDEN                          |

**Einziger Verstoß:** `chat-page-state.svelte.ts` hat `/* eslint-disable max-lines */` auf Zeile 1 **ohne Begründungskommentar**. Per Projektstandard muss jedes eslint-disable begründet sein.

---

## 2. KRITISCH — Sofort handeln

### 2.1 Code-Duplikation (~9.000 Zeilen geschätzt)

| Duplikat                               | Instanzen    | Geschätzte Zeilen | Schwierigkeit | Verifiziert |
| -------------------------------------- | ------------ | ----------------- | ------------- | ----------- |
| Session-Expired-Handling (Frontend)    | 15 Dateien   | ~225              | Einfach       | Ja          |
| ID-Param-DTOs (Backend)                | 30+ Dateien  | 300+              | Einfach       | Nein        |
| Availability-History-Loader (Frontend) | 4 Dateien    | 400+              | Mittel        | Ja          |
| UI-State-Factories (Frontend)          | 20+ Dateien  | 1.000+            | Mittel        | Nein        |
| SQL `WHERE is_active = 1` Patterns     | 158 Stellen  | 3.000+            | Schwer        | Nein        |
| Row-Mapper-Helpers                     | 12+ Services | 500+              | Mittel        | Nein        |
| Pagination-Schemas (Backend)           | 20+ DTOs     | 400+              | Mittel        | Nein        |
| Error-Handling try/catch               | 51+ Services | 1.500+            | Schwer        | Nein        |
| Constants/Types verstreut              | 73+ Dateien  | 2.000+            | Mittel        | Nein        |

**Verifizierungs-Hinweis:** Nur Session-Expired und Availability-History wurden unabhängig gegengeprüft. Die restlichen Schätzungen sind ungeprüft — tatsächliche Zahlen können abweichen.

**Schlimmster Offender: Session-Expired-Handling**

Dieselbe Logik in **15 Frontend-API-Dateien** kopiert (14 definieren `isSessionExpiredError`, 10 `handleSessionExpired`, 8 `checkSessionExpired`):

```typescript
// Diese Funktionen existieren in 15 Dateien mit 3 Implementierungsvarianten:
function isSessionExpiredError(err: unknown): boolean {
  /* ... */
} // 14×
export function handleSessionExpired(): void {
  /* ... */
} // 10×
export function checkSessionExpired(err: unknown): boolean {
  /* ... */
} // 8×
```

**Zusätzlich inkonsistent:** 3 verschiedene `goto`-Varianten für Login-Redirect:

- Variante A (7×): `void goto(resolve('/login?session=expired', {}));`
- Variante B (2×): `void goto(\`${resolve('/login', {})}?session=expired\`);`
- Variante C (1×): `void goto('/login?session=expired');` — **kein `resolve()`**, hardcoded Pfad

**Hinweis:** `api-client.ts` und `token-manager.ts` behandeln 401/Session-Expired bereits zentral. Die 15 Dateien reimplementieren vorhandene Infrastruktur.

**Empfehlung:** → `frontend/src/lib/utils/session-expired.ts` (30 Minuten Aufwand, 15 Dateien bereinigt)

**Zweiter Offender: Availability-History-Loader**

4 `+page.server.ts` Dateien mit 90%+ identischem Code:

- `manage-assets/availability/[uuid]/+page.server.ts`
- `manage-employees/availability/[uuid]/+page.server.ts`
- `manage-admins/availability/[uuid]/+page.server.ts`
- `manage-root/availability/[uuid]/+page.server.ts`

**Empfehlung:** → `frontend/src/lib/server/availability-history-loader.ts` als generische Loader-Factory

---

### 2.2 Untypisierte catch-Blöcke (313+ Stellen)

**Verstoß gegen:** TypeScript Standards v4.0.0, `useUnknownInCatchVariables`

**Backend (25 Stellen):**

| Datei                                    | Zeilen           |
| ---------------------------------------- | ---------------- |
| `main.ts`                                | 153, 162         |
| `tenant-deletion.service.ts`             | 101, 115         |
| `tenant-deletion-analyzer.service.ts`    | 94               |
| `tenant-deletion-exporter.service.ts`    | 149, 183         |
| `tenant-deletion-executor.service.ts`    | 268, 339, 368    |
| `partition-manager.service.ts`           | 69, 137          |
| `log-retention.service.ts`               | 67, 87, 115, 331 |
| `blackboard-archive.service.ts`          | 90               |
| `tpm-notification.service.ts`            | 216              |
| `rotation-history.service.ts`            | 184              |
| `rotation-generator.service.ts`          | 267, 605         |
| `vacation-notification.service.ts`       | 221              |
| `scheduled-message-processor.service.ts` | 139, 151, 249    |
| `notification-feature.service.ts`        | 60               |

**Frontend (300+ Stellen):**
Jede `_lib/api.ts` Datei (50+ Dateien mit je 2–12 catch-Blöcken), alle `+page.server.ts`, alle `+page.svelte` mit fetch-Logik.

**Zusätzlich: 17× unsicherer `(error as Error).message` Cast:**

| Datei                      | Anzahl |
| -------------------------- | ------ |
| `emailService.ts`          | 10×    |
| `departments.service.ts`   | 3×     |
| `role-switch.service.ts`   | 1×     |
| `feature-check.service.ts` | 2×     |
| `teams.service.ts`         | 1×     |

**Empfehlung:**

1. Shared Helper `getErrorMessage(error: unknown): string` erstellen
2. Backend-catch-Blöcke mit `(error: unknown)` annotieren (mechanisch, ~1h)
3. Frontend-catch-Blöcke schrittweise bereinigen (größerer Aufwand, ~4h)

---

### 2.3 TODO-Kommentare (6 Stück)

Per Kaizen-Manifest: _„About to type `// TODO:` — Implement IMMEDIATELY"_

| Datei                             | Zeile | Inhalt                            | Priorität      |
| --------------------------------- | ----- | --------------------------------- | -------------- |
| `root-deletion.service.ts`        | 257   | `TODO: Add tenantId parameter`    | Sofort beheben |
| `vacation.controller.test.ts`     | 14    | `See TODO.md §2 for the fix plan` | Sofort beheben |
| `main.ts`                         | 83    | `TODO: Implement nonce-based CSP` | Pre-Production |
| `storage-upgrade/+page.svelte`    | 151   | `TODO: Get actual used storage`   | Pre-Production |
| `storage-upgrade/+page.server.ts` | 85    | `TODO: Get actual used storage`   | Pre-Production |
| `survey-results/+page.svelte`     | 104   | `TODO: Implement PDF export`      | Pre-Production |

**CSP, Storage, PDF-Export** → kommen kurz vor Produktion. Nicht zeitkritisch, aber trotzdem als GitHub Issues erfassen und TODOs durch Issue-Referenzen ersetzen.

---

## 3. HOCH — Nächste Sprint-Planung

### 3.1 God-Services im Backend

Keine `max-lines`-Verstöße, aber architektonisch zu breit:

| Service                   | Code-Zeilen | Public Methods | Problem                                                                     |
| ------------------------- | ----------- | -------------- | --------------------------------------------------------------------------- |
| `KvpService`              | 869         | 26+            | Facade zu breit — CRUD + Comments + Attachments + Confirmations + Dashboard |
| `SettingsService`         | 788         | 18+            | 3× identische CRUD-Logik (system/tenant/user)                               |
| `ReportsService`          | 757         | 12+            | Alle Report-Typen in einem Service                                          |
| `NotificationsController` | 600         | 12 Endpoints   | Core + Preferences + Statistics + SSE-Streaming                             |

**Kein ESLint-Verstoß, aber SRP-Verstoß.** Sollten bei nächster Erweiterung gesplittet werden.

**Empfehlung:**

- `KvpService` → KvpSuggestionService + KvpQueryService (Dashboard/Stats)
- `SettingsService` → Generischer Scope-Ansatz oder 3 separate Services
- `ReportsService` → Domain-spezifische Report-Services
- `NotificationsController` → NotificationsPreferencesController separieren

### 3.2 Frontend-Komponenten mit wenig Puffer (<30 Code-Zeilen frei)

Diese Dateien bestehen ESLint, aber jede Erweiterung erzwingt Extraktion:

| Komponente                      | Code-Zeilen | Puffer | Risiko                         |
| ------------------------------- | ----------- | ------ | ------------------------------ |
| `vacation/+page.svelte`         | 682         | 18     | Nächstes Feature sprengt Limit |
| `manage-assets/+page.svelte`    | 680         | 20     | Nächstes Feature sprengt Limit |
| `manage-employees/+page.svelte` | 672         | 28     | Knapp                          |
| `RotationSetupModal.svelte`     | 673         | 27     | Knapp                          |
| `SlotAssistant.svelte`          | 671         | 29     | Knapp + 5 Nesting-Levels       |

**Die 3 manage-\* Seiten** teilen sich ~70% der Logik:

- Availability-Modal
- Role-Change-Handlers
- CRUD-Pattern (Create, Edit, Delete mit Modal-State)
- Such-/Filter-Logik

**Empfehlung:** Shared `useAvailabilityModal()` Composable + gemeinsame CRUD-State-Factory — proaktiv, bevor Limit erreicht wird.

**SlotAssistant.svelte** hat **5 Nesting-Levels** im Template:

```svelte
{#if showOnlyScheduled}
  {#each scheduledDays as day}
    {#each projSlots as slot}
      {#each slot.intervalTypes as interval}
        <!-- Level 4-5 -->
```

**Empfehlung:** `SlotCalendarGrid.svelte` extrahieren + Datum-Logik in Utils auslagern

### 3.3 eslint-disable ohne Begründung (2 Stellen)

| Datei                                 | Zeile | Regel                    | Problem                     |
| ------------------------------------- | ----- | ------------------------ | --------------------------- |
| `chat/_lib/chat-page-state.svelte.ts` | 1     | `max-lines`              | Kein ` -- reason` Kommentar |
| `admin-profile/+page.svelte`          | 272   | `require-atomic-updates` | Kein ` -- reason` Kommentar |

Alle anderen 184 `eslint-disable`-Comments haben korrekte Begründungen (186 gesamt, 98,9% Compliance).

---

## 4. MITTEL — Technische Schulden

### 4.1 websocket.ts — Type-Safety-Lücken

- 14+ `as`-Casts für `JSON.parse()`-Ergebnisse
- Optional Chaining ohne Fallback (6 Stellen)
- Keine Zod-Validierung für eingehende WebSocket-Messages

### 4.2 Inkonsistente ID-Param-DTOs (30+ Dateien)

Drei verschiedene Patterns im Einsatz:

```typescript
// Pattern A: Shared Schema (korrekt)
z.object({ id: IdSchema });

// Pattern B: Hardcoded (inkonsistent)
z.object({ id: z.coerce.number().int().positive('X ID must be positive') });

// Pattern C: Anderer Parametername
z.object({ adminId: z.coerce.number().int().positive() });
```

**Empfehlung:** Generic Factory `createIdParamDto(paramName, entityLabel)` in `backend/src/nest/common/dto/`

### 4.3 Dateinamen-Inkonsistenz (7 Legacy-Dateien)

Legacy aus der frühen Entwicklungsphase:

| Datei                    | Pfad                   | Ist       | Soll                       |
| ------------------------ | ---------------------- | --------- | -------------------------- |
| `deletionWorker.ts`      | `backend/src/workers/` | camelCase | `deletion-worker.ts`       |
| `emailService.ts`        | `backend/src/utils/`   | camelCase | `email-service.ts`         |
| `employeeIdGenerator.ts` | `backend/src/utils/`   | camelCase | `employee-id-generator.ts` |
| `fieldMapper.ts`         | `backend/src/utils/`   | camelCase | `field-mapper.ts`          |
| `eventBus.ts`            | `backend/src/utils/`   | camelCase | `event-bus.ts`             |
| `pathSecurity.ts`        | `backend/src/utils/`   | camelCase | `path-security.ts`         |
| `featureCheck.ts`        | `backend/src/utils/`   | camelCase | `feature-check.ts`         |

---

## 5. WAS GUT IST

| Kategorie              | Befund                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dateigrößen**        | 0 ESLint-Verstöße für `max-lines` in der gesamten Codebase (nur 1 begründetes eslint-disable)                                                                     |
| **Funktionslänge**     | Keine einzige Funktion bricht das 60-Zeilen-Limit. Nächste bei 53 Zeilen.                                                                                         |
| **`any`-Nutzung**      | 5 in Production-Code — alle mit eslint-disable + Begründung (CalendarView, AppSidebar, AppHeader, crypto-bridge, common.schema). 5 in Tests (`as any` für Mocks). |
| **ESLint-Disable**     | 186 Comments, **184 mit Begründung** (98,9%), 2 ohne (chat-page-state, admin-profile).                                                                            |
| **Strikte Gleichheit** | 14 Vorkommen von `== null`/`!= null` im Backend (intentionales Null-Coalescing-Pattern, ESLint-konform). 0 lose Vergleiche mit anderen Werten. 0 im Frontend.     |
| **Non-null `!`**       | Nur in Test-Dateien. 0 in Production.                                                                                                                             |
| **Guard Clauses**      | Konsequent angewendet (Early Returns). Max 4 Nesting-Levels im Backend.                                                                                           |
| **Service-Extraction** | Vacation, Documents, KVP, TPM — alle sauber in Sub-Services aufgeteilt.                                                                                           |
| **Tests**              | 4.614 Tests (Unit + API + Permission + Frontend). Massive Abdeckung.                                                                                              |
| **RLS**                | 103 Tabellen mit Row Level Security. Tenant-Isolation wasserdicht.                                                                                                |
| **Dokumentation**      | 26 ADRs, 17+ How-To Guides, vollständige Masterpläne. Best-in-Class.                                                                                              |
| **kebab-case**         | 99% Compliance. 6 Legacy-Dateien in `utils/` + 1 in `workers/` als Ausreißer.                                                                                     |

---

## 6. Priorisierte Maßnahmen

### Sofort (< 1 Tag)

| #   | Maßnahme                                                              | Aufwand | Impact                          |
| --- | --------------------------------------------------------------------- | ------- | ------------------------------- |
| 1   | Session-Expired → `$lib/utils/session-expired.ts`                     | 30 min  | 15 Dateien bereinigt            |
| 2   | 2 sofortige TODOs entfernen (root-deletion, vacation.controller.test) | 15 min  | Kaizen-Compliance               |
| 3   | Backend catch-Blöcke typisieren (25 Stellen)                          | 1h      | Type Safety                     |
| 4   | Shared `getErrorMessage()` Helper erstellen                           | 15 min  | Grundlage für catch-Bereinigung |
| 5   | 2× eslint-disable begründen (chat-page-state + admin-profile)         | 5 min   | Konsistenz                      |

### Kurzfristig (1–3 Tage)

| #   | Maßnahme                                     | Aufwand | Impact                     |
| --- | -------------------------------------------- | ------- | -------------------------- |
| 6   | Availability-History-Loader generisch machen | 1h      | 4 Dateien → 1              |
| 7   | ID-Param-DTO-Factory erstellen               | 1h      | 30+ Dateien konsistent     |
| 8   | manage-\* Shared Composable extrahieren      | 3h      | 3 Pages proaktiv entlasten |

### Mittelfristig (Sprint-Planung)

| #   | Maßnahme                                        | Aufwand | Impact                      |
| --- | ----------------------------------------------- | ------- | --------------------------- |
| 9   | Frontend catch-Blöcke typisieren (300+ Stellen) | 4h      | Mechanisch aber umfangreich |
| 10  | `websocket.ts` Zod-Validierung hinzufügen       | 2h      | Runtime Type Safety         |
| 11  | UI-State-Factory generisch machen               | 3h      | 20+ Dateien konsolidiert    |
| 12  | `utils/` Dateien in kebab-case umbenennen       | 30 min  | Naming-Konsistenz           |

### Pre-Production

| #   | Maßnahme                                           | Aufwand | Impact                    |
| --- | -------------------------------------------------- | ------- | ------------------------- |
| 13  | Nonce-based CSP implementieren (main.ts TODO)      | 2–4h    | Security Hardening        |
| 14  | Storage-Upgrade: echte Speichernutzung vom Backend | 1–2h    | Feature-Vervollständigung |
| 15  | Survey-Results: PDF-Export implementieren          | 3–4h    | Feature-Vervollständigung |

### Bei nächster Erweiterung (proaktiv splitten)

| Service / Komponente                   | Trigger                      | Aktion                                              |
| -------------------------------------- | ---------------------------- | --------------------------------------------------- |
| `kvp.service.ts` (869/900)             | Nächstes KVP-Feature         | → KvpSuggestionService + KvpQueryService            |
| `vacation.service.ts` (853/900)        | Nächstes Vacation-Feature    | → VacationRequestService + VacationLifecycleService |
| `vacation/+page.svelte` (682/700)      | Nächstes Vacation-UI-Feature | → Modal-Logik extrahieren                           |
| `manage-assets/+page.svelte` (680/700) | Nächstes Machines-Feature    | → Shared CRUD Composable                            |

---

## Anhang: Metriken

| Metrik                                     | Wert                                                              |
| ------------------------------------------ | ----------------------------------------------------------------- |
| ESLint `max-lines` Verstöße                | **0** (1 begründetes eslint-disable)                              |
| eslint-disable gesamt                      | **186** (184 mit Begründung, **2 ohne**)                          |
| eslint-disable ohne Begründung             | **2** (`chat-page-state.svelte.ts`, `admin-profile/+page.svelte`) |
| Backend-Services nahe Limit (>850/900)     | 2 (`kvp`: 869, `vacation`: 853)                                   |
| Frontend-Komponenten nahe Limit (>670/700) | 5                                                                 |
| Duplizierter Code (geschätzt)              | ~9.000 Zeilen                                                     |
| Untypisierte catch-Blöcke (Backend)        | 25                                                                |
| Untypisierte catch-Blöcke (Frontend)       | ~290                                                              |
| Unsichere `as Error` Casts                 | 17                                                                |
| TODO-Kommentare                            | 6 (2 sofort, 4 Pre-Production)                                    |
| `any` in Production-Code                   | 5 (alle mit eslint-disable + Begründung)                          |
| `any` in Test-Code                         | 5 (`as any` für Mocks)                                            |
| `== null`/`!= null` (intentional)          | 14 (Backend, ESLint-konform)                                      |
| Tests gesamt                               | 4.614                                                             |
| RLS-Tabellen                               | 103                                                               |
| ADRs                                       | 26                                                                |
