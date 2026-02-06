# Zod Integration Guide for Assixx (NestJS)

> **Updated: 2026-01** | **Stack: NestJS 11 + Fastify + nestjs-zod**

## Overview

Zod is integrated into Assixx as the **sole validation library** using `nestjs-zod`. This provides automatic TypeScript type inference, compile-time safety, and seamless integration with NestJS decorators.

## Why Zod?

### Advantages over class-validator:

1. **Type Inference**: Automatic TypeScript types from schemas
2. **Zero Dependencies**: Smaller bundle size
3. **Better Composition**: Schemas can extend and compose each other
4. **Transform & Refine**: Built-in data transformation and custom validation
5. **Better Error Messages**: More descriptive validation errors
6. **Single Source of Truth**: Schema = Type = Validation

## Project Structure

```
backend/src/
├── nest/
│   ├── common/
│   │   └── pipes/
│   │       └── zod-validation.pipe.ts   # Custom Zod validation pipe
│   │
│   ├── [module]/
│   │   ├── dto/                         # Zod DTOs per module
│   │   │   ├── create-*.dto.ts
│   │   │   ├── update-*.dto.ts
│   │   │   ├── *-param.dto.ts
│   │   │   ├── *-query.dto.ts
│   │   │   └── index.ts                 # Barrel export
│   │   ├── [module].controller.ts
│   │   ├── [module].service.ts
│   │   └── [module].module.ts
│   │
│   ├── app.module.ts                    # Global providers (recommended)
│   └── main.ts                          # Bootstrap
│
└── schemas/
    └── common.schema.ts                 # Reusable base schemas
```

---

## Setup: Global Validation Pipe

### Best Practice: APP_PIPE Provider in Module

The recommended NestJS pattern is to register global pipes via `APP_PIPE` provider:

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { APP_PIPE } from '@nestjs/core';
import { ZodValidationPipe } from 'nestjs-zod';

@Module({
  providers: [
    {
      provide: APP_PIPE,
      useClass: ZodValidationPipe,
    },
  ],
})
export class AppModule {}
```

**Why APP_PIPE over app.useGlobalPipes()?**

| Aspect               | `APP_PIPE` Provider            | `app.useGlobalPipes()` |
| -------------------- | ------------------------------ | ---------------------- |
| Dependency Injection | Works                          | Does NOT work          |
| Testing              | Easy to mock                   | Harder to mock         |
| Consistency          | Same pattern as guards/filters | Different pattern      |
| Module Context       | Has access to module providers | No module context      |

### Current Assixx Implementation

Assixx uses `app.useGlobalPipes()` in `main.ts`:

```typescript
// main.ts (current)
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe.js';

function setupGlobalMiddleware(app: NestFastifyApplication): void {
  app.useGlobalPipes(new ZodValidationPipe());
  // ...
}
```

**Note:** This works but is not the recommended pattern. Consider migrating to APP_PIPE for better testability.

---

## Custom Validation Pipe

Assixx uses a custom `ZodValidationPipe` that formats errors consistently:

```typescript
// common/pipes/zod-validation.pipe.ts
import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { ZodError, z } from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema?: z.ZodType) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Schema from constructor OR from nestjs-zod DTO
    if (this.schema !== undefined) {
      return this.validate(value, this.schema);
    }

    const metatype = metadata.metatype as { schema?: z.ZodType } | undefined;
    if (metatype?.schema !== undefined) {
      return this.validate(value, metatype.schema);
    }

    return value;
  }

  private validate(value: unknown, schema: z.ZodType): unknown {
    try {
      return schema.parse(value);
    } catch (error: unknown) {
      if (error instanceof ZodError) {
        throw new BadRequestException({
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
            code: issue.code,
          })),
        });
      }
      throw error;
    }
  }
}
```

---

## Optional: Response Serialization

nestjs-zod provides `ZodSerializerInterceptor` for response validation:

```typescript
// app.module.ts (optional enhancement)
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod';

