# Zod Integration Guide for Assixx

## Overview

Zod has been integrated into the Assixx project as a modern, type-safe validation library that provides automatic TypeScript type inference. This guide documents the implementation patterns, migration strategy, and best practices.

## Why Zod?

### Advantages over express-validator:

1. **Type Inference**: Automatic TypeScript types from schemas
2. **Zero Dependencies**: Smaller bundle size
3. **Better Composition**: Schemas can extend and compose each other
4. **Transform & Refine**: Built-in data transformation and custom validation
5. **Better Error Messages**: More descriptive validation errors
6. **Performance**: Single validation pass, no middleware chain overhead

## Project Structure

```
backend/src/
├── middleware/
│   └── validation.zod.ts       # Zod validation middleware
├── schemas/
│   ├── common.schema.ts        # Reusable common schemas
│   └── user.schema.ts          # User-specific schemas
└── routes/v2/users/
    ├── users.validation.ts      # Existing express-validator (to be migrated)
    ├── users.validation.zod.ts # Zod validation schemas
    └── example-zod-route.ts    # Example implementation
```

## Core Components

### 1. Validation Middleware (`validation.zod.ts`)

```typescript
// Validate request body
export function validateBody<T extends ZodSchema>(schema: T);

// Validate query parameters
export function validateQuery<T extends ZodSchema>(schema: T);

// Validate URL parameters
export function validateParams<T extends ZodSchema>(schema: T);

// Combined validation
export function validate(options: { body?: ZodSchema; query?: ZodSchema; params?: ZodSchema });
```

### 2. Common Schemas (`common.schema.ts`)

Reusable schemas for common patterns:

- `IdSchema` - ID validation with string-to-number conversion
- `EmailSchema` - Email validation with normalization
- `PasswordSchema` - Password with security requirements
- `UsernameSchema` - Username validation
- `RoleSchema` - Role enum (admin, employee, root)
- `StatusSchema` - Status enum (active, inactive)
- `PaginationSchema` - Pagination with automatic conversion
- `DateSchema` - ISO date string validation

## Usage Patterns

### Basic Schema Definition

```typescript
import { z } from 'zod';

// Simple schema
const UserSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().int().positive(),
  email: z.string().email().toLowerCase(),
});

// Type inference
type User = z.infer<typeof UserSchema>;
```

### Schema Composition

```typescript
// Base schema
const BaseUserSchema = z.object({
  username: UsernameSchema,
  email: EmailSchema,
});

// Extended schema
const CreateUserSchema = BaseUserSchema.extend({
  password: PasswordSchema,
  role: RoleSchema.default('employee'),
});

// Partial schema (all fields optional)
const UpdateUserSchema = BaseUserSchema.partial();

// Pick specific fields
const ProfileSchema = BaseUserSchema.pick({ email: true });

// Omit specific fields
const PublicUserSchema = CreateUserSchema.omit({ password: true });
```

### Transforms and Preprocessing

```typescript
// String to number conversion
const IdSchema = z.preprocess(
  (val) => (typeof val === 'string' ? parseInt(val, 10) : val),
  z.number().int().positive(),
);

// Trim and lowercase
const EmailSchema = z.string().email().toLowerCase().trim();

// Custom transform
const NameSchema = z.string().transform((val) => val.trim().toUpperCase());
```

### Custom Refinements

```typescript
// Password matching validation
const ChangePasswordSchema = z
  .object({
    current_password: z.string(),
    new_password: PasswordSchema,
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password !== data.current_password, {
    message: 'New password must be different from current password',
    path: ['new_password'],
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
```

### Conditional Validation

```typescript
// Discriminated union
const NotificationSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('email'),
    email: z.string().email(),
    subject: z.string(),
  }),
  z.object({
    type: z.literal('sms'),
    phone: z.string(),
    message: z.string().max(160),
  }),
]);

// Dynamic validation based on role
const DynamicSchema = z
  .object({
    role: RoleSchema,
    adminField: z.string().optional(),
  })
  .refine((data) => data.role !== 'admin' || data.adminField, {
    message: 'Admin field required for admin role',
    path: ['adminField'],
  });
```

### Route Integration

```typescript
import { validateBody, validateParams, validateQuery } from '../middleware/validation.zod';
import { CreateUserSchema, UserIdParamSchema, UserListQuerySchema } from '../schemas/user.schema';

// GET with query validation
router.get(
  '/users',
  validateQuery(UserListQuerySchema),
  typed.auth(async (req: Request<any, any, any, UsersListQuery>, res) => {
    // req.query is fully typed and validated
    const { page, limit, search } = req.query;
    // page and limit are numbers, not strings!
  }),
);

// POST with body validation
router.post(
  '/users',
  validateBody(CreateUserSchema),
  typed.auth(async (req: Request<any, any, CreateUserBody>, res) => {
    // req.body is fully typed and validated
    const { email, username, password } = req.body;
  }),
);

// PUT with combined validation
router.put(
  '/users/:id',
  validate({
    params: UserIdParamSchema,
    body: UpdateUserSchema,
  }),
  typed.auth(async (req, res) => {
    const userId = req.params.id; // number, not string!
    const updates = req.body; // Fully typed
  }),
);
```

### Runtime Validation

