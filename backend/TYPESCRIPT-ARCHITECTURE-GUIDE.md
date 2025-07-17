# TypeScript Architecture Guide

## Overview

This document describes the TypeScript architecture implemented in the Assixx backend. It serves as the central reference for developers working with the type-safe route handlers and security middleware.

**CRITICAL**: This guide has been updated after successfully migrating from 426 TypeScript errors to 0. The patterns described here are battle-tested and MUST be followed to maintain type safety.

## Core Components

### 1. Request Types (`/src/types/request.types.ts`)

The system defines specific request interfaces extending Express.Request:

```typescript
interface AuthenticatedRequest extends Request {
  user: AuthUser;
}

interface ParamsRequest<P = any> extends AuthenticatedRequest {
  params: P;
}

interface BodyRequest<B = any> extends AuthenticatedRequest {
  body: B;
}

interface QueryRequest<Q = any> extends AuthenticatedRequest {
  query: Q;
}
```

### 2. Typed Route Handlers (`/src/utils/routeHandlers.ts`)

Due to Express.js type incompatibilities, we use wrapper functions:

```typescript
import { typed } from "../utils/routeHandlers";

// For authenticated routes
router.get(
  "/profile",
  ...security.user(),
  typed.auth(async (req, res) => {
    // req is AuthenticatedRequest
    // req.user is fully typed
  })
);

// For routes with params
router.get(
  "/user/:id",
  ...security.admin(),
  typed.params<{ id: string }>(async (req, res) => {
    const userId = req.params.id; // typed as string
  })
);

// For routes with body
router.post(
  "/create",
  ...security.admin(validateCreateUser),
  typed.body<CreateUserBody>(async (req, res) => {
    const { email, password } = req.body; // fully typed
  })
);
```

### 3. Security Middleware (`/src/middleware/security.ts`)

Pre-configured security stacks for different endpoint types:

```typescript
// Public endpoints (no auth, rate limited)
router.get("/public", ...security.public(), handler);

// Authenticated user endpoints
router.get("/profile", ...security.user(), handler);

// Admin-only endpoints
router.get("/admin/users", ...security.admin(), handler);

// With validation
router.post("/user", ...security.admin(validateCreateUser), handler);
```

## Implementation Guidelines

### Creating New Routes

1. Import required components:

```typescript
import { Router } from "express";
import { security } from "../middleware/security";
import { typed } from "../utils/routeHandlers";
import { successResponse, errorResponse } from "../types/response.types";
```

2. Define request interfaces if needed:

```typescript
interface CreateUserBody {
  email: string;
  password: string;
  role: string;
}
```

3. Implement route with proper typing:

```typescript
router.post(
  "/users",
  ...security.admin(validateCreateUser),
  typed.body<CreateUserBody>(async (req, res) => {
    try {
      const { email, password, role } = req.body;
      const tenantId = req.user.tenantId;

      // Implementation

      res.json(successResponse(result));
    } catch (error) {
      res.status(500).json(errorResponse("Server error", 500));
    }
  })
);
```

### Database Queries

**IMPORTANT**: Due to TypeScript union type issues between mysql2 Pool and MockDatabase, always use the centralized database utilities from `/src/utils/db.ts`:

```typescript
import { execute, query, getConnection, transaction, RowDataPacket, ResultSetHeader } from "../utils/db";

// SELECT queries - use execute or query
const [rows] = await execute<RowDataPacket[]>("SELECT * FROM users WHERE id = ?", [userId]);

// INSERT/UPDATE/DELETE queries
const [result] = await execute<ResultSetHeader>("INSERT INTO users (email, password) VALUES (?, ?)", [
  email,
  hashedPassword,
]);
const insertId = result.insertId;

// Transactions
await transaction(async (connection) => {
  await connection.execute("INSERT INTO users (email) VALUES (?)", [email]);
  await connection.execute("INSERT INTO profiles (user_id) VALUES (LAST_INSERT_ID())", []);
});
```

**Never import pool directly from database.ts or config/database.ts**. The centralized utilities handle the Pool/MockDatabase union type issues automatically.

📚 **See [TypeScript Database Utilities](./TYPESCRIPT-DB-UTILITIES.md) for detailed documentation and migration guide.**

### Error Handling

Use the standardized error handler:

```typescript
import { getErrorMessage } from "../utils/errorHandler";

try {
  // Your code
} catch (error) {
  console.error("Operation failed:", error);
  const message = getErrorMessage(error);
  res.status(500).json(errorResponse(message, 500));
}
```

