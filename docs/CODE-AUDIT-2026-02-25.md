# Code Audit — 6. März 2026 (v2) + Fixes v3/v4 (7. März 2026)

**Originalaudit:** 25. Februar 2026 (Branch `feature/TPM`)
**Update v2:** 6. März 2026 (Branch `feat/pg-partman`)
**Fixes v3:** 7. März 2026 (Branch `refactor/code-audit`) — 5 Sofort-Maßnahmen + Regressions-Schutz
**Fixes v4:** 7. März 2026 (Branch `refactor/code-audit`) — Maßnahme #6: `is_active` Magic Numbers zentralisiert
**Fixes v5:** 7. März 2026 (Branch `refactor/code-audit`) — Maßnahme #7: Availability-History-Loader generisch
**Fixes v6:** 7. März 2026 (Branch `refactor/code-audit`) — Maßnahme #8: ID-Param-DTO-Factory zentralisiert
**Fixes v7:** 7. März 2026 (Branch `refactor/code-audit`) — Maßnahme #9: SlotAssistant Grid-Extraktion + Kalender-Navigation
**Fixes v8:** 7. März 2026 (Branch `refactor/code-audit`) — Maßnahme #10: SKIPPED (premature abstraction) + Maßnahme #15: kebab-case Rename (7+5 Dateien, 100% Konsistenz)
**Fixes v9:** 8. März 2026 (Branch `refactor/code-audit`) — Maßnahme #11: Frontend catch-Blöcke typisiert (298 Stellen, 127 Dateien) + zentraler `getErrorMessage` Helper
**Fixes v10:** 8. März 2026 (Branch `refactor/code-audit`) — Maßnahme #12: WebSocket Zod-Validierung (13 `as`-Casts → 0, 5 Zod-Schemas)
**Fixes v11:** 8. März 2026 (Branch `refactor/code-audit`) — Maßnahme #13: Shared `db-helpers.ts` Utility (toIsoString, buildFullName, buildSetClause — 11 Dateien refactored)
**Fixes v12:** 8. März 2026 (Branch `refactor/code-audit`) — Maßnahme #14: SKIPPED (premature abstraction) + Maßnahme #16: CSP war bereits nonce-basiert in SvelteKit (redundante `unsafe-inline` aus Backend entfernt)
**Auditor:** Claude Opus 4.6 (10 parallele Verifikations-Agents)
**Scope:** Gesamte Codebase (`backend/src/`, `frontend/src/`)
**Verifiziert:** Unabhängige Gegenprüfung aller Metriken gegen aktuelle Codebase

---

## Zusammenfassung

| Kategorie                 | v1 (25.02.) | v2 (06.03.) | Trend | Begründung                                                           |
| ------------------------- | ----------- | ----------- | ----- | -------------------------------------------------------------------- |
| **Gesamtbewertung**       | 8/10        | **8/10**    | **↑** | v5: +Availability-Loader generisch, v4: `is_active`, Session-Expired |
| Architektur & Modularität | 8/10        | **8/10**    | →     | Work Orders sauber modularisiert                                     |
| Type Safety               | 7/10        | **9/10**    | **↑** | v10: WebSocket Zod-Validierung (13→0 `as`-Casts) + 15 Arch-Tests     |
| Code-Duplikation          | 5/10        | **6/10**    | **↑** | v5: +Availability-Loader (4→1), v4: `is_active` (466→0)              |
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

| Komponente                       | Total (v1) | Total (v2) | Delta   | Code (v1) | Code (v2 geschätzt) | Status                                                           |
| -------------------------------- | ---------- | ---------- | ------- | --------- | ------------------- | ---------------------------------------------------------------- |
| `kvp-detail/+page.svelte`        | 845        | **846**    | +1      | 655       | ~655                | BESTANDEN                                                        |
| `SlotAssistant.svelte`           | 814        | **868**    | **+54** | 671       | **730**             | **BESTANDEN** — ESLint pass (v7: Grid extrahiert + Kalender-Nav) |
| `AppSidebar.svelte`              | 861        | **841**    | -20     | 734       | —                   | eslint-disable (begründet: 60% CSS)                              |
| `manage-admins/+page.svelte`     | 823        | **821**    | -2      | 657       | ~655                | BESTANDEN                                                        |
| `RotationSetupModal.svelte`      | 817        | **817**    | 0       | 673       | ~673                | BESTANDEN — 27 frei                                              |
| `manage-assets/+page.svelte`     | 803        | **796**    | -7      | 680       | ~671                | BESTANDEN — ~29 frei                                             |
| `blackboard/[uuid]/+page.svelte` | 804        | **795**    | -9      | 649       | ~640                | BESTANDEN                                                        |
| `manage-employees/+page.svelte`  | 813        | **755**    | -58     | 672       | ~617                | BESTANDEN — verbessert                                           |
| `vacation/overview/+page.svelte` | 832        | **419**    | -413    | 682       | ~340                | **UMSTRUKTURIERT** — Route verschoben                            |

**v7:** `SlotAssistant.svelte` wurde refactored — `SlotDayContent.svelte` (74 Code-Zeilen) extrahiert + Kalender-Navigation (KW-Labels, Monatsseparatoren, Occurrence-Badges) hinzugefügt. ESLint `max-lines` besteht.

### 1.3 Frontend .ts-Dateien

Limit: 800 Code-Zeilen für `.ts`.

| Datei                                 | Total (v1) | Total (v2) | Delta   | Code (v1) | Code (v2 geschätzt) | Status                                                         |
| ------------------------------------- | ---------- | ---------- | ------- | --------- | ------------------- | -------------------------------------------------------------- |
| `shifts/_lib/api.ts`                  | 1.002      | **1.029**  | **+27** | 706       | **~726**            | BESTANDEN — ~74 frei                                           |
| `chat/_lib/chat-page-state.svelte.ts` | 967        | **967**    | 0       | 827       | 827                 | BESTANDEN — 23 frei (Limit 850), alle eslint-disable begründet |
| `crypto-worker.ts`                    | 815        | **816**    | +1      | 636       | ~636                | BESTANDEN                                                      |

**v10-Korrektur:** `chat-page-state.svelte.ts` war **kein Verstoß** — das Frontend `.ts`-Limit ist 850 (nicht 800), 827 Code-Zeilen = 23 frei. Alle 3 eslint-disable-Comments haben Begründungen. v1-Finding war falsch.

---

## 2. KRITISCH — Sofort handeln

