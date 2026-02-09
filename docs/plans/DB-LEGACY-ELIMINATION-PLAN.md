# Plan: Legacy DB Layer Elimination & Best-Practice Migration

| Metadata            | Value                                                                             |
| ------------------- | --------------------------------------------------------------------------------- |
| **Status**          | Proposed                                                                          |
| **Date**            | 2026-02-09                                                                        |
| **Branch**          | TBD (e.g. `refactor/db-legacy-elimination`)                                       |
| **Affected Files**  | 8 source files to migrate + 6 test files + 3 files to delete + 2 docs = ~20 files |
| **Risk Level**      | Medium (pure refactor, no behavior change)                                        |
| **Estimated Scope** | ~800 lines changed across ~20 files                                               |

---

## 1. Problem Statement

We have **two parallel DB access paths** that are inconsistent, confusing, and violate DRY:

| Aspect             | `utils/db.ts` (Legacy)                                    | `DatabaseService` (NestJS)                |
| ------------------ | --------------------------------------------------------- | ----------------------------------------- |
| Access Pattern     | Standalone functions (`execute`, `query`)                 | Injected service (`this.db.query()`)      |
| RLS Support        | Manual `transaction(cb, tenantId)`                        | Automatic `tenantTransaction(cb)` via CLS |
| Return Type        | MySQL2 tuple: `[T, FieldPacket[]]`                        | Clean array: `T[]`                        |
| Type Names         | MySQL2: `RowDataPacket`, `ResultSetHeader`, `FieldPacket` | PostgreSQL native: `QueryResultRow`       |
| Pool Instance      | Separate pool via `config/database.ts`                    | NestJS-managed pool via `PG_POOL` token   |
| Testability        | `vi.mock()` on module path                                | Constructor injection (proper DI mock)    |
| ADR-019 Conformant | No                                                        | Yes                                       |

### MySQL Legacy Artifacts (No MySQL exists anymore!)

1. **`ResultSetHeader`** — MySQL2 type with `affectedRows`, `insertId` fields
2. **`FieldPacket`** — MySQL2 field metadata type
3. **`RowDataPacket`** — MySQL2 row type (extends `QueryResultRow` with `[key: string]: unknown`)
4. **`PoolConnection`** — Custom wrapper mimicking MySQL2's connection interface
5. **`[T, FieldPacket[]]`** — MySQL2-style tuple return pattern
6. **`execute()` as alias for `query()`** — MySQL2 naming convention
7. **`affectedRows` / `insertId`** — MySQL2 result property names

### Dual Pool Problem

Two separate `pg.Pool` instances are created:

- `config/database.ts` → exports `pool` (used by `utils/db.ts`)
- `database.module.ts` → creates pool via factory (used by `DatabaseService`)

This means **two connection pools competing for the same PostgreSQL connections**.

---

## 2. Goal / Definition of Done

- [ ] **Zero imports** from `backend/src/utils/db.ts` anywhere in the codebase
- [ ] **Zero imports** from `backend/src/utils/dbWrapper.ts` anywhere
- [ ] **Zero references** to `RowDataPacket`, `ResultSetHeader`, `FieldPacket`, `PoolConnection`
- [ ] **Zero MySQL naming** (`affectedRows`, `insertId`, `execute` as query alias)
- [ ] **Single pool instance** via NestJS `PG_POOL` token only
- [ ] All services use `DatabaseService` (injected) — no standalone functions
- [ ] All tenant-scoped queries use `tenantTransaction()` (ADR-019)
- [ ] All tests mock `DatabaseService` via constructor injection (no `vi.mock()` on db path)
- [ ] `db.ts`, `dbWrapper.ts`, and `config/database.ts` deleted
- [ ] All existing tests pass (3570 unit + 175 API)
- [ ] Coverage thresholds still met
- [ ] Documentation updated
- [ ] ESLint clean

---

## 3. Impact Analysis — All Affected Files

### 3.1 Files importing from `utils/db.ts` (15 files)

#### NestJS Services (5) + Controller (1) — Use `execute()` + `RowDataPacket`

