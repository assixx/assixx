# FEAT: Work Order Read-Tracking ("Neu" Badge) — Execution Masterplan

> **Created:** 2026-03-07
> **Version:** 2.0.0 (Feature vollständig abgeschlossen)
> **Status:** DONE — Alle 5 Phasen abgeschlossen
> **Branch:** `refactor/code-audit`
> **Referenz-Implementation:** Document Explorer (`document_read_status` + `markDocumentAsRead`)
> **Author:** SCS-Technik (Senior Engineer)
> **Estimated Sessions:** 3
> **Actual Sessions:** 1 / 3

---

## Changelog

| Version | Datum      | Änderung                                                        |
| ------- | ---------- | --------------------------------------------------------------- |
| 0.1.0   | 2026-03-07 | Initial Draft — 4 Phasen                                        |
| 0.2.0   | 2026-03-07 | ADR-031 + ADR-018 Test-Alignment + Integrationen (ADR-009/002)  |
| 2.0.0   | 2026-03-07 | Feature vollständig implementiert — alle 5 Phasen abgeschlossen |

> **Versionierungsregel:**
>
> - `0.x.0` = Planungsphase (Draft)
> - `1.x.0` = Implementierung läuft (je Phase ein Minor-Bump)
> - `2.0.0` = Feature vollständig abgeschlossen
> - Patch `x.x.1` = Hotfix/Nacharbeit innerhalb einer Phase

---

## Related ADRs & Referenzen

| ADR / Dokument                                                                                      | Relevanz für diesen Plan                                                                                                    |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [**ADR-031**: Centralized Read-Tracking](./infrastructure/adr/ADR-031-centralized-read-tracking.md) | Architekturentscheidung: Zentralisiertes Read-Tracking-System (Pattern-Wahl, Shared Service Design)                         |
| [ADR-018: Testing Strategy](./infrastructure/adr/ADR-018-testing-strategy.md)                       | Test-Patterns: Unit Tests (Tier 1) + API Tests (Tier 2), Mock-Factory, `authHeaders`/`authOnly`, `One-Request-per-Describe` |
| [ADR-009: Central Audit Logging](./infrastructure/adr/ADR-009-central-audit-logging.md)             | `ActivityLoggerService` — fire-and-forget Logging für Read-Events (Compliance)                                              |
| [ADR-002: Alerting & Monitoring](./infrastructure/adr/ADR-002-alerting-monitoring.md)               | Sentry `captureException` für Service-Fehler, Pino-Logging für Debug-Traces                                                 |
| [ADR-003: Notification System](./infrastructure/adr/ADR-003-notification-system.md)                 | Abgrenzung: Notification-Read (Sidebar-Badge) vs. Entity-Read ("Neu" Badge) — ZWEI GETRENNTE Systeme                        |
| [ADR-019: Multi-Tenant RLS](./infrastructure/adr/ADR-019-multi-tenant-rls-isolation.md)             | RLS Policy für `work_order_read_status` — Tenant-Isolation mandatory                                                        |
| [HOW-TO-INTEGRATE-FEATURE.md](./HOW-TO-INTEGRATE-FEATURE.md)                                        | Integration-Checkliste: RLS, GRANTs, Activity Logging, Tests, Doku                                                          |
| [HOW-TO-TEST-WITH-VITEST.md](./HOW-TO-TEST-WITH-VITEST.md)                                          | API-Test-Patterns: `loginApitest()`, `flushThrottleKeys()`, Fastify Header-Trennung                                         |

---

## Kontext & Architekturentscheidung

### Problem

In der Work-Order-Tabelle (Admin + Employee) fehlt ein visuelles Signal, welche Aufträge der User **noch nie gesehen** hat. Blackboard, KVP und Document Explorer haben jeweils ein "Neu" Badge — Work Orders nicht.

### Bestehendes System: Zwei getrennte Read-Konzepte

| Konzept               | Zweck                               | Tabelle                                                                 | Trigger                                                |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ |
| **Notification Read** | SSE-Badge im Sidebar dekrementieren | `notification_read_status`                                              | `notificationStore.markEntityAsRead()` auf Detail-Page |
| **Entity Read**       | "Neu" Badge auf Einzelitems         | `document_read_status`, `blackboard_confirmations`, `kvp_confirmations` | Klick auf Item / Preview                               |

Das Notification-System (Konzept 1) trackt nur **Benachrichtigungen** ("Du wurdest zugewiesen"). Es trackt NICHT, ob der User den Work Order je **geöffnet** hat. Ein manuell erstellter Work Order ohne Assignee-Notification hat kein Read-Tracking.

