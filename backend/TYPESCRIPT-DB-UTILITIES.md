# TypeScript Database Utilities Documentation

## Problem Statement

The Assixx backend uses both a real MySQL2 Pool in production and a MockDatabase for testing. These have incompatible type signatures, causing TypeScript union type errors:

```
Error: This expression is not callable.
Each member of the union type has signatures, but none of those signatures are compatible with each other.
```

## Solution: Centralized Database Utilities

Created `/src/utils/db.ts` to provide type-safe wrappers that handle both Pool and MockDatabase seamlessly.

## Usage

### Basic Queries

```typescript
import { execute, query, RowDataPacket, ResultSetHeader } from "../utils/db";

// SELECT queries
const [users] = await execute<RowDataPacket[]>("SELECT * FROM users WHERE tenant_id = ?", [tenantId]);

// INSERT queries
const [result] = await execute<ResultSetHeader>("INSERT INTO users (email, name) VALUES (?, ?)", [email, name]);
const userId = result.insertId;

// UPDATE queries
const [updateResult] = await execute<ResultSetHeader>("UPDATE users SET name = ? WHERE id = ?", [newName, userId]);
const affectedRows = updateResult.affectedRows;
```

### Transactions

```typescript
import { transaction } from "../utils/db";

const result = await transaction(async (connection) => {
  // All queries in this block are part of the transaction
  const [userResult] = await connection.execute<ResultSetHeader>("INSERT INTO users (email) VALUES (?)", [email]);

  await connection.execute("INSERT INTO profiles (user_id) VALUES (?)", [userResult.insertId]);

  return userResult.insertId;
});
```

### Getting a Connection

```typescript
import { getConnection } from "../utils/db";

const connection = await getConnection();
try {
  // Use connection
  await connection.execute("...");
} finally {
  connection.release();
}
```

## Migration Guide

### Before (Causes TypeScript Errors)

```typescript
import pool from "../database";
import { Pool } from "mysql2/promise";

// This causes union type errors
const [rows] = await pool.query("SELECT * FROM users");
```

### After (Type-Safe)

```typescript
import { execute, RowDataPacket } from "../utils/db";

// This works with both Pool and MockDatabase
const [rows] = await execute<RowDataPacket[]>("SELECT * FROM users");
```

## Implementation Details

The utilities use TypeScript's type narrowing and conditional logic:

```typescript
export async function execute<T extends RowDataPacket[] | ResultSetHeader>(
  sql: string,
  params?: unknown[]
): Promise<[T, FieldPacket[]]> {
  if ("execute" in pool && typeof pool.execute === "function") {
    const result = await (pool as unknown as Pool).execute(sql, params);
    // Handle both MySQL2 tuple and MockDatabase direct return
    if (Array.isArray(result) && result.length === 2) {
      return result as [T, FieldPacket[]];
    }
    return [result as T, []];
  }
  // Fallback to query for MockDatabase
  return query<T>(sql, params);
}
```

## Best Practices

1. **Always import from utils/db**: Never import pool directly
2. **Use proper type parameters**: Specify RowDataPacket[] or ResultSetHeader
3. **Handle both return formats**: MySQL2 returns tuples, MockDatabase may not
4. **Use transactions for multi-step operations**: Ensures atomicity

## Type Exports

The module also re-exports commonly used types:

```typescript
export type { RowDataPacket, ResultSetHeader, FieldPacket, PoolConnection };
```

This ensures consistent type usage across the codebase.