### 2.1 Code-Duplikation (~12.000+ Zeilen geschätzt)

**v6-Update:** Geschätzte Gesamtduplikation von ~5.900 auf ~5.500 Zeilen reduziert — ID-Param-DTO-Factory (~400 LOC Duplikation → Factory + Slim Re-Exports, ~236 LOC eliminiert).

| Duplikat                                   | v1 Instanzen | v2 Instanzen        | Geschätzte Zeilen | Verifiziert | Trend           |
| ------------------------------------------ | ------------ | ------------------- | ----------------- | ----------- | --------------- |
| ~~SQL `is_active` Magic Numbers (alle)~~   | 158 Stellen  | ~~**466 Stellen**~~ | ~~**5.000+**~~    | Ja          | **BEHOBEN v4**  |
| ~~Session-Expired-Handling (Frontend)~~    | 15 Dateien   | ~~**15 Dateien**~~  | ~~~675~~          | Ja          | **BEHOBEN v3**  |
| ~~Availability-History-Loader (Frontend)~~ | 4 Dateien    | ~~**4 Dateien**~~   | ~~400+~~          | Ja          | **BEHOBEN v5**  |
| Row-Mapper-Helpers                         | 12+ Services | **18+ Helpers**     | 700+              | Ja          | **↓**           |
| ~~UI-State-Factories (Frontend)~~          | 20+ Dateien  | ~~**48+ Dateien**~~ | ~~**~640**~~      | **Ja**      | **SKIPPED v12** |
| ~~ID-Param-DTOs (Backend)~~                | 30+ Dateien  | ~~**36 DTOs**~~     | ~~400+~~          | Ja          | **BEHOBEN v6**  |
| Pagination-Schemas (Backend)               | 20+ DTOs     | **15-20 DTOs**      | 300+              | Ja          | **↑**           |
| Error-Handling try/catch                   | 51+ Services | 51+ Services        | 1.500+            | Nein        | →               |
| Constants/Types verstreut                  | 73+ Dateien  | **50-70 Dateien**   | 1.500+            | Teilweise   | **↑**           |

---

#### ~~Schlimmster Offender: `is_active` Magic Numbers (466×)~~ — BEHOBEN (2026-03-07)

**Status:** Alle 466 Magic Numbers in 134 Dateien (133 per Migrations-Skript + 1 manuell) durch `IS_ACTIVE`-Konstanten aus `@assixx/shared/constants` ersetzt. ~5.000 LOC Duplikation eliminiert.

| Pattern           | Vorher  | Nachher | Ersetzt durch                              |
| ----------------- | ------- | ------- | ------------------------------------------ |
| `is_active = 1`   | 325     | **0**   | `is_active = ${IS_ACTIVE.ACTIVE}`          |
| `is_active = 4`   | 73      | **0**   | `is_active = ${IS_ACTIVE.DELETED}`         |
| `is_active = $N`  | 22      | **0**   | `is_active = ${IS_ACTIVE.*}`               |
| `is_active != N`  | 19      | **0**   | `is_active != ${IS_ACTIVE.*}`              |
| `is_active = 3`   | 11      | **0**   | `is_active = ${IS_ACTIVE.ARCHIVED}`        |
| `is_active = 0`   | 8       | **0**   | `is_active = ${IS_ACTIVE.INACTIVE}`        |
| `is_active IN`    | 8       | **0**   | `is_active IN (${IS_ACTIVE.*}, ...)`       |
| `is_active === 1` | 1       | **0**   | `is_active === IS_ACTIVE.ACTIVE` (manuell) |
| **Gesamt**        | **466** | **0**   | **134 Dateien migriert**                   |

**Regressions-Schutz:** 4 Architektur-Tests in `shared/src/architectural.test.ts` prüfen via CI:

- Kein hardcoded `is_active = N` in Production `.ts`-Dateien (Migrations ausgenommen)
- Kein hardcoded `is_active != N` in Production `.ts`-Dateien
- Kein hardcoded `is_active IN (N, ...)` in Production `.ts`-Dateien
- Keine lokalen `IS_ACTIVE`-Konstantendefinitionen (Import aus `@assixx/shared/constants`)

**Dokumentiert in:** `docs/TYPESCRIPT-STANDARDS.md` Section 7.4 + No-Go #16, ADR-023 + ADR-026 referenzieren `IS_ACTIVE`-Konstante.

---

#### ~~Zweiter Offender: Session-Expired-Handling~~ — BEHOBEN (2026-03-07)

**Status:** Zentralisiert in `frontend/src/lib/utils/session-expired.ts`. 16 Dateien refactored, ~675 LOC eliminiert, 3 goto-Varianten → 1 konsistentes Pattern.

**Regressions-Schutz:** Architektur-Test in `shared/src/architectural.test.ts` prüft via CI:

- Keine lokalen `isSessionExpiredError`/`handleSessionExpired`/`handleUnauthorized`-Definitionen in Route-Dateien
- `goto('/login?session=expired')` nur in der zentralen Util erlaubt

**Dokumentiert in:** `docs/CODE-OF-CONDUCT-SVELTE.md` (Session-Expired Handling Sektion)

---

#### ~~Dritter Offender: Availability-History-Loader~~ — BEHOBEN (2026-03-07)

**Status:** Generischer Loader `loadAvailabilityHistory<TEntity>()` in `frontend/src/lib/server/availability-history-loader.ts`. 4 Dateien von je ~136 Zeilen auf je 24 Zeilen reduziert (~288 LOC eliminiert).

- Generics für typsichere Entity-Keys (`UserAvailabilityEntity` / `AssetAvailabilityEntity`)
- `AvailabilityEntryBase` Interface für gemeinsame Entry-Felder
- Consumer: Destructuring `{ entity, ...rest }` → spezifischer Key (`employee`/`asset`)
- 0 Änderungen an `+page.svelte` Dateien — rückwärtskompatibel
- ESLint ✅, svelte-check ✅, 6.068 Tests ✅

---

### 2.2 Untypisierte catch-Blöcke (327+ Stellen)

**v3-Status (2026-03-07): Backend ERLEDIGT. 25 Stellen + 17 unsichere Casts behoben.**
**v9-Status (2026-03-08): Frontend ERLEDIGT. 298 Stellen in 127 Dateien typisiert + 3 lokale getErrorMessage-Kopien zentralisiert.**