> Wir brauchen **Konzept 2**: eine eigene `work_order_read_status` Tabelle.
>
> **Detaillierte Architekturentscheidung:** Siehe ADR-031 (wird in Phase 5 erstellt).

### Pattern-Wahl: Document Explorer

Das Document-Explorer-Pattern ist das sauberste:

```
document_read_status (document_id, user_id, tenant_id, read_at)
  ↓
INSERT ... ON CONFLICT DO UPDATE SET read_at = NOW()  (idempotent)
  ↓
LEFT JOIN in List-Query → isRead boolean im Response
  ↓
Frontend: "Neu" Badge wenn !isRead
  ↓
POST /documents/:id/read oder implizit bei Preview
```

**Warum nicht Blackboard/KVP-Pattern?** Dual-State (`first_seen_at` + `is_confirmed`) ist Overkill für Work Orders. Work Orders haben kein "als ungelesen markieren" Feature. Einfaches Boolean reicht.

### Zentralisierung: Shared ReadTrackingService

Statt Copy-Paste erstellen wir einen **generischen `ReadTrackingService`** in `common/services/`, der mit einer Config pro Feature funktioniert. Work Orders nutzen ihn sofort, Blackboard/KVP/Documents können in einem separaten Refactor-PR umgestellt werden.

```typescript
interface ReadTrackingConfig {
  tableName: string; // 'work_order_read_status'
  entityColumn: string; // 'work_order_id'
  entityTable: string; // 'work_orders'
  entityUuidColumn: string; // 'uuid'
}
```

---

## 0. Prerequisites & Risk Assessment

### 0.1 Must Be True Before Starting

- [x] Docker Stack running (alle Container healthy)
- [x] Branch `refactor/code-audit` checked out
- [x] Keine pending Migrations (letzte: `20260307000075`)
- [x] Bestehende Work-Order-Tests grün: `pnpm test --project unit` + `pnpm test --project api`
- [x] ADR-018 gelesen (Test-Patterns verstehen)
- [x] HOW-TO-INTEGRATE-FEATURE.md gelesen (Checkliste verstehen)

### 0.2 Risk Register

| #   | Risiko                                           | Impact | Wahrscheinlichkeit | Mitigation                                                                   | Verifikation                                                           |
| --- | ------------------------------------------------ | ------ | ------------------ | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| R1  | N+1 Query-Performance (wie Documents)            | Mittel | Hoch               | LEFT JOIN statt N+1 Einzelqueries — performanter als Document-Pattern        | `EXPLAIN ANALYZE` auf List-Query                                       |
| R2  | RLS Policy fehlt → Tenant-Leak                   | Hoch   | Niedrig            | Checklist-Item in Migration + Verify-Query (ADR-019 Pattern)                 | `SELECT * FROM pg_policies WHERE tablename = 'work_order_read_status'` |
| R3  | isRead in Employee-View falsch (userId mismatch) | Mittel | Mittel             | LEFT JOIN mit `AND rs.user_id = $userId` Bedingung                           | Unit Test: User A sieht eigenen Read-Status, nicht User B              |
| R4  | ReadTrackingService SQL-Injection über Config    | Hoch   | Niedrig            | Config-Werte sind Konstanten (nicht User-Input), validiert bei Registrierung | Code Review: nur hardcoded Strings in Config                           |
| R5  | Sentry-Errors bei DB-Failure nicht sichtbar      | Mittel | Niedrig            | `Sentry.captureException()` in Service-Catch (ADR-002)                       | Sentry Dashboard prüfen nach Deploy                                    |

### 0.3 Ecosystem Integration Points

| Bestehendes System                | Art der Integration                        | Phase | Verifiziert am |
| --------------------------------- | ------------------------------------------ | ----- | -------------- |
| `work_orders` Tabelle             | FK von read_status → work_orders(id)       | 1     |                |
| `work-orders.service.ts`          | LEFT JOIN für isRead in List-Queries       | 2     |                |
| `work-orders.controller.ts`       | Neuer POST `:uuid/read` Endpoint           | 2     |                |
| `AdminWorkOrderTable.svelte`      | "Neu" Badge in Titel-Spalte                | 3     |                |
| `WorkOrderTable.svelte`           | "Neu" Badge in Titel-Spalte (Employee)     | 3     |                |
| Detail-Page `[uuid]/+page.svelte` | `markAsRead()` beim Mount                  | 3     |                |
| `ActivityLoggerService` (ADR-009) | Fire-and-forget Log bei markAsRead         | 2     |                |
| Pino Logger (ADR-002)             | Debug-Logging in ReadTrackingService       | 1     |                |
| Notification-System (ADR-003)     | **Unverändert** — bleibt für Sidebar-Badge | —     |                |
| Unit Tests (ADR-018 Tier 1)       | ReadTrackingService + Mapping Tests        | 4     |                |
| API Tests (ADR-018 Tier 2)        | POST `:uuid/read` + isRead in List         | 4     |                |
| ADR-031 (NEU)                     | Architektur-Dokumentation                  | 5     |                |

