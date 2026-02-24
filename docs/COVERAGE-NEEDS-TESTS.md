# Coverage: Dateien die Tests brauchen

> Stand: 2026-02-24 | Status: **ABGESCHLOSSEN** | Ziel: 85%+

---

## Priorität 1 — Business-Critical

| #   | Datei                                                        | Vorher | Nachher            | Status |
| --- | ------------------------------------------------------------ | ------ | ------------------ | ------ |
| 1   | `backend/src/nest/vacation/vacation-validation.service.ts`   | 0%     | 98% stmts, 94% br  | DONE   |
| 2   | `backend/src/nest/vacation/vacation-notification.service.ts` | 0%     | 97% stmts, 89% br  | DONE   |
| 3   | `backend/src/nest/vacation/vacation-settings.service.ts`     | 7.77%  | 100% stmts, 96% br | DONE   |

## Priorität 2 — High Value

| #   | Datei                                                             | Vorher | Nachher            | Status  |
| --- | ----------------------------------------------------------------- | ------ | ------------------ | ------- |
| 4   | `backend/src/nest/common/interceptors/audit-trail.interceptor.ts` | ~0%    | 94% stmts, 88% br  | DONE    |
| 5   | `backend/src/nest/kvp/kvp-lifecycle.service.ts`                   | 0%     | 100% stmts, 95% br | DONE    |
| 6   | `backend/src/websocket-message-handler.ts`                        | 0%     | —                  | SKIPPED |

## Priorität 3 — Quick Wins

| #   | Datei                                     | Vorher | Nachher             | Status |
| --- | ----------------------------------------- | ------ | ------------------- | ------ |
| 7   | `backend/src/nest/chat/presence.store.ts` | 0%     | 100% stmts, 100% fn | DONE   |

## Priorität 4 — Unterdurchschnittlich (30–50% Coverage)

| #   | Datei/Verzeichnis                               | Vorher | Nachher            | Status |
| --- | ----------------------------------------------- | ------ | ------------------ | ------ |
| 8   | `backend/src/nest/common/audit/`                | 32.63% | 99% stmts, 96% br  | DONE   |
| 9   | `backend/src/nest/documents/` (service)         | 33.33% | 99% stmts, 92% br  | DONE   |
| 10  | `backend/src/nest/admin-permissions/` (service) | 46.09% | 98% stmts, 89% br  | DONE   |
| 11  | `backend/src/nest/signup/` (service)            | 46.59% | 100% stmts, 92% br | DONE   |
| 12  | `backend/src/nest/teams/` (access service)      | ~47%   | 99% stmts, 93% br  | DONE   |

---

## Definition of Done

- [x] Test-Datei co-located: `source.service.ts` neben `source.service.test.ts`
- [x] AAA-Pattern: Arrange-Act-Assert, ein Konzept pro `it()`
- [x] DB-Calls via `vi.mock()` gemockt (kein DI-Container)
- [x] Edge Cases abgedeckt (leere Inputs, Grenzwerte, Fehlerpfade)
- [x] 0 ESLint-Fehler, 0 TypeScript-Fehler
- [x] Coverage der getesteten Datei > 80%
- [x] Alle bestehenden Tests bleiben grün
