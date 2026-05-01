# Phase-1 Audit — Server-Driven Pagination

> **Working file.** Created 2026-05-01.
> **Lifecycle:** wird gelöscht nach Phase 1 Close (per Masterplan §1 Step 1.1 Output-Definition).
> **Quelle:** Backend + Frontend Code-Inspektion via Explore-Agent + manuelle Verifikation.
> **Masterplan:** [FEAT_SERVER_DRIVEN_PAGINATION_MASTERPLAN.md](./FEAT_SERVER_DRIVEN_PAGINATION_MASTERPLAN.md)

---

## 1. Synthese-Matrix (12 Backend-Endpoints)

| #   | Endpoint                  | DTO file:line                                                       | extends `PaginationSchema`   | has `?search` | Filter fields                                                                                                                                                  | Gap status                                                 |
| --- | ------------------------- | ------------------------------------------------------------------- | ---------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1   | `GET /users`              | `backend/src/nest/users/dto/list-users-query.dto.ts:20`             | **JA**                       | **JA**        | `role`, `position`, `isActive`, `sortBy`, `sortOrder`                                                                                                          | **OK**                                                     |
| 2   | `GET /approvals`          | `approvals.controller.ts:52` (inline interface, KEINE Zod DTO)      | **NEIN**                     | **NEIN**      | `status`, `addonCode`, `priority`, `page`, `limit`                                                                                                             | **NEEDS-DTO** + **NEEDS-SEARCH**                           |
| 3   | `GET /assets`             | `backend/src/nest/assets/dto/list-assets-query.dto.ts:27`           | **NEIN** (custom)            | **JA**        | `status`, `assetType`, `departmentId`, `teamId`, `needsMaintenance`, `sortBy`, `sortOrder`                                                                     | **NEEDS-PAGINATION**                                       |
| 4   | `GET /kvp/...`            | `backend/src/nest/kvp/dto/query-suggestion.dto.ts:38`               | **JA**                       | **JA**        | `status`, `categoryId`, `customCategoryId`, `priority`, `orgLevel`, `teamId`, `mineOnly`                                                                       | **OK**                                                     |
| 5   | `GET /blackboard/entries` | `backend/src/nest/blackboard/dto/list-entries-query.dto.ts:53`      | **JA**                       | **JA**        | `isActive`, `filter`, `sortBy`, `sortDir`, `priority`                                                                                                          | **OK**                                                     |
| 6   | `GET /work-orders`        | `backend/src/nest/work-orders/dto/list-work-orders-query.dto.ts:23` | **NEIN** (custom)            | **NEIN**      | `status`, `priority`, `sourceType`, `sourceUuid`, `assigneeUuid`, `isActive`, `overdue`                                                                        | **NEEDS-PAGINATION** + **NEEDS-SEARCH**                    |
| 7   | `GET /inventory/items`    | `backend/src/nest/inventory/dto/common.dto.ts:43`                   | **NEIN** (custom default 50) | **JA**        | `listId` (required), `status`                                                                                                                                  | **NEEDS-PAGINATION**                                       |
| 8   | `GET /documents`          | `backend/src/nest/documents/dto/query-documents.dto.ts:23`          | **NEIN** (custom)            | **JA**        | `category`, `accessScope`, `ownerUserId`, `targetTeamId`, `targetDepartmentId`, `salaryYear`, `salaryMonth`, `blackboardEntryId`, `conversationId`, `isActive` | **NEEDS-PAGINATION**                                       |
| 9   | `GET /surveys`            | `backend/src/nest/surveys/dto/query-survey.dto.ts:21`               | **JA**                       | **NEIN**      | `status`, `manage`                                                                                                                                             | **NEEDS-SEARCH**                                           |
| 10  | `GET /tpm/plans`          | `backend/src/nest/tpm/dto/list-plans-query.dto.ts:11`               | **NEIN** (custom)            | **NEIN**      | (keine)                                                                                                                                                        | **NEEDS-PAGINATION** + **NEEDS-SEARCH** + **NEEDS-FILTER** |
| 11  | `GET /tpm/cards`          | `backend/src/nest/tpm/dto/list-cards-query.dto.ts:20`               | **NEIN** (custom)            | **NEIN**      | `assetUuid`, `planUuid`, `status`, `intervalType`, `cardRole`, `cardCategory`                                                                                  | **NEEDS-PAGINATION** + **NEEDS-SEARCH**                    |
| 12  | `GET /dummy-users`        | `backend/src/nest/dummy-users/dto/list-dummy-users-query.dto.ts:11` | **NEIN** (custom)            | **JA**        | `isActive`                                                                                                                                                     | **NEEDS-PAGINATION** + **SHAPE-FIX** (Phase 3)             |