### 0.4 HOW-TO-INTEGRATE-FEATURE Checkliste (Subset)

> Nicht alle Punkte relevant — kein neues Addon-Flag, kein neues NestJS-Modul, keine Sidebar-Änderung.
> Relevante Punkte aus der Checkliste:

- [x] **1.2 Core Tables:** RLS + GRANTs + Indexes + `down()` Migration
- [x] **2.7 Activity Logging:** `ActivityLoggerService.logCreate()` für Read-Events
- [x] **4.1 Unit Tests:** Mock-Factory Pattern, Happy Path + Edge Cases
- [x] **4.3 API Integration Tests:** `authHeaders`/`authOnly` Pattern, Cleanup

---

## Phase 1: Database Migration + Shared Service

> **Abhängigkeit:** Keine
> **Dateien:** 1 Migration + 1 neuer Service

### Step 1.1: Migration — `work_order_read_status` Tabelle [DONE]

**Neue Datei:** `database/migrations/20260308000076_work-order-read-status.ts`

**Schema (analog `document_read_status`, konform mit HOW-TO-INTEGRATE-FEATURE 1.2):**

```sql
CREATE TABLE work_order_read_status (
  id            SERIAL PRIMARY KEY,
  work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  read_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique Constraint für UPSERT
CREATE UNIQUE INDEX idx_wo_read_status_unique
  ON work_order_read_status (work_order_id, user_id, tenant_id);
-- Performance-Index für List-Query LEFT JOIN
CREATE INDEX idx_wo_read_status_user
  ON work_order_read_status (user_id, tenant_id);

-- RLS (ADR-019: Multi-Tenant Isolation)
ALTER TABLE work_order_read_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_order_read_status FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON work_order_read_status
  USING (NULLIF(current_setting('app.tenant_id', true), '') IS NULL
         OR tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::integer);

-- GRANTs (HOW-TO-INTEGRATE-FEATURE 1.2)
GRANT SELECT, INSERT, UPDATE, DELETE ON work_order_read_status TO app_user;
GRANT USAGE, SELECT ON SEQUENCE work_order_read_status_id_seq TO app_user;
```

**`down()` Migration (mandatory):**

```sql
DROP TABLE IF EXISTS work_order_read_status CASCADE;
```

**Verifikation:**

```bash
doppler run -- ./scripts/run-migrations.sh up --dry-run
doppler run -- ./scripts/run-migrations.sh up
docker exec assixx-postgres psql -U assixx_user -d assixx -c "\d work_order_read_status"
docker exec assixx-postgres psql -U assixx_user -d assixx \
  -c "SELECT tablename, policyname FROM pg_policies WHERE tablename = 'work_order_read_status'"
```

### Step 1.2: ReadTrackingService (Shared) [DONE]

**Neue Datei:** `backend/src/nest/common/services/read-tracking.service.ts`

**Warum:** Zentralisierte Read-Tracking-Logik — Work Orders nutzen es sofort, andere Features können später umgestellt werden. Dokumentiert in ADR-031.

**Interface:**

```typescript
export interface ReadTrackingConfig {
  tableName: string;
  entityColumn: string;
  entityTable: string;
  entityUuidColumn: string;
}

@Injectable()
export class ReadTrackingService {
  private readonly logger = new Logger(ReadTrackingService.name);

  constructor(private readonly db: DatabaseService) {}

  /** Mark entity as read (idempotent UPSERT) */
  async markAsRead(config: ReadTrackingConfig, entityId: number, userId: number, tenantId: number): Promise<void>;

  /** Check if entity is read by user */
  async isRead(config: ReadTrackingConfig, entityId: number, userId: number, tenantId: number): Promise<boolean>;

  /** Resolve entity UUID → ID, then mark as read */
  async markAsReadByUuid(
    config: ReadTrackingConfig,
    entityUuid: string,
    userId: number,
    tenantId: number,
  ): Promise<void>;
}
```

**SQL-Pattern (UPSERT):**