| #   | File                                                     | Type       | Imports                    | Migration                                            |
| --- | -------------------------------------------------------- | ---------- | -------------------------- | ---------------------------------------------------- |
| 1   | `nest/roles/roles.service.ts`                            | Service    | `RowDataPacket`, `execute` | Inject `DatabaseService`, use `db.query<T>()`        |
| 2   | `nest/teams/teams.service.ts`                            | Service    | `RowDataPacket`, `execute` | Inject `DatabaseService`, use `db.query<T>()`        |
| 3   | `nest/departments/departments.service.ts`                | Service    | `RowDataPacket`, `execute` | Inject `DatabaseService`, use `db.query<T>()`        |
| 4   | `nest/areas/areas.service.ts`                            | Service    | `RowDataPacket`, `execute` | Inject `DatabaseService`, use `db.query<T>()`        |
| 5   | `nest/role-switch/role-switch.service.ts`                | Service    | `RowDataPacket`, `execute` | Inject `DatabaseService`, use `db.query<T>()`        |
| 6   | `nest/admin-permissions/admin-permissions.controller.ts` | Controller | `RowDataPacket`, `execute` | Move DB logic to service or inject `DatabaseService` |

> **Note on #6:** `admin-permissions.service.ts` already uses `DatabaseService` correctly.
> The _controller_ still imports from `db.ts` — this DB logic should ideally be moved into the service layer.

**Pattern for each service:**

```typescript
// BEFORE (Legacy)
import type { RowDataPacket } from '../../utils/db.js';
import { execute } from '../../utils/db.js';

interface SomeRow extends RowDataPacket { id: number; name: string; }

const [rows] = await execute<SomeRow[]>('SELECT ...', [params]);
//                          ^^^^^^^^^^  Legacy: pass ARRAY type (SomeRow[])

// AFTER (Best Practice)
// No import from utils/db.ts needed
// DatabaseService already injected

interface SomeRow { id: number; name: string; }

const rows = await this.db.query<SomeRow>('SELECT ...', [params]);
//                         ^^^^^^^  New: pass ROW type (SomeRow), returns SomeRow[]
```

Key changes per service:

- Remove `extends RowDataPacket` from row interfaces
- Remove tuple destructuring `const [rows] = ...` → `const rows = ...`
- Replace `execute<T[]>(sql, params)` → `this.db.query<T>(sql, params)`
- For tenant-scoped tables: use `this.db.tenantTransaction()` instead (ADR-019)

#### Test Files (6) — Mock `execute` via `vi.mock()`

| #   | File                                           | Current Mock                   | Migration                                 |
| --- | ---------------------------------------------- | ------------------------------ | ----------------------------------------- |
| 1   | `nest/roles/roles.service.test.ts`             | `vi.mock('../../utils/db.js')` | Mock `DatabaseService` via constructor DI |
| 2   | `nest/teams/teams.service.test.ts`             | `vi.mock('../../utils/db.js')` | Mock `DatabaseService` via constructor DI |
| 3   | `nest/departments/departments.service.test.ts` | `vi.mock('../../utils/db.js')` | Mock `DatabaseService` via constructor DI |
| 4   | `nest/areas/areas.service.test.ts`             | `vi.mock('../../utils/db.js')` | Mock `DatabaseService` via constructor DI |
| 5   | `nest/role-switch/role-switch.service.test.ts` | `vi.mock('../../utils/db.js')` | Mock `DatabaseService` via constructor DI |
| 6   | `utils/featureCheck.test.ts`                   | `vi.mock('./db.js')`           | Mock `DatabaseService` via constructor DI |

**Pattern for each test:**

```typescript
// BEFORE (Legacy)
import { execute } from '../../utils/db.js';
vi.mock('../../utils/db.js', () => ({ execute: vi.fn() }));
const mockExecute = vi.mocked(execute);
mockExecute.mockResolvedValue([[{ id: 1, name: 'test' }], []]);

// AFTER (Best Practice)
function createMockDatabaseService() {
  return { query: vi.fn(), queryOne: vi.fn(), tenantTransaction: vi.fn() };
}
const mockDb = createMockDatabaseService();
const service = new SomeService(mockDb as unknown as DatabaseService, ...);
mockDb.query.mockResolvedValue([{ id: 1, name: 'test' }]);
```

Key changes per test:

- Remove `vi.mock('../../utils/db.js')` — no more module mocking
- Create mock `DatabaseService` object with `vi.fn()` methods
- Pass mock via constructor (proper DI testing)
- Remove tuple wrapping from mock return values: `[[rows], []]` → `[rows]`
- Remove `FieldPacket[]` second element