---

## 2. Aggregations

### 2.1 OK — keine Backend-Arbeit nötig (3 Endpoints)

- `/users` — vollständig, search + filters + PaginationSchema vorhanden
- `/kvp/...` — vollständig
- `/blackboard/entries` — vollständig

### 2.2 NEEDS-DTO (1 Endpoint)

- **`/approvals`** — `approvals.controller.ts:52` definiert eine **inline TypeScript interface** statt Zod DTO. Keine Validierung, keine `createZodDto`-Integration. Muss zu vollständiger Zod DTO migriert werden, die `PaginationSchema` extended + `search` hinzufügt.

### 2.3 NEEDS-PAGINATION (7 Endpoints — Code-Duplication)

Alle 7 haben funktional pagination via custom `page`/`limit` Felder, aber EXTENDEN nicht `PaginationSchema` (`backend/src/schemas/common.schema.ts`). Konsequenz: jede Default-Änderung müsste an 7 Stellen koordiniert werden.

- `/assets` (default limit=20)
- `/work-orders` (default 20, max 500 — anomal hoch)
- `/inventory/items` (default 50, max 100 — anomal hoch)
- `/documents` (default custom)
- `/tpm/plans` (default custom)
- `/tpm/cards` (default custom)
- `/dummy-users` (default custom)

**Default-Limit-Inkonsistenz** (für Phase 1.2 Design-Entscheidung):

| Endpoint           | Current default | PaginationSchema default | Inkonsistenz? |
| ------------------ | --------------- | ------------------------ | ------------- |
| `/users`           | 10              | 10                       | nein          |
| `/assets`          | 20              | 10                       | **ja**        |
| `/work-orders`     | 20              | 10                       | **ja**        |
| `/inventory/items` | 50              | 10                       | **ja**        |
| `/dummy-users`     | 20              | 10                       | **ja**        |
| `/tpm/plans`       | (TBD)           | 10                       | TBD           |
| `/tpm/cards`       | (TBD)           | 10                       | TBD           |

### 2.4 NEEDS-SEARCH (5 Endpoints)

- `/approvals`
- `/work-orders`
- `/surveys`
- `/tpm/plans`
- `/tpm/cards`

### 2.5 NEEDS-FILTER (1 Endpoint)

- `/tpm/plans` — überhaupt KEINE Filterfelder. Nur `page`/`limit`. FE konsumiert das? (TBD bei Phase 4.11)

---

## 3. Picker-Endpoints (6 — alle nutzen `/users` mit verschiedenen Params)

Per Masterplan §0.2.1 Audit-Befunde + Frontend-Inspektion bestätigt:

| #   | Picker          | File:line                               | URL Query-Params                                  | has `&limit=N` | Konsumenten-Component | Status                      |
| --- | --------------- | --------------------------------------- | ------------------------------------------------- | -------------- | --------------------- | --------------------------- |
| 1   | Area Lead Admin | `manage-areas/+page.server.ts:45`       | `?role=admin&isActive=1&position=area_lead`       | **NEIN**       | Dropdown              | B2 confirmed (default 10)   |
| 2   | Area Lead Root  | `manage-areas/+page.server.ts:46`       | `?role=root&isActive=1&position=area_lead`        | **NEIN**       | Dropdown              | B2 confirmed (default 10)   |
| 3   | Dept Lead Admin | `manage-departments/+page.server.ts:49` | `?role=admin&isActive=1&position=department_lead` | **NEIN**       | Dropdown              | B2 confirmed (default 10)   |
| 4   | Dept Lead Root  | `manage-departments/+page.server.ts:50` | `?role=root&isActive=1&position=department_lead`  | **NEIN**       | Dropdown              | B2 confirmed (default 10)   |
| 5   | Team Lead       | `manage-teams/+page.server.ts:49`       | `?isActive=1&position=team_lead`                  | **NEIN**       | Dropdown              | B2 confirmed (default 10)   |
| 6   | Employee-Picker | `manage-teams/+page.server.ts:50`       | `?role=employee` (KEIN `isActive=1`)              | **NEIN**       | Modal                 | B3 confirmed (mixed status) |