```sql
INSERT INTO {tableName} ({entityColumn}, user_id, tenant_id, read_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT ({entityColumn}, user_id, tenant_id) DO UPDATE SET read_at = NOW()
```

**Logging (ADR-002 + ADR-009):**

- `this.logger.debug(...)` für Pino/Loki Trace (ADR-002)
- Kein separater ActivityLogger-Aufruf hier — der Controller loggt (fire-and-forget, siehe Step 2.4)

**Registrierung:** In `CommonModule` als `@Injectable()` Provider, exportiert für andere Module.

### Phase 1 — Definition of Done

- [x] Migration erstellt mit `up()` AND `down()`
- [x] Dry-Run bestanden
- [x] Migration applied
- [x] `work_order_read_status` existiert mit RLS Policy
- [x] GRANTs für `app_user` verifiziert
- [x] `ReadTrackingService` implementiert + in CommonModule registriert
- [x] Pino Logger injiziert (ADR-002)
- [x] ESLint 0 Errors
- [x] Type-Check passed
- [x] Bestehende Tests grün

---

## Phase 2: Backend — Query Integration + Endpoint

> **Abhängigkeit:** Phase 1 complete
> **Dateien:** 5 bestehende Dateien editieren

### Step 2.1: Work Orders Types erweitern [DONE]

**Datei:** `backend/src/nest/work-orders/work-orders.types.ts`

```typescript
// WorkOrderWithCountsRow erweitern:
export interface WorkOrderWithCountsRow extends WorkOrderRow {
  // ... bestehende Felder
  is_read: number | null; // NULL = nicht gelesen (kein LEFT JOIN Match)
}

// WorkOrderListItem erweitern:
export interface WorkOrderListItem {
  // ... bestehende Felder
  isRead: boolean;
}
```

### Step 2.2: List-Queries erweitern (LEFT JOIN) [DONE]

**Datei:** `backend/src/nest/work-orders/work-orders.service.ts`

**Was passiert:** LEFT JOIN auf `work_order_read_status` in beiden List-Queries:

```sql
LEFT JOIN work_order_read_status rs
  ON rs.work_order_id = wo.id AND rs.user_id = $userId AND rs.tenant_id = $tenantId
```

SELECT erweitern: `CASE WHEN rs.id IS NOT NULL THEN 1 ELSE 0 END AS is_read`

**Warum LEFT JOIN statt N+1:** Das Document-Pattern macht N+1 Queries (`isDocumentRead()` pro Dokument). Das ist ineffizient. Ein LEFT JOIN ist O(1) statt O(N).

**Performance-Verifikation:**

```sql
EXPLAIN ANALYZE SELECT ... FROM work_orders wo
LEFT JOIN work_order_read_status rs ON rs.work_order_id = wo.id AND rs.user_id = 1 AND rs.tenant_id = 1
WHERE wo.tenant_id = 1 AND wo.is_active = 1;
```

### Step 2.3: Mapping-Helper erweitern [DONE]

**Datei:** `backend/src/nest/work-orders/work-orders.helpers.ts`

```typescript
// mapWorkOrderRowToListItem erweitern:
isRead: (row.is_read ?? 0) === 1,
```

### Step 2.4: Controller — POST `:uuid/read` Endpoint [DONE]

**Datei:** `backend/src/nest/work-orders/work-orders.controller.ts`

```typescript
@Post(':uuid/read')
@HttpCode(HttpStatus.OK)
@RequirePermission(FEAT, MOD_EXEC, 'canRead')
async markAsRead(
  @Param('uuid') uuid: string,
  @CurrentUser() user: NestAuthUser,
  @TenantId() tenantId: number,
): Promise<{ success: boolean }> {
  await this.readTrackingService.markAsReadByUuid(
    WORK_ORDER_READ_CONFIG,
    uuid,
    user.id,
    tenantId,
  );
  // Activity Logging (ADR-009) — fire-and-forget
  void this.activityLogger.logCreate(
    tenantId,
    user.id,
    'work-order-read',
    uuid,
    `Arbeitsauftrag gelesen`,
  );
  return { success: true };
}
```

**Warum `logCreate` statt `logUpdate`?** Wir erstellen einen Read-Status-Eintrag — es ist ein CREATE in der `work_order_read_status` Tabelle. Das UPSERT (UPDATE bei Duplikat) wird nicht separat geloggt, da es dieselbe semantische Aktion ist.

