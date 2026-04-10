# TypeScript Database Utilities Documentation (PostgreSQL 18)

> **Updated:** 2026-02-09
> **Database:** PostgreSQL 18 with `pg` library v8.16.3
> **Access:** `DatabaseService` via NestJS Dependency Injection

## Overview

All database access goes through `DatabaseService` (injected via NestJS DI). There is **no standalone utility file** — the legacy `utils/db.ts` has been removed.

```typescript
import { DatabaseService } from '../database/database.service.js';

@Injectable()
export class MyService {
  constructor(private readonly db: DatabaseService) {}
}
```

## Key Rules

- **PostgreSQL `$1, $2, $3` placeholders** — never concatenate strings
- **`RETURNING id`** for INSERT operations
- **`db.query<T>()`** — generic takes ROW type, returns `T[]`
- **`db.queryOne<T>()`** — returns `T | undefined`
- **`db.tenantTransaction()`** — for tenant-scoped tables (ADR-019)
- **Never import pool directly** — always use `DatabaseService`

## Usage

### Basic Queries

```typescript
interface UserRow {
  id: number;
  email: string;
  name: string;
}

// SELECT
const users = await this.db.query<UserRow>('SELECT * FROM users WHERE tenant_id = $1 AND is_active = $2', [
  tenantId,
  1,
]);

// INSERT with RETURNING
const rows = await this.db.query<{ id: number }>(
  'INSERT INTO users (email, name, tenant_id) VALUES ($1, $2, $3) RETURNING id',
  [email, name, tenantId],
);
const userId = rows[0]?.id;

// UPDATE / DELETE (no generic needed for mutations)
await this.db.query('UPDATE users SET name = $1 WHERE id = $2 AND tenant_id = $3', [newName, userId, tenantId]);
```

### Single Row Query

```typescript
const user = await this.db.queryOne<UserRow>('SELECT * FROM users WHERE id = $1 AND tenant_id = $2', [
  userId,
  tenantId,
]);
// Returns UserRow | undefined
```

### Transactions with RLS Context (ADR-019)

```typescript
// Tenant-scoped transaction — sets app.tenant_id GUC automatically
const result = await this.db.tenantTransaction(async (client) => {
  const userResult = await client.query<{ id: number }>(
    'INSERT INTO users (email, tenant_id) VALUES ($1, $2) RETURNING id',
    [email, tenantId],
  );
  const userId = userResult.rows[0]?.id;

  await client.query(
    'INSERT INTO profiles (user_id, tenant_id) VALUES ($1, $2)',
    [userId, tenantId],
  );

  return userId;
});

// Plain transaction (no RLS context)
const result = await this.db.transaction(async (client) => {
  // queries here...
});
```

### Bulk Operations

```typescript
// Bulk INSERT
const values = [
  ['user1@example.com', 'User 1', tenantId],
  ['user2@example.com', 'User 2', tenantId],
];
const { placeholders } = this.db.generateBulkPlaceholders(values.length, 3);
// placeholders = "($1, $2, $3), ($4, $5, $6)"

await this.db.query(`INSERT INTO users (email, name, tenant_id) VALUES ${placeholders}`, values.flat());

// IN clause
const userIds = [1, 2, 3, 4, 5];
const { placeholders: inPlaceholders } = this.db.generateInPlaceholders(userIds.length);
// inPlaceholders = "$1, $2, $3, $4, $5"

const users = await this.db.query<UserRow>(`SELECT * FROM users WHERE id IN (${inPlaceholders})`, userIds);
```

## Common Patterns

### Upsert (INSERT or UPDATE)

```typescript
const rows = await this.db.query<{ id: number }>(
  `INSERT INTO settings (user_id, key, value, tenant_id)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
   RETURNING id`,
  [userId, key, value, tenantId],
);
```

### Pagination

```typescript
const users = await this.db.query<UserRow>(
  'SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
  [tenantId, limit, offset],
);
```

### Count with Condition

```typescript
interface CountResult {
  total: string;
}

const rows = await this.db.query<CountResult>(
  'SELECT COUNT(*) as total FROM users WHERE tenant_id = $1 AND is_active = $2',
  [tenantId, 1],
);
const total = Number(rows[0]?.total ?? 0);
```

## Testing

Mock `DatabaseService` via constructor injection — no `vi.mock()` on module paths:

```typescript
function createMockDb() {
  return {
    query: vi.fn(),
    queryOne: vi.fn(),
    tenantTransaction: vi.fn(),
  };
}

type MockDb = ReturnType<typeof createMockDb>;

let service: MyService;
let mockDb: MockDb;

beforeEach(() => {
  mockDb = createMockDb();
  service = new MyService(mockDb as unknown as DatabaseService);
});

it('should query users', async () => {
  mockDb.query.mockResolvedValueOnce([{ id: 1, email: 'test@example.com' }]);

  const result = await service.getUsers(10);

  expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'), [10]);
});
```

## DatabaseService API

| Method                                 | Returns            | Use Case                                 |
| -------------------------------------- | ------------------ | ---------------------------------------- |
| `query<T>(sql, params)`                | `T[]`              | SELECT, INSERT RETURNING, UPDATE, DELETE |
| `queryOne<T>(sql, params)`             | `T \| undefined`   | Single row lookup                        |
| `transaction(cb)`                      | `R`                | Plain transaction                        |
| `tenantTransaction(cb)`                | `R`                | RLS-scoped transaction (ADR-019)         |
| `generateBulkPlaceholders(rows, cols)` | `{ placeholders }` | Bulk INSERT                              |
| `generateInPlaceholders(count)`        | `{ placeholders }` | IN clause                                |

---

**See also:**

- [DATABASE-MIGRATION-GUIDE.md](../../docs/DATABASE-MIGRATION-GUIDE.md) - PostgreSQL setup and RLS
- [TYPESCRIPT-STANDARDS.md](../../docs/TYPESCRIPT-STANDARDS.md) - Code standards
- [ADR-019](../../docs/infrastructure/adr/ADR-019.md) - Multi-Tenant RLS Data Isolation