#### Other Files (3) + Indirect Dependency (1)

| #   | File                    | Imports                                                | Migration Strategy                          |
| --- | ----------------------- | ------------------------------------------------------ | ------------------------------------------- |
| 1   | `websocket.ts`          | `ResultSetHeader`, `RowDataPacket`, `execute`, `query` | Refactor to use `DatabaseService` (see 3.2) |
| 2   | `utils/dbWrapper.ts`    | `PoolConnection`, `ResultSetHeader`                    | Delete entirely (see 3.3)                   |
| 3   | `utils/featureCheck.ts` | `RowDataPacket`, `query`                               | Refactor to `FeatureCheckService` (see 3.4) |
| 4   | `utils/emailService.ts` | `import featureCheck from './featureCheck.js'`         | Indirect dependency — see 3.5               |

> **Note on #4:** `emailService.ts` does NOT import `db.ts` directly, but imports `featureCheck.ts` which does.
> When `featureCheck.ts` becomes `FeatureCheckService` (injectable), `emailService.ts` must also be updated to inject the new service.

### 3.2 `websocket.ts` — Special Case (Concrete Strategy)

`ChatWebSocketServer` is a **plain class** (NOT a NestJS `@WebSocketGateway()`), instantiated in `main.ts` as:

```typescript
// main.ts line ~250
chatWsInstance = new ChatWebSocketServer(httpServer);
```

It has **6+ interfaces extending `RowDataPacket`** and uses both `query()` and `execute()` from `db.ts`.

**Decision: Option B — Pass `DatabaseService` via constructor from `main.ts`**

Converting to `@WebSocketGateway()` would be a larger refactor (different lifecycle, different event handling). Instead, we pass the `DatabaseService` instance from the NestJS app:

```typescript
// main.ts — AFTER migration
const dbService = app.get(DatabaseService);
chatWsInstance = new ChatWebSocketServer(httpServer, dbService);
```

```typescript
// websocket.ts — AFTER migration
export class ChatWebSocketServer {
  constructor(
    private readonly server: Server,
    private readonly db: DatabaseService,  // ADD
  ) { ... }
}
```

**Key migration details for websocket.ts:**

1. Remove all `extends RowDataPacket` from interfaces (6+ interfaces)
2. Replace `execute<T[]>(sql, params)` → `this.db.query<T>(sql, params)` (remove tuple destructuring)
3. Replace `query<T[]>(sql, params)` → `this.db.query<T>(sql, params)`
4. **Callback signature change:** Legacy `PoolConnection` wrapper has both `.execute()` and `.query()`. New `PoolClient` (via `tenantTransaction(cb)`) only has `.query()`. Ensure no code relies on the `.execute()` method distinction.
5. For tenant-scoped chat tables: use `this.db.tenantTransaction()` (ADR-019)

### 3.3 `utils/dbWrapper.ts` — Delete

Only imports: `PoolConnection`, `ResultSetHeader` from `db.ts`.
Only export: `ConnectionWrapper` class, `wrapConnection` function.

**Check:** Verify nothing imports from `dbWrapper.ts` (research shows only `dbWrapper.test.ts`).
**Action:** Delete `dbWrapper.ts` + `dbWrapper.test.ts`.

### 3.4 `utils/featureCheck.ts` — Migrate to DI

Uses `query()` from db.ts to check feature flags.

**Strategy:** Convert to NestJS `@Injectable()` service with `DatabaseService` injected:

```typescript
// BEFORE
import { RowDataPacket, query as executeQuery } from './db.js';

export async function checkFeature(tenantId: number, feature: string): Promise<boolean> {
  const [rows] = await executeQuery<RowDataPacket[]>('SELECT ...', [tenantId, feature]);
  return rows.length > 0;
}

// AFTER
@Injectable()
export class FeatureCheckService {
  constructor(private readonly db: DatabaseService) {}
  async checkFeature(tenantId: number, feature: string): Promise<boolean> {
    const rows = await this.db.query<{ id: number }>('SELECT ...', [tenantId, feature]);
    return rows.length > 0;
  }
}
```

### 3.5 `utils/emailService.ts` — Indirect Dependency (Deferred)