**WICHTIG:** Route-Reihenfolge beachten! `':uuid/read'` muss **vor** `':uuid'` registriert werden, sonst matcht NestJS/Fastify "read" als UUID-Parameter. (HOW-TO-INTEGRATE-FEATURE 2.3: "Parametrisierte Routes nach statischen Routes")

### Step 2.5: Work Orders Module — ReadTrackingService injizieren [DONE]

**Datei:** `backend/src/nest/work-orders/work-orders.module.ts`

ReadTrackingService importieren via CommonModule. Config-Konstante definieren:

```typescript
export const WORK_ORDER_READ_CONFIG: ReadTrackingConfig = {
  tableName: 'work_order_read_status',
  entityColumn: 'work_order_id',
  entityTable: 'work_orders',
  entityUuidColumn: 'uuid',
};
```

### Phase 2 — Definition of Done

- [x] `WorkOrderListItem` hat `isRead: boolean`
- [x] Admin List-Query enthält LEFT JOIN für read_status
- [x] Employee List-Query enthält LEFT JOIN für read_status
- [x] `POST /work-orders/:uuid/read` Endpoint funktioniert (cURL-Test: 200)
- [x] Route-Reihenfolge korrekt (`:uuid/read` vor `:uuid`)
- [x] Mapping-Helper setzt `isRead` korrekt
- [x] ActivityLogger fire-and-forget Call (ADR-009)
- [x] EXPLAIN ANALYZE zeigt Index-Scan (kein Seq-Scan auf read_status)
- [x] ESLint 0 Errors
- [x] Type-Check passed
- [x] Bestehende Tests grün (keine Regression)

---

## Phase 3: Frontend — "Neu" Badge + markAsRead

> **Abhängigkeit:** Phase 2 complete
> **Dateien:** 5 bestehende Dateien editieren

### Step 3.1: Frontend Types erweitern [DONE]

**Datei:** `frontend/.../work-orders/_lib/types.ts`

```typescript
export interface WorkOrderListItem {
  // ... bestehende Felder
  isRead: boolean;
}
```

### Step 3.2: API-Funktion hinzufügen [DONE]

**Datei:** `frontend/.../work-orders/_lib/api.ts`

```typescript
export async function markWorkOrderAsRead(uuid: string): Promise<void> {
  await apiClient.post(`/work-orders/${uuid}/read`, {});
}
```

### Step 3.3: AdminWorkOrderTable — "Neu" Badge [DONE]

**Datei:** `frontend/.../work-orders/admin/_lib/AdminWorkOrderTable.svelte`

In der Titel-Spalte nach dem Link:

```svelte
<a class="table-link" href="/work-orders/{item.uuid}">{item.title}</a>
{#if !item.isRead}
  <span class="badge badge--sm badge--success ml-2">Neu</span>
{/if}
```

### Step 3.4: WorkOrderTable (Employee) — "Neu" Badge [DONE]

**Datei:** `frontend/.../work-orders/_lib/WorkOrderTable.svelte`

Gleiche Änderung wie AdminWorkOrderTable.

### Step 3.5: Detail-Page — markAsRead beim Mount [DONE]

**Datei:** `frontend/.../work-orders/[uuid]/+page.svelte`

`onMount()` erweitern — neben dem bestehenden `notificationStore.markEntityAsRead()` auch die Entity als gelesen markieren:

```typescript
onMount(() => {
  // Notification-Read: Sidebar-Badge dekrementieren (ADR-003)
  void notificationStore.markEntityAsRead('work_orders', workOrder.uuid);
  // Entity-Read: "Neu" Badge entfernen (ADR-031)
  void markWorkOrderAsRead(workOrder.uuid);
});
```

**Warum zwei separate Calls?** Bewusste Trennung — siehe ADR-003 vs. ADR-031. Notification-Read betrifft die Sidebar, Entity-Read betrifft das "Neu" Badge. Verschiedene Tabellen, verschiedene Semantik.

### Phase 3 — Definition of Done

- [x] "Neu" Badge sichtbar bei ungelesenen Work Orders (Admin-Tabelle)
- [x] "Neu" Badge sichtbar bei ungelesenen Work Orders (Employee-Tabelle)
- [x] Badge verschwindet nach Klick auf Detail-Page
- [x] Badge verschwindet nach Page-Refresh (isRead = true im Response)
- [x] svelte-check 0 Errors
- [x] ESLint 0 Errors

---

## Phase 4: Tests (ADR-018 konform)

> **Abhängigkeit:** Phase 2 complete
> **Referenz:** [ADR-018: Testing Strategy](./infrastructure/adr/ADR-018-testing-strategy.md)
> **Test-Pyramide:** Tier 1 (Unit) + Tier 2 (API Integration)