```typescript
// Validate unknown data
function processData(data: unknown) {
  const result = UserSchema.safeParse(data);

  if (!result.success) {
    // Handle validation errors
    const errors = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ValidationError(errors);
  }

  // result.data is fully typed
  return result.data;
}

// Parse with throwing (use carefully)
try {
  const user = UserSchema.parse(unknownData);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error(error.issues);
  }
}
```

## Migration Strategy

### Phase 1: Parallel Implementation (✅ COMPLETED)

- Keep existing express-validator
- Implement Zod schemas alongside
- Test both validation methods

### Phase 2: Gradual Migration (✅ COMPLETED - 2025-10-24)

**ALL v2 routes have been migrated to Zod!**

**Migration Status:**

✅ **FULLY MIGRATED v2 Routes:**

- `/api/v2/users` - All user management endpoints
- `/api/v2/auth` - Authentication endpoints
- `/api/v2/blackboard` - Blackboard/announcements
- `/api/v2/departments` - Department management
- `/api/v2/documents` - Document management
- `/api/v2/features` - Feature flag management
- `/api/v2/kvp` - KVP suggestions
- `/api/v2/teams` - Team management
- `/api/v2/shifts` - Shift planning
- `/api/v2/surveys` - Survey system
- `/api/v2/notifications` - Notification system
- `/api/v2/reports` - Reporting endpoints
- `/api/v2/machines` - Machine/equipment management

**Not Migrated (Will be removed):**

- All v1 routes - Being deprecated, no migration needed
- Secondary v2 routes (chat, calendar, root, etc.) - Being refactored/removed

### Phase 3: Cleanup (IN PROGRESS)

- ✅ All main v2 routes using Zod
- ⏳ Remove express-validator dependency from package.json
- ⏳ Delete express-validator type definitions
- ⏳ Clean up unused validation files

## Best Practices

### 1. Schema Organization

```
schemas/
├── common.schema.ts      # Shared, reusable schemas
├── user.schema.ts        # User domain schemas
├── auth.schema.ts        # Auth domain schemas
└── [domain].schema.ts    # Other domain schemas
```

### 2. Naming Conventions

- Schemas: `PascalCase` with `Schema` suffix (e.g., `UserSchema`)
- Types: `PascalCase` without suffix (e.g., `User`)
- Validation functions: `camelCase` (e.g., `validateUser`)

### 3. Type Safety

```typescript
// Always infer types from schemas
type User = z.infer<typeof UserSchema>;

// Use typed request handlers
async (req: Request<Params, any, Body, Query>, res: Response) => {
  // Full type safety
};
```

### 4. Error Handling

```typescript
// Use safeParse for non-throwing validation
const result = schema.safeParse(data);
if (!result.success) {
  // Handle errors gracefully
}

// Format errors consistently
function formatZodError(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
}
```

### 5. Performance Considerations

- Define schemas outside request handlers (singleton pattern)
- Use `.strip()` to remove unknown properties
- Use `.strict()` to reject unknown properties
- Cache compiled schemas for frequently used validations

## Common Gotchas

### 1. String-to-Number Conversion

```typescript
// Wrong: expects number, gets string from query
z.number(); // Will fail for "123"

// Right: preprocess string to number
z.preprocess((val) => (val ? parseInt(String(val), 10) : val), z.number());
```

### 2. Optional vs Nullable

```typescript
// Optional: can be undefined
z.string().optional(); // string | undefined

// Nullable: can be null
z.string().nullable(); // string | null

// Both: can be undefined or null
z.string().nullable().optional(); // string | null | undefined
```

### 3. Default Values

```typescript
// Default applied during parsing
z.string().default('default'); // Never undefined

// Default with transform
z.string()
  .optional()
  .default('')
  .transform((val) => val.toUpperCase());
```

### 4. Error Path in Refinements

```typescript
.refine(
  (data) => data.password === data.confirm,
  {
    message: 'Passwords must match',
    path: ['confirm'], // Error shows on confirm field
  }
)
```

## Testing

### Unit Testing Schemas

```typescript
describe('UserSchema', () => {
  it('should validate correct user', () => {
    const result = UserSchema.safeParse({
      username: 'john_doe',
      email: 'john@example.com',
      password: 'SecurePass123',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('john@example.com');
    }
  });

  it('should reject invalid email', () => {
    const result = UserSchema.safeParse({
      username: 'john_doe',
      email: 'invalid-email',
      password: 'SecurePass123',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['email']);
    }
  });
});
```

### Integration Testing

```typescript
describe('POST /users', () => {
  it('should create user with valid data', async () => {
    const response = await request(app).post('/users').send({
      username: 'test_user',
      email: 'test@example.com',
      password: 'TestPass123',
    });

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('test@example.com');
  });

  it('should return 400 for invalid data', async () => {
    const response = await request(app).post('/users').send({
      username: 'ab', // Too short
      email: 'invalid',
      password: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({
        field: 'username',
        message: expect.stringContaining('at least 3'),
      }),
    );
  });
});
```

## Resources

- [Zod Documentation](https://zod.dev)
- [Zod GitHub](https://github.com/colinhacks/zod)
- Test file: `src/schemas/test-zod-integration.ts`
- Example implementation: `src/routes/v2/users/example-zod-route.ts`

## Conclusion

Zod provides a powerful, type-safe validation solution that integrates seamlessly with TypeScript. The migration from express-validator to Zod will improve code maintainability, type safety, and developer experience while reducing bundle size and improving performance.

The implementation is ready for gradual migration, starting with V2 routes and expanding to the entire codebase as confidence grows.