`emailService.ts` imports `featureCheck.ts` (line 10: `import featureCheck from './featureCheck.js'`).

**Status:** Email (SMTP/IMAP) is **NOT configured yet** — will be set up before deployment.

**Strategy:** When `featureCheck.ts` becomes `FeatureCheckService` (injectable), `emailService.ts` must also be converted to an injectable service that receives `FeatureCheckService` via constructor DI. However, since email is not configured:

- **During this migration:** Update the import in `emailService.ts` to reference the new `FeatureCheckService` (keep the file compiling)
- **Before deployment:** Full email service migration to NestJS injectable (separate task)

### 3.6 `config/database.ts` — Delete (Dual Pool Elimination)

This file creates a **second, standalone Pool** that competes with `DatabaseModule`'s pool.

**Pre-check before deletion:**

- Verify `db.ts` is the ONLY consumer of this pool
- Verify `setTenantContext` / `setUserContext` are duplicated in `DatabaseService`
- Verify no other file imports the default pool export

**Action:** Delete after all `db.ts` consumers are migrated.

### 3.7 Documentation Updates

| File                                      | Action                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `backend/docs/TYPESCRIPT-DB-UTILITIES.md` | Rewrite: remove MySQL references, document `DatabaseService` as single path |
| `docs/TYPESCRIPT-STANDARDS.md`            | Update DB section: remove `RowDataPacket`/`ResultSetHeader` examples        |

---

## 4. Migration Order (Step-by-Step)

### Principle: Inside-Out, One Service at a Time

Each step is independently testable. Never break more than one service at a time.

```
Phase 1: Prepare (no behavior change)
  └── Step 1.1: Verify DatabaseService has all needed methods
  └── Step 1.2: Check websocket.ts structure

Phase 2: Migrate NestJS Services (6 services + 5 tests)
  └── Step 2.1: roles.service.ts + roles.service.test.ts
  └── Step 2.2: teams.service.ts + teams.service.test.ts
  └── Step 2.3: departments.service.ts + departments.service.test.ts
  └── Step 2.4: areas.service.ts + areas.service.test.ts
  └── Step 2.5: role-switch.service.ts + role-switch.service.test.ts
  └── Step 2.6: admin-permissions.controller.ts (special: controller, not service)

Phase 3: Migrate Utility Files
  └── Step 3.1: featureCheck.ts → FeatureCheckService + featureCheck.test.ts
  └── Step 3.2: emailService.ts → Update import to use FeatureCheckService
  └── Step 3.3: websocket.ts → Pass DatabaseService via main.ts constructor

Phase 4: Cleanup
  └── Step 4.1: Delete dbWrapper.ts + dbWrapper.test.ts
  └── Step 4.2: Delete db.ts
  └── Step 4.3: Delete config/database.ts (verify no other consumers first!)
  └── Step 4.4: Update documentation
  └── Step 4.5: Remove mysql2 from pnpm-lock.yaml if present

Phase 5: Verify
  └── Step 5.1: Run full unit test suite
  └── Step 5.2: Run full API test suite
  └── Step 5.3: Verify coverage thresholds
  └── Step 5.4: ESLint clean
  └── Step 5.5: Docker build + smoke test
```

---

## 5. Detailed Migration Per Service

### Step 2.1 Example: `roles.service.ts`

**Current code pattern (pseudo):**

```typescript
import type { RowDataPacket } from '../../utils/db.js';
import { execute } from '../../utils/db.js';

@Injectable()
export class RolesService {
  constructor(private readonly cls: ClsService) {}

  async findAll(tenantId: number): Promise<Role[]> {
    const [rows] = await execute<RoleRow[]>('SELECT id, name FROM roles WHERE tenant_id = $1', [tenantId]);
    return rows.map(mapToRole);
  }
}
```

**Target code:**

```typescript
// No db.ts import

@Injectable()
export class RolesService {
  constructor(
    private readonly cls: ClsService,
    private readonly db: DatabaseService, // ADD
  ) {}

  async findAll(tenantId: number): Promise<Role[]> {
    const rows = await this.db.query<RoleRow>('SELECT id, name FROM roles WHERE tenant_id = $1', [tenantId]); // CHANGE
    return rows.map(mapToRole);
  }
}
```

**Changes:**