**Wichtige Implikation für Phase 4.12:** `/users` Endpoint unterstützt bereits `?search=` (Endpoint #1 = OK). Phase 4.12 PickerTypeahead Component kann sofort `?search=<term>&limit=20` an `/users` schicken — KEINE Backend-Arbeit nötig für die Picker selbst.

---

## 4. `dummy-users` Response-Shape Verifikation (für Phase 3)

**Backend:**

- Controller: `backend/src/nest/dummy-users/dummy-users.controller.ts:45-52` deklariert Return-Type `Promise<PaginatedDummyUsers>`
- Type: `backend/src/nest/dummy-users/dummy-users.types.ts:76-81`:
  ```typescript
  export interface PaginatedDummyUsers {
    items: DummyUser[];
    total: number;
    page: number;
    pageSize: number;
  }
  ```

**Frontend Erwartung:**

- `frontend/src/routes/(app)/(root)/manage-dummies/+page.server.ts:16-29` `extractDummies()` liest `data.items`, `data.total`, `data.pageSize`

**Fund:** Backend Response-Shape passt zur Frontend-Erwartung (sie verstehen sich), aber **beide weichen von ADR-007 envelope ab**. ADR-007 erfordert `{success, data, meta:{pagination:{page,limit,total,totalPages}}, timestamp}`. Hier wird `data` direkt zur custom `PaginatedDummyUsers` Shape — entweder umgeht der Service `ResponseInterceptor` aktiv, oder Interceptor ist für diese Route deaktiviert. **Phase 3 löst das mit kompletter Migration auf ADR-007 Envelope.**

---

## 5. Special Findings

### 5.1 Surveys 3-Card-Sections + Templates

`manage-surveys/+page.server.ts:42-60` bestätigt: alle 3 Status-Sections (`draft`, `active`, `completed`) konsumieren denselben `/surveys?limit=100` Call und filtern client-side. Templates kommen separat. Phase 4.10 muss entscheiden: drei separate paginierte Calls (mit `?status=` server-side) ODER eine Section-aware Strategie (per-section `?status=&page=`). **Empfehlung für Phase 4.10:** drei separate Calls mit `?status=draft|active|completed&page=N` — pro Section eigene URL-State (z.B. `?draftPage=2&activePage=1`).

### 5.2 work-orders SSR-Hard-Coding

`work-orders/+page.server.ts:44` hardcodes `?page=1&limit=20` — gleiche Falle wie `manage-dummies`. Phase 4.7 muss URL-Lesen einbauen.

### 5.3 TPM SSR-Hard-Coding

`tpm/+page.server.ts:56` hardcodes `?page=1&limit=20`. Gleiche Falle wie work-orders. Phase 4.11 fix.

### 5.4 documents-explorer Custom Shape

FE konsumiert `PaginatedDocumentsResponse` Shape (nicht ADR-007 envelope). Vermutlich gleicher Anti-Pattern wie `dummy-users`. Phase 4.9 muss verifizieren ob Backend-Controller dieselbe non-canonical Shape liefert oder ob FE sich verbiegt. **Backlog-Item für Phase 4.9 (nicht Phase 1.2).**

### 5.5 inventory/lists kein Pagination

`backend/src/nest/inventory/dto/lists-query.dto.ts:14` (`ListsQuerySchema`) hat NUR `tagIds`-Filter, KEINE `page`/`limit`/`search`. Endpoint liefert alle Lists für den Tenant. **Akzeptabel für V1** — Tenant hat typisch <50 Lists.

---

## 6. Backlog für Phase 1.2 (Close gaps)

Sortiert nach Aufwand (klein → groß):

| #   | Task                                                                                                                                                                                      | Aufwand | Endpoints | Begründung                                                                                                              |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | Add `search` to `/surveys` Query-DTO + service WHERE-Klausel                                                                                                                              | S       | 1         | Standalone, kein Refactor                                                                                               |
| 2   | Add `search` to `/work-orders` Query-DTO + service                                                                                                                                        | S       | 1         | Standalone                                                                                                              |
| 3   | Add `search` to `/tpm/plans` + `/tpm/cards` Query-DTOs + services                                                                                                                         | S       | 2         | Standalone, gleiche Session                                                                                             |
| 4   | Refactor `/assets`, `/work-orders`, `/documents`, `/tpm/plans`, `/tpm/cards`, `/inventory/items`, `/dummy-users` to extends `PaginationSchema` (mit `.extend({...})` für custom defaults) | M       | 7         | Code-Duplication-Eliminierung. Standardisiert page/limit-Validierung. Defaults via `.extend()` override beibehalten.    |
| 5   | Migrate `/approvals` von inline interface zu Zod DTO (extends `PaginationSchema` + `search`)                                                                                              | M       | 1         | Größte Arbeit für einen Endpoint. Auch Service muss DTO statt Interface konsumieren. **Empfehlung: in eigene Session.** |

**Geschätzter Phase-1.2-Umfang:** 1 Session reicht für Tasks 1–4. Task 5 (`/approvals` Refactor) verdient eine eigene Session — ist auch der größte Korrekturaufwand und bringt das größte Risiko (DTO-Wechsel kann Service-Signatur brechen).

**Vorschlag:** Phase 1.2 → **2 Sessions statt 1**:

- 1.2a: Tasks 1–4 (search-Felder + PaginationSchema-Refactor)
- 1.2b: Task 5 (`/approvals` DTO-Migration)

→ Masterplan-Sessions-Count müsste ggf. 15 → 16 angepasst werden, wenn dieser Vorschlag akzeptiert wird.

---

## 7. Open Design-Decisions für Phase 1.2

| #   | Question                                                                                       | Empfehlung                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Sollen alle Endpoints denselben default `limit=10` haben, oder per-Endpoint Override behalten? | **Override behalten** via `PaginationSchema.extend({ limit: ... })`. Inventory mit 50 ist Domain-spezifisch sinnvoll.                          |
| D2  | Soll `/work-orders` max-limit 500 reduziert werden auf PaginationSchema-Standard (100)?        | **Ja** — 500 ist anomal hoch, kein Use-Case bekannt. Reduzieren auf 100 (Phase 1.2).                                                           |
| D3  | Search-Feld-Konvention: `z.string().trim().min(1).optional()` ODER `.max(100).optional()`?     | **`.trim().max(100).optional()`** — entspricht KVP/Blackboard-Pattern, kein min(1) (leerer String soll als "kein search" interpretiert werden) |
| D4  | `/approvals` DTO-Migration in Phase 1.2 oder Phase 4.3 verschoben?                             | **Phase 1.2** (kostet eine eigene Session) — sonst muss Phase 4.3 zwei Refactor-Stränge gleichzeitig stemmen.                                  |

---

**Phase 1.1 Status: COMPLETE.** Alle 12 Endpoints + 6 Picker auditiert. Gaps dokumentiert. Phase 1.2 Backlog priorisiert.