@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
```

**Benefits:**

- Prevents accidental data leaks (e.g., password in response)
- Validates response structure at runtime
- Documents response schema for OpenAPI

**Usage with @ZodResponse:**

```typescript
import { ZodResponse } from 'nestjs-zod';

const UserResponseSchema = z.object({
  id: z.number(),
  email: z.string(),
  // password is NOT included - prevents leaks!
});

@Controller('users')
class UsersController {
  @Get(':id')
  @ZodResponse(UserResponseSchema)
  async findOne(@Param('id') id: number) {
    return this.usersService.findOne(id);
    // Response is validated against UserResponseSchema
  }
}
```

---

## Creating DTOs

### Basic DTO Pattern

```typescript
// dto/create-user.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

import { EmailSchema, PasswordSchema } from '../../../schemas/common.schema.js';

// 1. Define Zod schema
export const CreateUserSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'employee']).default('employee'),
});

// 2. Create DTO class (type inference automatic!)
export class CreateUserDto extends createZodDto(CreateUserSchema) {}
```

### Controller Integration

```typescript
// users.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';

import { CreateUserDto, ListUsersQueryDto, UserIdParamDto } from './dto/index.js';

@Controller('users')
export class UsersController {
  // POST - Body validation
  @Post()
  async create(@Body() dto: CreateUserDto) {
    // dto is validated AND fully typed
    return this.usersService.create(dto);
  }

  // GET - Query validation
  @Get()
  async findAll(@Query() query: ListUsersQueryDto) {
    // query.page and query.limit are numbers!
    return this.usersService.findAll(query);
  }

  // GET - Param validation
  @Get(':id')
  async findOne(@Param() params: UserIdParamDto) {
    // params.id is a number!
    return this.usersService.findOne(params.id);
  }
}
```

---

## Anti-Patterns to Avoid

### 1. Manual Pipe Instantiation (Redundant)

```typescript
// BAD - redundant when global pipe exists
@Get()
async findAll(
  @Query(new ZodValidationPipe(ListUsersQuerySchema)) dto: ListUsersQueryDto
) { ... }

// GOOD - global pipe handles validation automatically
@Get()
async findAll(@Query() dto: ListUsersQueryDto) { ... }
```

**Exception:** Manual instantiation is only needed for edge cases where you need different error handling per endpoint.

### 2. Mixing class-validator and Zod

```typescript
// BAD - don't mix validation libraries
import { IsEmail } from 'class-validator';
import { z } from 'zod';

class UserDto {
  @IsEmail()  // class-validator
  email: string;
}

// GOOD - Zod only
export class UserDto extends createZodDto(
  z.object({ email: z.string().email() })
) {}
```

### 3. Schema Definition Inside Controller

```typescript
// BAD - schema defined inline
@Post()
async create(@Body() dto: z.infer<typeof z.object({ ... })>) { ... }

// GOOD - schema in DTO file
@Post()
async create(@Body() dto: CreateUserDto) { ... }
```

---

## Common Schemas

### `common.schema.ts`

Reusable schemas for common patterns:

| Schema             | Description                                |
| ------------------ | ------------------------------------------ |
| `IdSchema`         | ID with string-to-number conversion        |
| `EmailSchema`      | Email with normalization (lowercase, trim) |
| `PasswordSchema`   | 12+ chars, 3/4 categories (NIST 800-63B)   |
| `UsernameSchema`   | 3-255 chars, lowercase                     |
| `RoleSchema`       | Enum: admin, employee, root                |
| `StatusSchema`     | Enum: active, inactive                     |
| `PaginationSchema` | page, limit, offset with defaults          |
| `DateSchema`       | ISO 8601 date string                       |
| `TenantIdSchema`   | Positive integer, not 0                    |

### Usage

```typescript
import { EmailSchema, PaginationSchema } from '../../../schemas/common.schema.js';

export const ListUsersQuerySchema = PaginationSchema.extend({
  search: z.string().optional(),
  role: z.enum(['admin', 'employee']).optional(),
});
```

---

## Schema Composition

```typescript
// Base schema (reusable)
const BaseUserSchema = z.object({
  email: EmailSchema,
  firstName: z.string().optional(),
  lastName: z.string().optional(),
});