1. Remove `import ... from '../../utils/db.js'`
2. Add `private readonly db: DatabaseService` to constructor
3. Remove `extends RowDataPacket` from `RoleRow` interface
4. Replace `execute<T[]>(sql, params)` → `this.db.query<T>(sql, params)`
5. Remove tuple destructuring: `const [rows] = ...` → `const rows = ...`

**Test changes:**

1. Remove `vi.mock('../../utils/db.js')`
2. Create `mockDb = { query: vi.fn(), ... }`
3. Pass `mockDb` in constructor: `new RolesService(mockCls, mockDb as any)`
4. Update mock returns: `mockDb.query.mockResolvedValue([...rows])`

### RLS Decision Per Service

For each service, evaluate whether queries touch tenant-scoped tables with RLS policies:

| Service                           | Tables Accessed     | RLS? | Method to Use         |
| --------------------------------- | ------------------- | ---- | --------------------- |
| `roles.service.ts`                | `roles`             | Yes  | `tenantTransaction()` |
| `teams.service.ts`                | `teams`             | Yes  | `tenantTransaction()` |
| `departments.service.ts`          | `departments`       | Yes  | `tenantTransaction()` |
| `areas.service.ts`                | `areas`             | Yes  | `tenantTransaction()` |
| `role-switch.service.ts`          | `users`             | Yes  | `tenantTransaction()` |
| `admin-permissions.controller.ts` | `admin_permissions` | Yes  | `tenantTransaction()` |
| `featureCheck.ts`                 | `tenant_features`   | Yes  | `tenantTransaction()` |
| `websocket.ts`                    | `chat_*`            | Yes  | `tenantTransaction()` |

**All of them should use `tenantTransaction()`.** This is the biggest win of this migration — these services currently bypass RLS entirely by using `execute()` which goes through `db.ts`'s pool without setting GUC context.

---

## 6. Risk Mitigation

| Risk                                          | Mitigation                                                        |
| --------------------------------------------- | ----------------------------------------------------------------- |
| Breaking existing behavior                    | Pure refactor, no SQL changes. Same queries, same results.        |
| Missing a consumer of db.ts                   | Grep verification before deletion. CI will catch missing imports. |
| Constructor signature change breaks DI        | NestJS auto-resolves `DatabaseService` (global module).           |
| Test mock pattern change introduces failures  | Migrate one service + test at a time. Run tests after each step.  |
| Dual pool removal causes connection issues    | Verify `config/database.ts` pool is unused before deletion.       |
| `websocket.ts` may not support DI easily      | Investigate structure first (Phase 1). May need gateway refactor. |
| Coverage drops from deleting `dbWrapper.test` | `dbWrapper.ts` had 100% coverage but is tiny. Net effect minimal. |

---

## 7. What This Does NOT Change

- No SQL query changes (same `$1, $2, $3` placeholders)
- No schema changes
- No API behavior changes
- No frontend changes
- No migration files needed
- `DatabaseService` API stays exactly the same
- `DatabaseModule` stays exactly the same

---

## 8. Verification Checklist

After all phases complete:

```bash
# 1. No legacy imports remain
grep -r "utils/db.js" backend/src/ --include="*.ts"     # Must return NOTHING
grep -r "utils/dbWrapper" backend/src/ --include="*.ts"  # Must return NOTHING
grep -r "RowDataPacket" backend/src/ --include="*.ts"    # Must return NOTHING
grep -r "ResultSetHeader" backend/src/ --include="*.ts"  # Must return NOTHING
grep -r "FieldPacket" backend/src/ --include="*.ts"      # Must return NOTHING
grep -r "PoolConnection" backend/src/ --include="*.ts"   # Must return NOTHING (except pg re-export if needed)

# 2. Deleted files don't exist
ls backend/src/utils/db.ts          # Must fail
ls backend/src/utils/dbWrapper.ts   # Must fail
ls backend/src/config/database.ts   # Must fail

# 3. All tests pass
pnpm vitest run --project unit --project permission --project frontend-unit

# 4. Coverage thresholds met
pnpm vitest run --project unit --coverage

# 5. ESLint clean
cd /home/scs/projects/Assixx && docker exec assixx-backend pnpm exec eslint backend/src

# 6. Docker build succeeds
doppler run -- docker-compose --profile production build backend

# 7. Smoke test
curl -s http://localhost:3000/health | jq '.'
```