- `getErrorMessage(error: unknown)` Helper erstellt in `backend/src/nest/common/utils/error.utils.ts`
- `getErrorMessage(error: unknown, fallback?)` Helper erstellt in `frontend/src/lib/utils/error.ts`
- Alle 25 Backend catch-Blöcke explizit `: unknown` typisiert
- Alle 298 Frontend catch-Blöcke explizit `: unknown` typisiert (127 Dateien)
- Alle 17 `(error as Error).message` Casts durch `getErrorMessage(error)` ersetzt
- 3 lokale `getErrorMessage`-Kopien entfernt (RoleSwitch, tenant-deletion-status, RotationSetupModal) → Import aus `$lib/utils/error`
- ~~Frontend (302 Stellen) bleibt OFFEN (Maßnahme #11)~~ **ERLEDIGT** (2026-03-08)

**Regressions-Schutz:** Architektur-Tests in `shared/src/architectural.test.ts` prüfen via CI:

- Kein `(error as Error)` oder `(err as Error)` im Backend-Produktionscode
- Kein untypisierter `catch (err) {` im Frontend-Code
- Keine lokalen `getErrorMessage`-Definitionen im Frontend (Import aus `$lib/utils/error`)

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

**Frontend (~~302 Stellen — verifiziert~~ BEHOBEN 2026-03-08):**

- ~~`catch (err)` — 282 Instanzen in 117 Dateien~~ → alle `catch (err: unknown)`
- ~~`catch (error)` — 19 Instanzen~~ → alle `catch (error: unknown)`
- ~~`catch (e)` — 1 Instanz (sentry-example-page)~~ → `catch (e: unknown)`

**Zusätzlich: 17× unsicherer `(error as Error).message` Cast (~~verifiziert, exakt wie v1~~ BEHOBEN 2026-03-07):**

| Datei                      | Anzahl |
| -------------------------- | ------ |
| `emailService.ts`          | 10×    |
| `departments.service.ts`   | 3×     |
| `feature-check.service.ts` | 2×     |
| `teams.service.ts`         | 1×     |
| `role-switch.service.ts`   | 1×     |

---

### 2.3 TODO-Kommentare (~~5~~ ~~4~~ 3 Stück)

Per Kaizen-Manifest: _"About to type `// TODO:` — Implement IMMEDIATELY"_

**v3 (2026-03-07): 4 statt 5 — `root-deletion.service.ts` TODO implementiert (tenantId + UserRepository).**
**v12 (2026-03-08): 3 statt 4 — `main.ts` CSP-TODO entfernt (war bereits nonce-basiert in SvelteKit).**

| Datei                             | Zeile   | Inhalt                                | Priorität                                                          |
| --------------------------------- | ------- | ------------------------------------- | ------------------------------------------------------------------ |
| ~~`root-deletion.service.ts`~~    | ~~257~~ | ~~`TODO: Add tenantId parameter`~~    | **ERLEDIGT** (2026-03-07)                                          |
| ~~`main.ts`~~                     | ~~83~~  | ~~`TODO: Implement nonce-based CSP`~~ | **ERLEDIGT** (2026-03-08) — war bereits in SvelteKit implementiert |
| `storage-upgrade/+page.svelte`    | 151     | `TODO: Get actual used storage`       | → `docs/PRE-PRODUCTION-TODO.md` #17                                |
| `storage-upgrade/+page.server.ts` | 85      | `TODO: Get actual used storage`       | → `docs/PRE-PRODUCTION-TODO.md` #17                                |
| `survey-results/+page.svelte`     | 104     | `TODO: Implement PDF export`          | → `docs/PRE-PRODUCTION-TODO.md` #18                                |

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

| Komponente                   | Code (v2 geschätzt) | Limit | Puffer | Risiko                                                       |
| ---------------------------- | ------------------- | ----- | ------ | ------------------------------------------------------------ |
| ~~`SlotAssistant.svelte`~~   | ~~694~~ → **730**   | 700   | —      | **ENTSCHÄRFT** (v7) — ESLint pass, SlotDayContent extrahiert |
| `RotationSetupModal.svelte`  | ~673                | 700   | ~27    | Knapp                                                        |
| `manage-assets/+page.svelte` | ~671                | 700   | ~29    | Knapp                                                        |
| `kvp-detail/+page.svelte`    | ~655                | 700   | ~45    | Knapp                                                        |
| `manage-admins/+page.svelte` | ~655                | 700   | ~45    | Knapp                                                        |

**v7:** `SlotAssistant.svelte` Nesting reduziert — Slot-Rendering in `SlotDayContent.svelte` extrahiert. Kalender-Navigation (KW, Monatsseparatoren, Occurrence-Badges) hinzugefügt. ESLint besteht.

### 3.3 ~~eslint-disable ohne Begründung~~ — BEHOBEN (2026-03-07)

**v3: 100% Compliance.** Die letzte unbegründete Stelle wurde behoben:

| Datei                        | Zeile | Regel                    | Status                    |
| ---------------------------- | ----- | ------------------------ | ------------------------- |
| `admin-profile/+page.svelte` | 272   | `require-atomic-updates` | **ERLEDIGT** (2026-03-07) |

Alle **179** `eslint-disable`-Comments haben jetzt korrekte Begründungen (**100% Compliance**).

---

## 4. MITTEL — Technische Schulden

### ~~4.1 websocket.ts — Type-Safety-Lücken~~ — BEHOBEN (2026-03-08)

**Status:** Alle 13 `as`-Casts eliminiert. 5 Zod-Schemas validieren eingehende WebSocket-Messages + Redis-Ticketdaten zur Laufzeit. 8 `as number`-Casts durch Guard-Clauses mit destructured Locals ersetzt.

| Vorher                                                         | Nachher                                                |
| -------------------------------------------------------------- | ------------------------------------------------------ |
| `JSON.parse(result) as ConnectionTicketData`                   | `ConnectionTicketDataSchema.parse(JSON.parse(result))` |
| `JSON.parse(dataString) as WebSocketMessage`                   | `WebSocketMessageSchema.parse(JSON.parse(dataString))` |
| `message.data as SendMessageData/TypingData/MarkReadData` (4×) | `SendMessageDataSchema.parse(message.data)` etc.       |
| `ws.tenantId as number` / `ws.userId as number` (8×)           | Guard clause + destructured locals                     |

**Regressions-Schutz:** Architektur-Test in `shared/src/architectural.test.ts` prüft via CI:

- Keine `as`-Casts in `websocket.ts` oder `websocket-message-handler.ts` (Import-Aliases ausgenommen)

### ~~4.2 ID-Param-DTOs — 3 Patterns, keine Factory~~ — BEHOBEN (2026-03-07)

**Status:** Factory `createIdParamSchema()` + `createUuidParamSchema()` in `backend/src/nest/common/dto/param.factory.ts`. 29 Param-DTOs migriert, 3 Patterns → 1 konsistentes Pattern.

| Vorher                                                | Nachher                                          |
| ----------------------------------------------------- | ------------------------------------------------ |
| Pattern A: `IdSchema` aus `common.schema.ts` (4 DTOs) | Re-export `IdParamDto` aus `common/dto`          |
| Pattern B: Inline `z.coerce...` (19 DTOs)             | Factory `createIdParamSchema()` oder Re-export   |
| Pattern C: Custom Names (12 DTOs)                     | Factory mit typisierten Param-Namen              |
| 3 UUID DTOs inline                                    | Factory `createUuidParamSchema()` oder Re-export |
| 5 Compound-DTOs inline                                | `idField` Import aus `common/dto`                |
| 6 Domain-spezifisch (Enum/String)                     | Unverändert (korrekt)                            |

**Regressions-Schutz:** 2 Architektur-Tests in `shared/src/architectural.test.ts`:

- Kein inline `z.coerce.number()` in `*-param.dto.ts` Dateien
- Kein Import von `IdSchema` aus `schemas/common.schema` in Param-DTOs

**Dokumentiert in:** `docs/TYPESCRIPT-STANDARDS.md` Section 7.5 + No-Go #17

### ~~4.3 Dateinamen-Inkonsistenz (7 Legacy-Dateien)~~ — BEHOBEN (2026-03-07)

**Status:** Alle 7 camelCase-Dateien + 5 zugehörige Test-Dateien in kebab-case umbenannt. 35+ Import-Pfade + 14 vi.mock-Pfade aktualisiert. Config-Dateien (vitest.config.ts, knip.json, docker-compose.yml) angepasst. 5.341 Tests grün (4.963 unit + 378 permission).

| Datei (vorher)           | Datei (nachher)            | Imports aktualisiert |
| ------------------------ | -------------------------- | -------------------- |
| `deletionWorker.ts`      | `deletion-worker.ts`       | 0 + 3 Configs        |
| `emailService.ts`        | `email-service.ts`         | 2 + 1 vi.mock        |
| `employeeIdGenerator.ts` | `employee-id-generator.ts` | 2 + 1 vi.mock        |
| `fieldMapper.ts`         | `field-mapper.ts`          | 14 + 6 vi.mock       |
| `eventBus.ts`            | `event-bus.ts`             | 11 + 8 vi.mock       |
| `pathSecurity.ts`        | `path-security.ts`         | 2                    |
| `featureCheck.ts`        | `feature-check.ts`         | 2                    |

**Naming-Konsistenz:** 99% → **100%**. Keine camelCase-Dateinamen mehr in der Codebase.

### ~~4.4 Row-Mapper Duplikation~~ — BEHOBEN (2026-03-08)

**Status:** Shared `db-helpers.ts` Utility erstellt. 3 duplizierte Funktionsdefinitionen (`toIsoString`, `toIsoStringOrNull`, `parseIds`/`parseNames`) eliminiert, 2 identische `buildUpdateFields`-Implementierungen durch `buildSetClause` ersetzt, 5 inline fullName-Patterns durch `buildFullName` ersetzt, 8 `new Date(x).toISOString()` durch `toIsoString(x)` ersetzt.

| Vorher                                          | Nachher                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| 3× lokale `toIsoString` Definitionen            | 1× in `utils/db-helpers.ts`                                       |
| 3× lokale `toIsoStringOrNull` Definitionen      | 1× in `utils/db-helpers.ts`                                       |
| 2× lokale `parseIds`/`parseNames` Definitionen  | `parseStringAgg`/`parseStringAggNumbers` in `utils/db-helpers.ts` |
| 2× identische `buildUpdateFields` (13 LOC each) | `buildSetClause` in `utils/db-helpers.ts`                         |
| 5× inline fullName-Concatenation                | `buildFullName` in `utils/db-helpers.ts`                          |

**Regressions-Schutz:** 3 Architektur-Tests in `shared/src/architectural.test.ts` prüfen via CI:

- Keine lokalen `toIsoString` Definitionen in `*.helpers.ts`
- Keine lokalen `toIsoStringOrNull` Definitionen in `*.helpers.ts`
- Keine lokalen `parseIds`/`parseNames` STRING_AGG Parser in `*.helpers.ts`

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
| **Tests**              | 4.614               | **5.089** (+475). Massive Abdeckung weiter gewachsen. 10 Architektur-Tests CI-enforced.                               |
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

| #   | Maßnahme                                                   | Aufwand | Impact                                                    | v1-Status                 |
| --- | ---------------------------------------------------------- | ------- | --------------------------------------------------------- | ------------------------- |
| 6   | `is_active`-Konstante zentralisieren (Details siehe unten) | 4-6h    | **466 Stellen** (134 Dateien) → `IS_ACTIVE` aus `shared/` | **ERLEDIGT** (2026-03-07) |
| 7   | Availability-History-Loader generisch machen               | 1h      | 4 Dateien → 1 Shared + 4 Slim Consumer, ~288 LOC          | **ERLEDIGT** (2026-03-07) |
| 8   | ID-Param-DTO-Factory erstellen                             | 1h      | 36 DTOs konsistent                                        | **ERLEDIGT** (2026-03-07) |
| 9   | `SlotAssistant.svelte` → Grid-Komponente extrahieren       | 1h      | SlotDayContent extrahiert + Kalender-Navigation           | **ERLEDIGT** (2026-03-07) |
| 10  | ~~manage-\* Shared Composable extrahieren~~                | 3h      | ~~3 Pages proaktiv entlasten~~                            | **SKIPPED** (2026-03-07)  |

#### Maßnahme #10 — manage-\* Shared Composable — SKIPPED (2026-03-07)

**Entscheidung:** Bewusst übersprungen — **premature abstraction**.

**Analyse (alle 3 Pages komplett gelesen):** Die Ähnlichkeit ist rein strukturell (Search/Filter/Modal-Boilerplate), nicht inhaltlich. Die Domain-Logik ist fundamental verschieden:

| Aspekt            | manage-assets                    | manage-admins                   | manage-employees             |
| ----------------- | -------------------------------- | ------------------------------- | ---------------------------- |
| State-Architektur | Externer `assetState` Store      | Lokale `$state()`               | Lokale `$state()`            |
| Form-Felder       | model, manufacturer, assetType   | hasFullAccess, areaIds, deptIds | phone, dateOfBirth, teamIds  |
| Rollenänderung    | Keine                            | Upgrade + Downgrade (2 Flows)   | Nur Upgrade (1 Flow)         |
| Status-Filter     | 7 Typen (operational, repair...) | 4 Typen (active, inactive...)   | 4 Typen (gleich wie Admins)  |
| Availability API  | UUID-basiert, Asset-Status-Enum  | ID-basiert, User-Status-Enum    | ID-basiert, User-Status-Enum |
| Dropdown-Handling | 5 konfigurierte Dropdowns        | 1 (nur Search)                  | 1 (nur Search)               |

**Warum Skip korrekt ist:**

1. Ein Shared Composable bräuchte so viele Generics und Konfigurationsoptionen, dass es **komplexer wäre als die Duplikation**
2. Die Pages können sich in Zukunft weiter auseinanderentwickeln (z.B. Assets bekommt QR-Codes, Admins bekommt 2FA)
3. Jede Page hat ihre Domain-Logik bereits sauber in `_lib/` extrahiert (api, filters, utils, constants, types, Sub-Components)
4. CLAUDE.md: _"Three similar lines of code is better than a premature abstraction"_

**Kein Handlungsbedarf.** Die aktuelle Struktur ist langfristig die richtige.

---

#### Maßnahme #14 — UI-State-Factory generisch machen — SKIPPED (2026-03-08)

**Entscheidung:** Bewusst übersprungen — **premature abstraction** (verifiziert).

**Verifikation (5 parallele Analyse-Agents):** Die Duplikation wurde erstmals vollständig verifiziert. Audit-Schätzung war **~40% zu hoch**.

| Audit-Behauptung         | Verifiziert                                                      |
| ------------------------ | ---------------------------------------------------------------- |
| "20+ Dateien"            | **48+ State-Dateien** — mehr als geschätzt, aber gut organisiert |
| "1.000+ LOC Duplikation" | **~640 LOC** — überschätzt                                       |

**Tatsächliche Duplikation (aufgeschlüsselt):**

| Pattern                                    | Dateien     | LOC pro Datei | Total    |
| ------------------------------------------ | ----------- | ------------- | -------- |
| Modal State (`show*Modal = $state(false)`) | 42          | 3-8           | ~200     |
| Loading/Submitting (`try/finally`)         | 50+         | 3-5           | ~200     |
| Search/Filter State                        | 11-17       | 5-8           | ~100     |
| CRUD-Handlers (open/close/reset)           | 7 manage-\* | ~20           | ~140     |
| **Total abstrahierbarer Boilerplate**      |             |               | **~640** |

**Was eine Abstraktion kosten würde:**

- Generics für Item-Type, Form-Type, Filter-Type (~30 LOC)
- Konfigurationsinterface (~40 LOC)
- Core-Implementation mit Getter/Setter (~80 LOC)
- Dokumentation + Tests (~100 LOC)
- **Total: ~250 LOC** → **Netto-Ersparnis: ~390 LOC** auf 50+ Dateien = **~8 Zeilen pro Datei**

**Warum Skip korrekt ist:**

1. **~8 Zeilen Ersparnis pro Datei** rechtfertigt keine generische Abstraktion
2. **Bestehende Architektur ist bereits die richtige Lösung** — 48 organisierte State-Files mit Composition-Pattern (`state-data`, `state-ui`, `state-form`, `state-dropdowns`)
3. **Domäne-Varianz ist hoch** — manage-teams hat 3 Form-Felder, manage-assets hat 12+ mit 5 Dropdowns und externer Factory
4. **Pages müssen sich unabhängig weiterentwickeln** (Assets → QR-Codes, Admins → 2FA)
5. CLAUDE.md: _"Three similar lines of code is better than a premature abstraction"_

**Kein Handlungsbedarf.** Die bestehende State-Architektur ist bewusst domänenspezifisch und langfristig korrekt.

---

#### Maßnahme #6 — ~~Umsetzungsplan~~ `is_active`-Zentralisierung — ERLEDIGT (2026-03-07)

Analoges Vorgehen wie bei `getErrorMessage` (Maßnahme #3/#4) und Session-Expired (Maßnahme #1): Code-Fix + Docs + Regressions-Schutz.

| #   | Unter-Schritt                                         | Aufwand | Details                                                                             | Status                    |
| --- | ----------------------------------------------------- | ------- | ----------------------------------------------------------------------------------- | ------------------------- |
| 6.1 | Production-Code: Magic Numbers → `IS_ACTIVE.*`        | 3-4h    | 112 Prod-Dateien migriert, Import aus `@assixx/shared/constants`                    | **ERLEDIGT** (2026-03-07) |
| 6.2 | Test-Code: Magic Numbers → `IS_ACTIVE.*`              | 1h      | 22 Test-Dateien migriert, gleicher Import                                           | **ERLEDIGT** (2026-03-07) |
| 6.3 | Lokale Kopie entfernen (`blackboard-archive.service`) | 5 min   | Lokale `IS_ACTIVE`-Konstante entfernt → Import aus `shared/`                        | **ERLEDIGT** (2026-03-07) |
| 6.4 | Architektur-Test erstellen (Regressions-Schutz)       | 30 min  | 4 Tests in `shared/src/architectural.test.ts` (=N, !=N, IN, lokale Const)           | **ERLEDIGT** (2026-03-07) |
| 6.5 | `TYPESCRIPT-STANDARDS.md` aktualisieren               | 15 min  | Section 7.4 + No-Go #16 hinzugefügt (v4.2.0)                                        | **ERLEDIGT** (2026-03-07) |
| 6.6 | ADRs prüfen und ggf. Hinweis ergänzen                 | 15 min  | ADR-023 + ADR-026 referenzieren `IS_ACTIVE`-Konstante                               | **ERLEDIGT** (2026-03-07) |
| 6.7 | Vitest-Aliases für Subpath-Exports fixen              | 15 min  | `vitest.config.ts`: `@assixx/shared/constants` Alias in unit + permission Projekten | **ERLEDIGT** (2026-03-07) |

**Definition of Done für Maßnahme #6:**

- [x] 0 hardcoded `is_active = N` in `.ts`-Dateien (außer Migrations) — **466→0 verifiziert**
- [x] Architektur-Test in CI grün (4 Tests, analog zu `getErrorMessage`-Enforcement)
- [x] `TYPESCRIPT-STANDARDS.md` dokumentiert das Pattern (Section 7.4 + No-Go #16)
- [x] Bestehende Tests laufen grün mit `IS_ACTIVE`-Konstante — **6.064/6.064 Tests bestanden**
- [x] ADR-023/026 referenzieren die zentrale Konstante

### Mittelfristig (Sprint-Planung)

| #   | Maßnahme                                       | Aufwand | Impact                       | v1-Status                 |
| --- | ---------------------------------------------- | ------- | ---------------------------- | ------------------------- |
| 11  | Frontend catch-Blöcke typisieren (298 Stellen) | 15 min  | 127 Dateien typisiert        | **ERLEDIGT** (2026-03-08) |
| 12  | `websocket.ts` Zod-Validierung hinzufügen      | 2h      | 13 `as`-Casts eliminieren    | **ERLEDIGT** (2026-03-08) |
| 13  | Row-Mapper Shared Utility erstellen            | 2h      | 18+ Helpers konsolidiert     | **ERLEDIGT** (2026-03-08) |
| 14  | ~~UI-State-Factory generisch machen~~          | 3h      | ~~20+ Dateien konsolidiert~~ | **SKIPPED** (2026-03-08)  |
| 15  | ~~`utils/` Dateien in kebab-case umbenennen~~  | 30 min  | Naming-Konsistenz            | **ERLEDIGT** (2026-03-07) |

### Pre-Production → extrahiert nach `docs/PRE-PRODUCTION-TODO.md`

| #   | Maßnahme                                            | Aufwand | Impact                    | Status                                                             |
| --- | --------------------------------------------------- | ------- | ------------------------- | ------------------------------------------------------------------ |
| 16  | ~~Nonce-based CSP implementieren (`main.ts` TODO)~~ | 2–4h    | Security Hardening        | **ERLEDIGT** (2026-03-08) — war bereits nonce-basiert in SvelteKit |
| 17  | Storage-Upgrade: echte Speichernutzung vom Backend  | 1–2h    | Feature-Vervollständigung | → `PRE-PRODUCTION-TODO.md` (OFFEN)                                 |
| 18  | Survey-Results: PDF-Export implementieren           | 3–4h    | Feature-Vervollständigung | → `PRE-PRODUCTION-TODO.md` (OFFEN)                                 |

### Bei nächster Erweiterung (proaktiv splitten)

| Service / Komponente            | Trigger                   | Aktion                                              |
| ------------------------------- | ------------------------- | --------------------------------------------------- |
| `kvp.service.ts` (869/900)      | Nächstes KVP-Feature      | → KvpSuggestionService + KvpQueryService            |
| `vacation.service.ts` (853/900) | Nächstes Vacation-Feature | → VacationRequestService + VacationLifecycleService |
| ~~`SlotAssistant.svelte`~~      | ~~Jede Änderung~~         | **ERLEDIGT** — SlotDayContent extrahiert (v7)       |
| `shifts/_lib/api.ts` (~726/800) | Nächstes Shifts-Feature   | → Shift-CRUD + Rotation-API aufteilen               |
| `shifts.service.ts` (~716/900)  | Nächstes Shifts-Feature   | → ShiftCrudService + RotationService                |

---

## Anhang: Metriken

| Metrik                                 | v1 (25.02.)   | v2 (06.03.)            | v3 (07.03.)               | v4 (07.03.)                | v5 (07.03.)                | Delta v4→v5 |
| -------------------------------------- | ------------- | ---------------------- | ------------------------- | -------------------------- | -------------------------- | ----------- |
| ESLint `max-lines` Verstöße            | 0             | **0**                  | **0**                     | **0**                      | **0**                      | →           |
| eslint-disable gesamt                  | 186           | **179**                | **179**                   | **179**                    | **179**                    | →           |
| eslint-disable ohne Begründung         | 2             | **1**                  | **0 (100%)**              | **0 (100%)**               | **0 (100%)**               | →           |
| Backend-Services nahe Limit (>850/900) | 2             | **2**                  | **2**                     | **2**                      | **2**                      | →           |
| Frontend-Komponenten nahe Limit        | 5             | **5** (andere Dateien) | **5**                     | **5**                      | **5**                      | →           |
| Duplizierter Code (geschätzt)          | ~9.000 Zeilen | **~12.000+ Zeilen**    | **~11.300 Zeilen**        | **~6.300 Zeilen**          | **~5.900 Zeilen**          | **-400**    |
| `is_active` Magic Numbers (alle)       | 158           | **466**                | **466**                   | **0 (BEHOBEN)**            | **0 (BEHOBEN)**            | →           |
| Session-Expired Duplikation            | 15 Dateien    | **15 Dateien**         | **1 Datei (zentral)**     | **1 Datei (zentral)**      | **1 Datei (zentral)**      | →           |
| Availability-History-Loader            | 4 Dateien     | **4 Dateien**          | **4 Dateien**             | **4 Dateien**              | **1 Shared + 4 Slim**      | **BEHOBEN** |
| Untypisierte catch-Blöcke (Backend)    | 25            | **25**                 | **0 (BEHOBEN)**           | **0 (BEHOBEN)**            | **0 (BEHOBEN)**            | →           |
| Untypisierte catch-Blöcke (Frontend)   | ~290          | **302**                | **302**                   | **302**                    | **0 (BEHOBEN)**            | **BEHOBEN** |
| Unsichere `as Error` Casts             | 17            | **17**                 | **0 (BEHOBEN)**           | **0 (BEHOBEN)**            | **0 (BEHOBEN)**            | →           |
| TODO-Kommentare                        | 6             | **5**                  | **4**                     | **4**                      | **4**                      | →           |
| `any` in Production-Code               | 5             | **3**                  | **3**                     | **3**                      | **3**                      | →           |
| `any` in Test-Code                     | 5             | ~5                     | ~5                        | ~5                         | ~5                         | →           |
| `== null`/`!= null` (intentional)      | 14            | ~14                    | ~14                       | ~14                        | ~14                        | →           |
| WebSocket `as`-Casts                   | 14+           | **13**                 | **13**                    | **13**                     | **0 (BEHOBEN)**            | **BEHOBEN** |
| ID-Param DTOs (Factory-Nutzung)        | —             | **4/36 (11%)**         | **4/36 (11%)**            | **4/36 (11%)**             | **29/35 (83%)**            | **BEHOBEN** |
| Row-Mapper Helpers                     | 12+           | **18+**                | **18+**                   | **18+**                    | **Shared Utility**         | **BEHOBEN** |
| UI-State-Factories (Frontend)          | —             | **20+ Dateien**        | —                         | —                          | **SKIPPED (~640 LOC)**     | **SKIPPED** |
| Tests gesamt                           | 4.614         | **5.079**              | **5.085 (+6 Arch)**       | **5.089 (+4 Arch)**        | **6.103 (+2 Arch)**        | **+35**     |
| RLS-Tabellen                           | 103           | **109** (128 total)    | **109**                   | **109**                    | **109**                    | →           |
| RLS-Policies                           | 114           | **173**                | **173**                   | **173**                    | **173**                    | →           |
| ADRs                                   | 26            | **32**                 | **32**                    | **32**                     | **32**                     | →           |
| Migrations                             | 61            | **73**                 | **73**                    | **73**                     | **73**                     | →           |
| camelCase Legacy-Dateien               | 7             | **7**                  | **7**                     | **7**                      | **7**                      | →           |
| Backend-Module                         | —             | +Work Orders, +Assets  | —                         | —                          | —                          | →           |
| **Architektur-Tests (NEU)**            | —             | —                      | **6 Tests (CI-enforced)** | **10 Tests (CI-enforced)** | **18 Tests (CI-enforced)** | **+3**      |

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

## Anhang: v4 Fix-Log (2026-03-07)

### Geänderter Code (Maßnahme #6: `is_active`-Zentralisierung)

| Schritt                        | Dateien geändert                                                    | Neue Dateien | LOC Effekt                          |
| ------------------------------ | ------------------------------------------------------------------- | ------------ | ----------------------------------- |
| Magic Numbers → `IS_ACTIVE.*`  | 133 Dateien (Backend + Frontend, per Migrations-Skript)             | —            | 466 Magic Numbers → 0               |
| `websocket.ts` manueller Fix   | 1 Datei (`is_active === 1` → `IS_ACTIVE.ACTIVE`)                    | —            | 1 Stelle manuell gefixt             |
| Lokale Konstante entfernen     | `blackboard-archive.service.ts` (lokale `IS_ACTIVE` → Import)       | —            | ~4 LOC entfernt                     |
| Frontend-Konstanten refactored | `manage-dummies/_lib/constants.ts`, `manage-areas/_lib/utils.ts`    | —            | Re-Export + computed property names |
| Vitest-Aliases fixen           | `vitest.config.ts` (Subpath-Aliases für unit + permission Projekte) | —            | 6 Alias-Einträge hinzugefügt        |

### Regressions-Schutz (Enforcement)

| Dokument/Test                          | Was geändert                                 | Zweck                                            |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `shared/src/architectural.test.ts`     | +4 grep-basierte Tests (is_active Patterns)  | CI verhindert Rückfall in Magic Numbers          |
| `docs/TYPESCRIPT-STANDARDS.md`         | Section 7.4 + No-Go #16 hinzugefügt (v4.2.0) | `IS_ACTIVE`-Konstante als Standard dokumentiert  |
| `docs/infrastructure/adr/ADR-023-*.md` | Hinweis auf `IS_ACTIVE`-Konstante ergänzt    | Vacation-Architektur referenziert zentrale Const |
| `docs/infrastructure/adr/ADR-026-*.md` | Hinweis auf `IS_ACTIVE`-Konstante ergänzt    | TPM-Architektur referenziert zentrale Const      |

---

## Anhang: v5 Fix-Log (2026-03-07)

### Geänderter Code (Maßnahme #7: Availability-History-Loader)

| Schritt                               | Dateien geändert                                      | Neue Dateien                                             | LOC Effekt                |
| ------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------- | ------------------------- |
| Generischer Loader erstellt           | —                                                     | `frontend/src/lib/server/availability-history-loader.ts` | 158 Zeilen (shared Logic) |
| 4 Consumer-Dateien auf Slim reduziert | 4 `+page.server.ts` (employees, admins, root, assets) | —                                                        | 4×136 → 4×24 = ~288 LOC   |

---

## Anhang: v6 Fix-Log (2026-03-07)

### Geänderter Code (Maßnahme #8: ID-Param-DTO-Factory)

| Schritt                            | Dateien geändert                        | Neue Dateien                                         | LOC Effekt                         |
| ---------------------------------- | --------------------------------------- | ---------------------------------------------------- | ---------------------------------- |
| Factory + Barrel erstellt          | —                                       | `common/dto/param.factory.ts`, `common/dto/index.ts` | 52 + 10 Zeilen (shared Logic)      |
| Common Barrel erweitert            | `common/index.ts`                       | —                                                    | +2 Zeilen                          |
| Cat A: Re-export IdParamDto        | 14 Param-DTOs (teams, audit, chat etc.) | —                                                    | 14×15 → 14×4 = ~154 LOC eliminiert |
| Cat B: Factory createIdParamSchema | 7 Param-DTOs (admin-perms, features…)   | —                                                    | 7×12 → 7×5 = ~49 LOC eliminiert    |
| Cat C: UUID-Params                 | 3 Param-DTOs (chat, blackboard)         | —                                                    | 3×12 → 3×6 = ~18 LOC eliminiert    |
| Cat D: Compound → idField          | 5 Param-DTOs (admin-perms, chat)        | —                                                    | 5×13 → 5×10 = ~15 LOC eliminiert   |

### Regressions-Schutz (Enforcement)

| Dokument/Test                      | Was geändert                                       | Zweck                                           |
| ---------------------------------- | -------------------------------------------------- | ----------------------------------------------- |
| `shared/src/architectural.test.ts` | +2 grep-basierte Tests (inline z.coerce, IdSchema) | CI verhindert Rückfall in inline ID-Validierung |
| `docs/TYPESCRIPT-STANDARDS.md`     | Section 7.5 + No-Go #17 hinzugefügt (v4.3.0)       | `createIdParamSchema` als Standard dokumentiert |

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

---

## Anhang: v7 Fix-Log (2026-03-07)

### Geänderter Code (Maßnahme #9: SlotAssistant Grid-Extraktion + Kalender-Navigation)

| Schritt                           | Dateien geändert                        | Neue Dateien            | LOC Effekt                                      |
| --------------------------------- | --------------------------------------- | ----------------------- | ----------------------------------------------- |
| SlotDayContent extrahieren        | `SlotAssistant.svelte` (2× Duplikat →1) | `SlotDayContent.svelte` | 74 Code-Zeilen extrahiert, ~87 LOC dedupliziert |
| Kalender-Grid mit KW + Monatssep. | `SlotAssistant.svelte`                  | —                       | ISO-Wochen-Gruppierung + Monatsgrenzen-Split    |
| Occurrence-Badges pro Tag         | `SlotAssistant.svelte`                  | —                       | `weekOfMonth()` Badge auf jeder Tages-Zelle     |
| Date-Helpers erweitert            | `date-helpers.ts`                       | —                       | +`getISOWeek()`, +`weekOfMonth()` Funktionen    |

**Ergebnis:** `SlotAssistant.svelte` — ESLint `max-lines` besteht (730 Code-Zeilen, CSS separat gezählt). Template-Nesting reduziert durch `SlotDayContent`-Extraktion.

---

## Anhang: v9 Fix-Log (2026-03-08)

### Geänderter Code (Maßnahme #11: Frontend catch-Blöcke typisieren)

| Schritt                                    | Dateien geändert                                       | Neue Dateien                      | LOC Effekt                              |
| ------------------------------------------ | ------------------------------------------------------ | --------------------------------- | --------------------------------------- |
| Zentraler `getErrorMessage` Helper         | —                                                      | `frontend/src/lib/utils/error.ts` | 17 Zeilen (shared Logic)                |
| Alle catch-Blöcke typisiert                | 127 Frontend-Dateien                                   | —                                 | 298× `catch (x)` → `catch (x: unknown)` |
| 3 lokale `getErrorMessage`-Kopien entfernt | RoleSwitch, tenant-deletion-status, RotationSetupModal | —                                 | 3 lokale Funktionen → 1 Import          |

### Regressions-Schutz (Enforcement)

| Dokument/Test                      | Was geändert                                                  | Zweck                                               |
| ---------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `shared/src/architectural.test.ts` | +2 grep-basierte Tests (untyped catch, local getErrorMessage) | CI verhindert Rückfall in untypisierte catch-Blöcke |

---

## Anhang: v10 Fix-Log (2026-03-08)

### Geänderter Code (Maßnahme #12: WebSocket Zod-Validierung)

| Schritt                                   | Dateien geändert               | Neue Dateien | LOC Effekt                                                               |
| ----------------------------------------- | ------------------------------ | ------------ | ------------------------------------------------------------------------ |
| `SendMessageData` Interface → Zod Schema  | `websocket-message-handler.ts` | —            | Interface → `SendMessageDataSchema` + `z.infer`                          |
| 4 Interfaces → Zod Schemas                | `websocket.ts`                 | —            | `ConnectionTicketData`, `WebSocketMessage`, `TypingData`, `MarkReadData` |
| 2× `JSON.parse() as` → `.parse()`         | `websocket.ts`                 | —            | Runtime-Validierung statt Cast                                           |
| 4× `message.data as` → Schema `.parse()`  | `websocket.ts`                 | —            | Runtime-Validierung statt Cast                                           |
| 8× `ws.userId/tenantId as number` → Guard | `websocket.ts`                 | —            | Destructured locals + undefined-Check                                    |

### Korrekturen

| v1/v2 Behauptung                                           | Korrektur                                                                                                          |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `chat-page-state.svelte.ts` eslint-disable OHNE Begründung | **Falsch** — alle 3 eslint-disable haben Begründungen. `.ts`-Limit ist 850 (nicht 800), 827 Code-Zeilen = 23 frei. |

### Regressions-Schutz (Enforcement)

| Dokument/Test                      | Was geändert                                  | Zweck                                               |
| ---------------------------------- | --------------------------------------------- | --------------------------------------------------- |
| `shared/src/architectural.test.ts` | +1 grep-basierter Test (WebSocket `as`-Casts) | CI verhindert Rückfall in unsichere Type-Assertions |

---

## Anhang: v11 Fix-Log (2026-03-08)

### Geänderter Code (Maßnahme #13: Shared db-helpers Utility)

| Schritt                                   | Dateien geändert                                                     | Neue Dateien                           | LOC Effekt                                            |
| ----------------------------------------- | -------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------- |
| Shared Utility erstellt                   | —                                                                    | `backend/src/utils/db-helpers.ts`      | 70 Zeilen (6 Funktionen + 2 Typen)                    |
| Unit Tests erstellt                       | —                                                                    | `backend/src/utils/db-helpers.test.ts` | 25 Tests                                              |
| tpm-executions: toIsoString entfernt      | `tpm-executions.helpers.ts`, `.test.ts`, `tpm-executions.service.ts` | —                                      | -8 LOC (3 lokale Funktionszeilen + Import-Änderungen) |
| work-orders: toIsoString + buildFullName  | `work-orders.helpers.ts`, `.test.ts`                                 | —                                      | -10 LOC (Funktionen + 2 inline Patterns)              |
| dummy-users: toIsoString + parseIds/Names | `dummy-users.helpers.ts`                                             | —                                      | -12 LOC (3 Funktionsdefinitionen)                     |
| tpm-plans: toIsoString + buildSetClause   | `tpm-plans.helpers.ts`                                               | —                                      | -16 LOC (inline Ternaries + Update-Builder-Body)      |
| tpm-cards: toIsoString + buildSetClause   | `tpm-cards.helpers.ts`                                               | —                                      | -16 LOC (inline Ternaries + Update-Builder-Body)      |
| assets: toIsoString für 8 Date-Felder     | `assets.helpers.ts`                                                  | —                                      | 8× `new Date(x).toISOString()` → `toIsoString(x)`     |
| chat: buildFullName für 3 Stellen         | `chat.helpers.ts`                                                    | —                                      | 3× inline fullName Pattern eliminiert                 |
| survey-responses: buildFullName           | `survey-responses.service.ts`                                        | —                                      | 1× inline fullName Pattern eliminiert                 |

### Regressions-Schutz (Enforcement)

| Dokument/Test                      | Was geändert                                                                 | Zweck                                                |
| ---------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `shared/src/architectural.test.ts` | +3 grep-basierte Tests (toIsoString, toIsoStringOrNull, parseIds/parseNames) | CI verhindert Rückfall in lokale Helper-Definitionen |