## Migration from Old Patterns

### Old Pattern:

```typescript
router.post("/endpoint", authenticateToken as any, authorizeRole("admin") as any, async (req: any, res: any) => {
  // Untyped implementation
});
```

### New Pattern:

```typescript
router.post(
  "/endpoint",
  ...security.admin(validationRules),
  typed.body<RequestBody>(async (req, res) => {
    // Fully typed implementation
  })
);
```

## File Structure

```
backend/src/
├── middleware/
│   ├── auth-refactored.ts    # Authentication middleware
│   ├── security.ts           # Security middleware stacks
│   └── validation.ts         # Validation schemas
├── types/
│   ├── request.types.ts      # Request interfaces
│   ├── response.types.ts     # Response helpers
│   └── middleware.types.ts   # Middleware types (includes ValidationMiddleware)
├── utils/
│   ├── routeHandlers.ts      # Typed route wrappers
│   ├── errorHandler.ts       # Error handling utilities
│   └── db.ts                 # Database utilities (CRITICAL for TypeScript)
└── routes/
    └── *.ts                  # Route implementations
```

## Security Considerations

1. Always use the appropriate security stack for your endpoint type
2. Never bypass type checking with `as any`
3. Include tenant_id in all multi-tenant queries
4. Validate all user input using express-validator schemas
5. Use parameterized queries to prevent SQL injection

## References

- [TypeScript Security Best Practices](../../docs/TYPESCRIPT-SECURITY-BEST-PRACTICES.md)
- [User Update Security Fix](./USER_UPDATE_SECURITY_FIX_SUMMARY.md)
- [Phase 2 Migration Guide](../../docs/PHASE2-MIGRATION-GUIDE.md)
- [Database Migration Guide](../../docs/DATABASE-MIGRATION-GUIDE.md)
- [TypeScript Database Utilities](./TYPESCRIPT-DB-UTILITIES.md) - **MUST READ for database operations**

## Common Patterns

### Multi-tenant Query Pattern

```typescript
import { execute, RowDataPacket } from "../utils/db";

const [users] = await execute<RowDataPacket[]>("SELECT * FROM users WHERE tenant_id = ? AND role = ?", [
  req.user.tenant_id,
  "employee",
]);
```

### File Upload Pattern

```typescript
router.post(
  "/upload",
  ...security.user(),
  upload.single("file"),
  typed.auth(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(errorResponse("No file uploaded", 400));
    }
    // Process file
  })
);
```

### Pagination Pattern

```typescript
interface PaginationQuery {
  page?: string;
  limit?: string;
}

router.get(
  "/items",
  ...security.user(),
  typed.query<PaginationQuery>(async (req, res) => {
    const page = parseInt(req.query.page || "1");
    const limit = parseInt(req.query.limit || "10");
    // Implementation
  })
);
```

## Testing

When testing typed routes, use proper type assertions:

```typescript
import request from "supertest";
import app from "../app";

describe("User Routes", () => {
  it("should create user with proper types", async () => {
    const response = await request(app).post("/api/users").set("Authorization", `Bearer ${token}`).send({
      email: "test@example.com",
      password: "SecurePass123",
      role: "employee",
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
  });
});
```

## Troubleshooting

### Type Errors After Migration

If you encounter type errors after migration:

1. Ensure all imports are from the new typed modules
2. Remove any `as any` type assertions
3. Use the appropriate typed wrapper for your route type
4. Check that request interfaces match your actual usage

### Common Issues

1. **"Type 'RequestHandler' is not assignable"**
   - Solution: Use typed route wrappers instead of direct type assertions

2. **"Property does not exist on type 'Request'"**
   - Solution: Use AuthenticatedRequest or appropriate typed request interface

3. **"Cannot find module"**
   - Solution: Ensure all imports use correct paths and .js extensions in production

4. **"This expression is not callable. Each member of the union type..."** (Pool/MockDatabase)
   - Solution: ALWAYS use `import { execute, query } from '../utils/db'` instead of direct pool imports
   - Never use `pool.query()` or `pool.execute()` directly

5. **ValidationMiddleware type errors**
   - Solution: Import from `middleware.types.ts` which includes proper union type with RequestHandler

6. **"Type assertion expressions can only be used in TypeScript files"**
   - Solution: Use `unknown` instead of `any` for type assertions: `as unknown as TargetType`
