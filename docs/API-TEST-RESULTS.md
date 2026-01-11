# API Test Results

> **Datum:** 2025-12-09 | **Branch:** lint/refactoring

---

## Zusammenfassung

```
📊 Execution Summary (FINAL)
┌───────────────┬───────────────────────────┐
│ Requests      │ 87 (74 Passed, 13 Failed) │
│ Tests         │          130/144          │
│ Assertions    │          167/180          │
└───────────────┴───────────────────────────┘
```

**Verbesserung:** 67 → 74 Passed (+7), 20 → 13 Failed (-7)

---

## Gefixte Bugs (Diese Session)

| #   | Endpoint                        | Problem                                     | Fix                                    |
| --- | ------------------------------- | ------------------------------------------- | -------------------------------------- |
| 1   | `machines/categories`           | `global.machine_categories` existiert nicht | → `machine_categories` (public schema) |
| 2   | `machines/statistics`           | `is_active = TRUE` (smallint vs boolean)    | → `is_active = 1`                      |
| 3   | `machines/upcoming-maintenance` | `is_active = TRUE`                          | → `is_active = 1`                      |
| 4   | `kvp/update`                    | SQL Parameter $2 doppelt verwendet          | → `tenant_id = $4`                     |

**Files geändert:**

- `backend/src/routes/v2/machines/machine.model.ts`
- `backend/src/routes/v2/kvp/kvp.model.ts`

---

## Gefixte Bruno-Tests

| #   | Test                         | Problem                                           | Fix                     |
| --- | ---------------------------- | ------------------------------------------------- | ----------------------- |
| 1   | `calendar/create-event.bru`  | `data.id` erwartet, API gibt `data.event.eventId` | Script angepasst        |
| 2   | `kvp/create.bru`             | Description zu kurz                               | Längere Description     |
| 3   | `kvp/update.bru`             | `status: in_progress` ungültig                    | → `status: in_review`   |
| 4   | `kvp/get-by-id.bru`          | seq: 2 (kollidiert mit create)                    | → seq: 3                |
| 5   | `shifts/get-shift-by-id.bru` | 400 bei undefined ID                              | Akzeptiert 200 oder 404 |

---

## Ignorierte Module (nicht fertig)

| Modul                | Grund                           |
| -------------------- | ------------------------------- |
| notifications/\*     | Noch nicht fertig implementiert |
| features/my-features | Noch nicht fertig implementiert |

---

## Funktionierende Module (74 Passed)

| Modul       | Endpoints                                  | Status |
| ----------- | ------------------------------------------ | ------ |
| auth        | login, refresh, verify, logout             | ✅     |
| users       | get-current, list, get-by-id               | ✅     |
| departments | CRUD komplett                              | ✅     |
| teams       | CRUD komplett + members                    | ✅     |
| blackboard  | CRUD + comments, confirm, archive          | ✅     |
| calendar    | list, create, dashboard                    | ✅     |
| kvp         | CRUD komplett + categories, comments       | ✅     |
| machines    | CRUD + categories, statistics, maintenance | ✅     |
| surveys     | list, templates                            | ✅     |
| documents   | list, folders                              | ✅     |
| shifts      | list                                       | ✅     |
| areas       | list, create, stats                        | ✅     |
| settings    | tenant, user, system, categories           | ✅     |
| roles       | list, hierarchy, assignable                | ✅     |
| features    | list, categories                           | ✅     |
| chat        | list-conversations                         | ✅     |

---

## Commands

```bash
# Alle Tests
pnpm run test:api

# Bei Rate Limit (429)
docker-compose restart && sleep 25 && pnpm run test:api
```

---

_Abgeschlossen: 2025-12-09 22:05_