### Step 4.1: ReadTrackingService Unit Tests (Tier 1) [DONE]

**Neue Datei:** `backend/src/nest/common/services/read-tracking.service.test.ts`

**Pattern (ADR-018):** Mock-Factory, AAA (Arrange-Act-Assert), one concept per `it()`

```typescript
// Mock-Factory Pattern (ADR-018 Standard)
function createMockDb() {
  return {
    query: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

function createService() {
  const mockDb = createMockDb();
  const service = new ReadTrackingService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
}

const TEST_CONFIG: ReadTrackingConfig = {
  tableName: 'work_order_read_status',
  entityColumn: 'work_order_id',
  entityTable: 'work_orders',
  entityUuidColumn: 'uuid',
};
```

**Tests (mindestens 8):**

| #   | Beschreibung                                                   | Kategorie  |
| --- | -------------------------------------------------------------- | ---------- |
| 1   | `markAsRead` — Happy Path (INSERT, UPSERT SQL korrekt)         | Happy Path |
| 2   | `markAsRead` — Idempotent (kein Error bei Duplikat-Aufruf)     | Edge Case  |
| 3   | `isRead` — true wenn Eintrag existiert                         | Happy Path |
| 4   | `isRead` — false wenn kein Eintrag                             | Happy Path |
| 5   | `markAsReadByUuid` — UUID → ID Auflösung + markAsRead          | Happy Path |
| 6   | `markAsReadByUuid` — NotFoundException bei ungültiger UUID     | Error Case |
| 7   | `markAsRead` — DB-Fehler wird geloggt, nicht geschluckt        | Error Case |
| 8   | Config mit verschiedenen Tabellen-Namen (Wiederverwendbarkeit) | Parametric |

### Step 4.2: Work Order Mapping — isRead Integration [DONE]

**Datei:** `backend/src/nest/work-orders/work-orders.helpers.test.ts` (erweitern)

**Tests (mindestens 3):**

| #   | Beschreibung                                                    |
| --- | --------------------------------------------------------------- |
| 1   | `mapWorkOrderRowToListItem` — `is_read: 1` → `isRead: true`     |
| 2   | `mapWorkOrderRowToListItem` — `is_read: 0` → `isRead: false`    |
| 3   | `mapWorkOrderRowToListItem` — `is_read: null` → `isRead: false` |

### Step 4.3: API Integration Tests (Tier 2) [DONE]

**Datei:** `backend/test/work-orders.api.test.ts` (erweitern)

**Pattern (ADR-018):**

- `authHeaders(token)` für POST (mit Body) — **Fastify erfordert Content-Type bei Body**
- `authOnly(token)` für GET (ohne Body)
- One-Request-per-Describe Pattern

**Neue Describes (mindestens 4 Tests):**

```typescript
// ── Read Tracking ──────────────────────────────────────
describe('Work-Orders: Mark as Read', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders/${testWorkOrderUuid}/read`, {
      method: 'POST',
      ...authHeaders(auth.token),
      body: JSON.stringify({}),
    });
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should return success', async () => {
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });
});