// Extend for create
const CreateUserSchema = BaseUserSchema.extend({
  password: PasswordSchema,
  role: z.enum(['admin', 'employee']).default('employee'),
});

// Partial for update (all fields optional)
const UpdateUserSchema = BaseUserSchema.partial();

// Pick specific fields
const ProfileSchema = CreateUserSchema.pick({ email: true, firstName: true });

// Omit sensitive fields
const PublicUserSchema = CreateUserSchema.omit({ password: true });
```

---

## Type Coercion

HTTP sends everything as strings. Use `z.coerce` for automatic conversion:

```typescript
// URL params and query params are ALWAYS strings!

// WRONG - expects number, gets string
z.number(); // Fails for "123"

// CORRECT - coerce to number
z.coerce.number(); // "123" → 123

// Examples
const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
```

---

## Optional vs Nullable

```typescript
// Optional: can be undefined (field omitted)
z.string().optional(); // string | undefined

// Nullable: can be null (explicitly null)
z.string().nullable(); // string | null

// Both: can be undefined OR null
z.string().nullable().optional(); // string | null | undefined

// With default
z.string().optional().default(''); // Always string after parsing
```

---

## Refinements & Transforms

### Cross-Field Validation

```typescript
const ChangePasswordSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    message: 'New password must be different',
    path: ['newPassword'],
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
```

### Data Transformation

```typescript
const EmailSchema = z.string().email().toLowerCase().trim();

const NameSchema = z.string().transform((val) => val.trim().toUpperCase());
```

---

## Error Response Format

Validation errors are formatted consistently:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": [
    {
      "field": "email",
      "message": "Invalid email address",
      "code": "invalid_string"
    },
    {
      "field": "password",
      "message": "Password must be at least 12 characters",
      "code": "too_small"
    }
  ]
}
```

---

## Testing

### Unit Testing Schemas

```typescript
describe('CreateUserSchema', () => {
  it('should validate correct user', () => {
    const result = CreateUserSchema.safeParse({
      email: 'john@example.com',
      password: 'SecurePass123!',
    });

    expect(result.success).toBe(true);
  });

  it('should reject weak password', () => {
    const result = CreateUserSchema.safeParse({
      email: 'john@example.com',
      password: 'weak',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path).toEqual(['password']);
  });
});
```

### E2E Testing

```typescript
describe('POST /users', () => {
  it('should return 400 for invalid data', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v2/users')
      .send({ email: 'invalid', password: 'weak' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toContainEqual(expect.objectContaining({ field: 'email' }));
  });
});
```

---

## Current Status

### Completed

- All 176 DTO files created with `nestjs-zod`
- All v2 routes use Zod validation
- express-validator removed

### Architecture

| Component      | Implementation                    |
| -------------- | --------------------------------- |
| Framework      | NestJS 11 + Fastify               |
| Validation     | Zod + nestjs-zod                  |
| DTOs           | `createZodDto(Schema)`            |
| Global Pipe    | Custom `ZodValidationPipe`        |
| Registration   | `app.useGlobalPipes()` in main.ts |
| Common Schemas | `common.schema.ts`                |

### Potential Improvements

| Current                    | Best Practice              | Priority |
| -------------------------- | -------------------------- | -------- |
| `app.useGlobalPipes()`     | `APP_PIPE` provider        | Low      |
| No response validation     | `ZodSerializerInterceptor` | Medium   |
| Manual pipe in audit-trail | Remove (redundant)         | Low      |

---

## Resources

- [Zod Documentation](https://zod.dev)
- [nestjs-zod GitHub](https://github.com/BenLorantfy/nestjs-zod)
- [NestJS Pipes Documentation](https://docs.nestjs.com/pipes)

---

**Maintained by:** Assixx Development Team
**Last Updated:** 2026-01
**Version:** 2.1.0 (Best Practices Update)
