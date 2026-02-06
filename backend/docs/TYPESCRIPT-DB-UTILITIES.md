# TypeScript Database Utilities Documentation (PostgreSQL 17)

> **Updated:** 2025-12-08
> **Database:** PostgreSQL 17 with `pg` library v8.16.3
> **Previous:** MySQL2 (deprecated, see git history)

## Overview

Centralized database utilities in `/src/utils/db.ts` provide type-safe PostgreSQL query execution with Row Level Security (RLS) support.

## Key Differences from MySQL

| Feature       | MySQL                     | PostgreSQL                  |
| ------------- | ------------------------- | --------------------------- |
| Placeholders  | `?`                       | `$1, $2, $3`                |
| Get Insert ID | `LAST_INSERT_ID()`        | `RETURNING id`              |
| Pagination    | `LIMIT ?, ?`              | `LIMIT $1 OFFSET $2`        |
| Boolean       | `TINYINT(1)`              | `BOOLEAN`                   |
| JSON          | `JSON`                    | `JSONB` (better!)           |
| Upsert        | `ON DUPLICATE KEY UPDATE` | `ON CONFLICT ... DO UPDATE` |

## Usage

### Basic Queries

```typescript
import { ResultSetHeader, RowDataPacket, execute, query } from '../utils/db';

// SELECT queries - use $1, $2, $3 placeholders
const [users] = await execute<RowDataPacket[]>('SELECT * FROM users WHERE tenant_id = $1 AND is_active = $2', [
  tenantId,
  1,
]);

// INSERT with RETURNING (PostgreSQL best practice)
const [result] = await execute<RowDataPacket[]>(
  'INSERT INTO users (email, name, tenant_id) VALUES ($1, $2, $3) RETURNING id',
  [email, name, tenantId],
);
const userId = result[0]?.id;

// UPDATE queries
const [updateResult] = await execute<ResultSetHeader>('UPDATE users SET name = $1 WHERE id = $2 AND tenant_id = $3', [
  newName,
  userId,
  tenantId,
]);
const affectedRows = updateResult.affectedRows;

// DELETE queries
const [deleteResult] = await execute<ResultSetHeader>('DELETE FROM sessions WHERE user_id = $1', [userId]);
```

### Transactions with RLS Context

```typescript
import { transaction } from '../utils/db';

// Transaction with tenant context (for RLS)
const result = await transaction(
  async (connection) => {
    const [userResult] = await connection.execute<RowDataPacket[]>(
      'INSERT INTO users (email, tenant_id) VALUES ($1, $2) RETURNING id',
      [email, tenantId],
    );

    const userId = userResult[0]?.id;

    await connection.execute('INSERT INTO profiles (user_id, tenant_id) VALUES ($1, $2)', [userId, tenantId]);

    return userId;
  },
  { tenantId },
); // Sets app.tenant_id for RLS

// Transaction with both tenant and user context
await transaction(
  async (connection) => {
    // queries here...
  },
  { tenantId, userId },
); // Sets app.tenant_id AND app.user_id
```

### Bulk Operations

```typescript
import { execute, generateBulkPlaceholders, generateInPlaceholders } from '../utils/db';

// Bulk INSERT
const values = [
  ['user1@example.com', 'User 1', tenantId],
  ['user2@example.com', 'User 2', tenantId],
  ['user3@example.com', 'User 3', tenantId],
];
const { placeholders } = generateBulkPlaceholders(values.length, 3);
// placeholders = "($1, $2, $3), ($4, $5, $6), ($7, $8, $9)"

await execute(`INSERT INTO users (email, name, tenant_id) VALUES ${placeholders}`, values.flat());

// IN clause
const userIds = [1, 2, 3, 4, 5];
const { placeholders: inPlaceholders } = generateInPlaceholders(userIds.length);
// inPlaceholders = "$1, $2, $3, $4, $5"

const [users] = await execute<RowDataPacket[]>(`SELECT * FROM users WHERE id IN (${inPlaceholders})`, userIds);
```

### Getting a Connection

```typescript
import { getConnection } from '../utils/db';

const connection = await getConnection();
try {
  await connection.beginTransaction();

  await connection.execute('UPDATE accounts SET balance = balance - $1 WHERE id = $2', [amount, fromId]);
  await connection.execute('UPDATE accounts SET balance = balance + $1 WHERE id = $2', [amount, toId]);

  await connection.commit();
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  connection.release();
}
```

## Type Exports

```typescript
// Available imports from '../utils/db'
import {
  Pool,
  PoolClient,
  PoolConnection,
  QueryResultRow,
  // Types
  ResultSetHeader,
  RowDataPacket,
  execute,
  generateBulkPlaceholders,
  generateInPlaceholders,
  getConnection,
  // Functions
  query,
  setTenantContext,
  setUserContext,
  transaction,
} from '../utils/db';
```

> **Note:** `FieldPacket` and `RLSContextOptions` are internal types — used within `db.ts` but not exported.

## Row Level Security (RLS)

PostgreSQL RLS automatically filters queries based on tenant context:

```typescript
// The transaction helper sets RLS context automatically
await transaction(
  async (connection) => {
    // This query is automatically filtered by tenant_id
    const [users] = await connection.execute<RowDataPacket[]>(
      'SELECT * FROM users', // No WHERE tenant_id needed!
    );
  },
  { tenantId: 1 },
);

// Equivalent to:
// SET app.tenant_id = '1';
// SELECT * FROM users WHERE tenant_id = 1;
```

## Best Practices

1. **Always use `$1, $2, $3` placeholders** - Never concatenate strings
2. **Use `RETURNING id`** for INSERT operations to get the new ID
3. **Pass tenant context** to transactions for RLS
4. **Use `generateBulkPlaceholders`** for batch inserts
5. **Never import pool directly** - Use the utilities

## Common Patterns

### Upsert (INSERT or UPDATE)

```typescript
const [result] = await execute<RowDataPacket[]>(
  `INSERT INTO settings (user_id, key, value, tenant_id)
   VALUES ($1, $2, $3, $4)
   ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value
   RETURNING id`,
  [userId, key, value, tenantId],
);
```

### Pagination

```typescript
const [users] = await execute<RowDataPacket[]>(
  'SELECT * FROM users WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
  [tenantId, limit, offset],
);
```

### Count with Condition

```typescript
const [countResult] = await execute<RowDataPacket[]>(
  'SELECT COUNT(*) as total FROM users WHERE tenant_id = $1 AND is_active = $2',
  [tenantId, 1],
);
const total = Number(countResult[0]?.total ?? 0);
```

---

**See also:**

- [DATABASE-MIGRATION-GUIDE.md](../../docs/DATABASE-MIGRATION-GUIDE.md) - PostgreSQL setup and RLS
- [TYPESCRIPT-STANDARDS.md](../../docs/TYPESCRIPT-STANDARDS.md) - Code standards