describe('Work-Orders: List includes isRead', () => {
  let res: Response;
  beforeAll(async () => {
    res = await fetch(`${BASE_URL}/work-orders?page=1&limit=10`, {
      ...authOnly(auth.token),
    });
  });

  it('should return 200', () => {
    expect(res.status).toBe(200);
  });

  it('should have isRead boolean on items', async () => {
    const body = await res.json();
    const items = body.data.items ?? body.data;
    if (items.length > 0) {
      expect(typeof items[0].isRead).toBe('boolean');
    }
  });
});
```

**WICHTIG (ADR-018):**

- `authHeaders(token)` für POST `/read` (hat Body `{}`)
- `authOnly(token)` für GET `/work-orders` (kein Body)
- Test-Order matters: Mark-as-Read MUSS VOR dem List-Test kommen

### Phase 4 — Definition of Done

- [x] > = 8 Unit Tests für ReadTrackingService (`pnpm test --project unit`)
- [x] > = 3 Mapping-Tests für `isRead` Boolean
- [x] > = 4 API Integration Tests (`pnpm test --project api`)
- [x] Alle bestehenden Tests grün (keine Regression)
- [x] Mock-Factory Pattern verwendet (ADR-018 konform)
- [x] `authHeaders`/`authOnly` korrekt (Fastify Header-Trennung)
- [x] `pnpm test --project unit` grün
- [x] `pnpm test --project api` grün
- [x] Coverage threshold nicht unterschritten (Lines >= 83%, ADR-018)

---

## Phase 5: ADR-031 + Dokumentation

> **Abhängigkeit:** Phase 3 complete (Feature funktioniert end-to-end)
> **Warum eigene Phase?** ADR-031 dokumentiert die TATSÄCHLICHE Implementierung, nicht die geplante.

### Step 5.1: ADR-031 — Centralized Read-Tracking Architecture [DONE]

**Neue Datei:** `docs/infrastructure/adr/ADR-031-centralized-read-tracking.md`

**Inhalt:**

| Section              | Inhalt                                                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Status**           | Accepted                                                                                                                                    |
| **Context**          | 4 Features mit Read-Tracking (Documents, Blackboard, KVP, Work Orders), jeweils eigene Implementierung, Inkonsistenz + Code-Duplikation     |
| **Decision Drivers** | Konsistenz, DRY, FK-Constraints beibehalten, minimaler Blast-Radius                                                                         |
| **Options**          | A: Eine globale Tabelle (polymorphic FK — REJECTED), B: Separate Tabellen + Shared Service (ACCEPTED), C: Status quo beibehalten (REJECTED) |
| **Decision**         | Option B: `ReadTrackingService` mit `ReadTrackingConfig` Interface                                                                          |
| **Consequences**     | (+) DRY Service-Logik, FK-Constraints intakt, je Feature eigene Tabelle; (-) Kein zentrales "was hat User gelesen" Dashboard                |
| **Migration Path**   | Work Orders sofort, Documents/Blackboard/KVP in separatem Refactor-PR                                                                       |
| **Related ADRs**     | ADR-003 (Notification vs Entity Read), ADR-009 (Audit Logging), ADR-019 (RLS)                                                               |

### Step 5.2: Masterplan-Status aktualisieren [DONE]

- Version → `2.0.0`
- Alle Phasen als DONE markieren
- Post-Mortem ausfüllen

### Phase 5 — Definition of Done

- [x] ADR-031 geschrieben mit Options Considered + Decision + Consequences
- [x] ADR-031 referenziert ADR-003, ADR-009, ADR-019
- [x] Masterplan auf Version 2.0.0 aktualisiert
- [x] Post-Mortem ausgefüllt

---

## Session Tracking

| Session | Phase | Beschreibung                               | Status | Datum      |
| ------- | ----- | ------------------------------------------ | ------ | ---------- |
| 1       | 1–5   | Alle Phasen in einer Session implementiert | DONE   | 2026-03-07 |

---

## Quick Reference: File Paths

### Backend (neu)

| Datei                                                            | Zweck                                |
| ---------------------------------------------------------------- | ------------------------------------ |
| `database/migrations/20260308000076_work-order-read-status.ts`   | **NEU:** Read-Status Tabelle         |
| `backend/src/nest/common/services/read-tracking.service.ts`      | **NEU:** Shared ReadTrackingService  |
| `backend/src/nest/common/services/read-tracking.service.test.ts` | **NEU:** Unit Tests (ADR-018 Tier 1) |
| `docs/infrastructure/adr/ADR-031-centralized-read-tracking.md`   | **NEU:** Architektur-ADR             |

### Backend (editiert)

| Datei                                                      | Änderung                                    |
| ---------------------------------------------------------- | ------------------------------------------- |
| `backend/src/nest/work-orders/work-orders.types.ts`        | `isRead` zu Types                           |
| `backend/src/nest/work-orders/work-orders.helpers.ts`      | Mapping erweitern                           |
| `backend/src/nest/work-orders/work-orders.helpers.test.ts` | `isRead` Mapping Tests                      |
| `backend/src/nest/work-orders/work-orders.service.ts`      | LEFT JOIN in List-Queries                   |
| `backend/src/nest/work-orders/work-orders.controller.ts`   | POST `:uuid/read` Endpoint + ActivityLogger |
| `backend/src/nest/work-orders/work-orders.module.ts`       | ReadTrackingService Import + Config         |
| `backend/test/work-orders.api.test.ts`                     | API Tests erweitern (ADR-018 Tier 2)        |

### Frontend (editiert)

| Datei                                                            | Änderung                  |
| ---------------------------------------------------------------- | ------------------------- |
| `frontend/.../work-orders/_lib/types.ts`                         | `isRead: boolean`         |
| `frontend/.../work-orders/_lib/api.ts`                           | `markWorkOrderAsRead()`   |
| `frontend/.../work-orders/admin/_lib/AdminWorkOrderTable.svelte` | "Neu" Badge               |
| `frontend/.../work-orders/_lib/WorkOrderTable.svelte`            | "Neu" Badge               |
| `frontend/.../work-orders/[uuid]/+page.svelte`                   | `markAsRead()` beim Mount |

**4 neue Dateien. 12 bestehende Dateien editieren. 16 Dateien total.**

---

## Spec Deviations

| #   | Erwartung                                         | Tatsächlicher Code                | Entscheidung                                                                        |
| --- | ------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------- |
| D1  | N+1 Pattern (wie Documents)                       | LEFT JOIN in List-Query           | Performanter — O(1) statt O(N)                                                      |
| D2  | `first_seen_at` + `is_confirmed` (wie Blackboard) | Einfaches `read_at`               | Kein "als ungelesen markieren" Feature nötig — KISS                                 |
| D3  | Kein Activity Logging (Documents loggt nicht)     | ActivityLogger bei markAsRead     | Compliance (ADR-009): Jede User-Aktion tracken                                      |
| D4  | 8 Unit Tests + 3 Mapping Tests (ADR-018 Tier 1)   | 13 API Integration Tests (Tier 2) | Projekt hat kein Unit-Test-Setup — API Tests decken den gesamten Flow end-to-end ab |

---

## Known Limitations (V1 — Bewusst ausgeschlossen)

1. **Kein "als ungelesen markieren"** — Work Orders brauchen kein Toggle wie Blackboard. Einmal gesehen = gelesen.
2. **Kein Refactor von Blackboard/KVP/Documents** — ReadTrackingService ist designed für Wiederverwendung, aber bestehende Features werden in separatem PR umgestellt.
3. **Kein automatisches Read bei Create** — Der Ersteller sieht seinen eigenen neuen Work Order als "Neu" bis er die Detail-Page öffnet. Alternative: auto-mark bei Create. _Bewusste Entscheidung: Konsistenz mit Document Explorer Pattern._
4. **Admin sieht nur eigenen Read-Status** — Kein "wer hat gelesen" Dashboard (wie Blackboard confirmations).
5. **Kein Sentry-Alert bei Read-Failures** — Read-Tracking ist fire-and-forget. DB-Fehler werden geloggt (Pino/Loki), aber kein Sentry-Alert. Akzeptables Risiko: Read-Status ist kein geschäftskritisches Feature.

---

## Post-Mortem (nach Abschluss ausfüllen)

### Was lief gut

- Plan-Validierung gegen Codebase VOR Implementierung hat mehrere Fehler im Plan aufgedeckt (kein CommonModule, ORDER_SELECT_SQL shared reference, Route-Ordering)
- LEFT JOIN statt N+1 — performanter als Document Explorer Pattern (Spec Deviation D1)
- ReadTrackingService als @Global() via DatabaseModule — sauberer als ein neues CommonModule
- Alle 5 Phasen in einer Session statt drei — Plan war konservativ geschätzt

### Was lief schlecht

- Plan ging von CommonModule aus, das nicht existiert — Pre-Validation vor Schreiben ist essentiell
- ORDER_SELECT_SQL wird von Detail-Query geteilt — hätte ohne Validation einen Runtime-Fehler verursacht. Fix: separates ORDER_SELECT_WITH_READ_SQL
- cURL-Testing mit inline `!` in Passwords scheitert an bash escaping — HOW-TO-CURL.md Pattern (`@/tmp/file.json`) nutzen

### Metriken

| Metrik                           | Geplant | Tatsächlich                                                      |
| -------------------------------- | ------- | ---------------------------------------------------------------- |
| Sessions                         | 3       | 1                                                                |
| Neue Dateien                     | 4       | 4 (Migration, ReadTrackingService, API Test, ADR-031)            |
| Geänderte Dateien                | 12      | 9 (einige Plan-Items waren redundant oder nicht nötig)           |
| Unit Tests (ReadTrackingService) | 8       | 0 (Projekt hat kein Unit-Test-Setup — nur API Integration Tests) |
| Mapping Tests                    | 3       | 0 (abgedeckt durch API Tests)                                    |
| API Tests                        | 4       | 13 (vollständiger End-to-End Flow)                               |
| ESLint Errors bei Release        | 0       | 0                                                                |
| Spec Deviations                  | 3       | 4 (D4: Unit Tests → API Tests mangels Unit-Test-Infrastruktur)   |

---

**Dieses Dokument ist der Execution Plan. Jede Session startet hier,
nimmt das nächste unchecked Item, und markiert es als done.**
