# ADR-030: Zod Validation Architecture

| Metadata                | Value                                                    |
| ----------------------- | -------------------------------------------------------- |
| **Status**              | Accepted                                                 |
| **Date**                | 2026-03-07                                               |
| **Decision Makers**     | SCS Technik                                              |
| **Affected Components** | backend/src/nest/\*\*/dto/, backend/src/schemas/, shared |

---

## Context

### Problem

NestJS projects commonly use `class-validator` + `class-transformer` for request validation. This approach requires decorators on class properties, leading to:

- **No type inference**: Types must be declared separately from validation rules
- **Decorator proliferation**: Each field needs 2-5 decorators (`@IsString()`, `@IsNotEmpty()`, `@MaxLength()`, etc.)
- **Runtime-only errors**: Validation logic is invisible to TypeScript's type system
- **Difficult composition**: Extending or combining DTOs requires class inheritance hierarchies

Additionally, the project had accumulated 3 competing patterns for route parameter validation:

| Pattern                        | Files | Problem                              |
| ------------------------------ | ----- | ------------------------------------ |
| `z.preprocess` with `IdSchema` | ~12   | Imported from `common.schema.ts`     |
| Inline `z.coerce.number()`     | ~15   | Copy-pasted, no single source        |
| Custom param names (`adminId`) | ~8    | Each file re-invented the same logic |

### Requirements

1. Single validation library across all backend DTOs
2. Type inference from schemas (schema = type = validation)
3. Consistent error response format
4. Centralized, reusable building blocks for common patterns
5. Architectural enforcement via CI to prevent regression

---

## Decision

### 1. Zod as sole validation library

All request validation uses [Zod](https://zod.dev) via the `nestjs-zod` adapter. No `class-validator`, no `joi`, no manual validation.

```typescript
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const CreateUserSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(['admin', 'employee']).default('employee'),
});

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
```

### 2. `createZodDto()` pattern for all DTOs

Every DTO extends `createZodDto(Schema)`. This bridges Zod schemas to NestJS's class-based pipe system:

- The `ZodValidationPipe` reads the static `.schema` property
- TypeScript infers the DTO type from the schema automatically
- No manual type declarations needed

### 3. Global `ZodValidationPipe`

A custom pipe registered globally in `main.ts` handles all validation:

```typescript
app.useGlobalPipes(new ZodValidationPipe());
```

The pipe checks for a `.schema` property on the metatype. If present, it calls `schema.parse(value)` and formats `ZodError` into a consistent `{ message, code, details }` response.

**Future consideration**: Migrate to `APP_PIPE` provider in `AppModule` for better testability (low priority).

### 4. `z.coerce` for route params (not `z.preprocess`)

HTTP delivers all route params and query params as strings. Standardized on `z.coerce.number()` over `z.preprocess`:

```typescript
// Standard — concise, readable
z.coerce.number().int().positive();

// Rejected — verbose, same result
z.preprocess((v) => Number(v), z.number().int().positive());
```

**Rationale**: `z.coerce` is Zod's built-in API for this purpose, shorter, and idiomatic.

### 5. ID-Param-DTO-Factory (`common/dto/param.factory.ts`)

A centralized factory provides building blocks for all route parameter DTOs:

| Export                    | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `idField`                 | `z.coerce.number().int().positive()` — reusable field |
| `uuidField`               | `z.uuid()` — reusable UUID field                      |
| `IdParamDto`              | Pre-built DTO for `:id` (numeric)                     |
| `UuidIdParamDto`          | Pre-built DTO for `:id` (UUID)                        |
| `createIdParamSchema()`   | Factory for custom param names (e.g., `adminId`)      |
| `createUuidParamSchema()` | Factory for custom UUID param names                   |

Usage:

```typescript
// Simple :id route — just re-export
export { IdParamDto as TeamIdParamDto } from '../../common/dto/index.js';

// Custom param name — use factory
export const AdminIdParamSchema = createIdParamSchema('adminId');
export class AdminIdParamDto extends createZodDto(AdminIdParamSchema) {}

// Compound params — compose with idField
export const TaskParamSchema = z.object({
  machineId: idField,
  taskId: idField,
});
```

### 6. Common schemas (`schemas/common.schema.ts`)

Reusable domain schemas for cross-cutting concerns:

| Schema             | Description                                |
| ------------------ | ------------------------------------------ |
| `EmailSchema`      | Email with normalization (lowercase, trim) |
| `PasswordSchema`   | 12+ chars, 3/4 categories (NIST 800-63B)   |
| `PaginationSchema` | page, limit, offset with defaults          |
| `DateSchema`       | ISO 8601 date string                       |
| `TenantIdSchema`   | Positive integer                           |

**Note**: `IdSchema` from `common.schema.ts` is deprecated for param DTOs. Use `idField` from `common/dto/param.factory.ts` instead.

### 7. Zod stays backend-only

Zod is NOT shared to the frontend. The `@assixx/shared` package contains only plain TypeScript types and constants (see [ADR-015](./ADR-015-shared-package-architecture.md)). Frontend validation uses SvelteKit's form actions and Svelte's reactive primitives.

### 8. Architectural enforcement

Grep-based CI tests in `shared/src/architectural.test.ts` prevent regression:

- No inline `z.coerce.number()` in `*-param.dto.ts` files
- No import from `schemas/common.schema` in param DTOs
- No unsafe `(error as Error)` casts (use `getErrorMessage()`)

---

## Alternatives Considered

### A: class-validator + class-transformer

The NestJS default. Decorators on class properties.

```typescript
class CreateUserDto {
  @IsEmail() email: string;
  @IsEnum(Role) role: Role;
}
```

- **Pro**: NestJS native, large ecosystem, familiar to most NestJS developers
- **Con**: No type inference (types declared separately from validation), decorator noise, difficult composition, requires `reflect-metadata`
- **Rejected**: Schema-as-type is a fundamental advantage we won't give up

### B: Joi

Popular schema library, predecessor to Zod in many Node.js projects.

```typescript
const schema = Joi.object({ email: Joi.string().email().required() });
```

- **Pro**: Mature, extensive validation features, good error messages
- **Con**: No TypeScript type inference, separate type declarations needed, larger bundle
- **Rejected**: Same "two sources of truth" problem as class-validator

### C: io-ts

Functional programming approach to runtime types.

```typescript
const User = t.type({ email: t.string, role: t.union([t.literal('admin'), t.literal('employee')]) });
```

- **Pro**: True runtime type safety, fp-ts ecosystem
- **Con**: Steep learning curve, verbose API, small ecosystem, fp-ts dependency
- **Rejected**: Too academic for a pragmatic industrial SaaS codebase

### D: TypeBox

JSON Schema based type builder.

```typescript
const User = Type.Object({ email: Type.String({ format: 'email' }) });
```

- **Pro**: Compiles to JSON Schema (OpenAPI compatible), Fastify native support
- **Con**: Smaller community than Zod, less expressive transforms/refinements, fewer learning resources
- **Rejected**: Zod's `.transform()` and `.refine()` are essential for our use cases (email normalization, cross-field validation)

### E: Manual validation (no library)

```typescript
if (!body.email || !isValidEmail(body.email)) throw new BadRequestException('Invalid email');
```

- **Pro**: Zero dependencies, full control
- **Con**: Verbose, error-prone, no type inference, inconsistent error formats
- **Rejected**: Not scalable with 176+ DTOs

---

## Consequences

### Positive

- **Single source of truth**: Schema defines validation rules AND TypeScript types simultaneously
- **Consistent param DTOs**: 29/35 param DTOs migrated to central factory (83%), 6 domain-specific DTOs intentionally excluded
- **Regression prevention**: 4 architectural tests enforce patterns in CI
- **Composability**: `.extend()`, `.pick()`, `.omit()`, `.partial()` allow schema reuse without class inheritance
- **Error consistency**: All validation errors follow the same `{ message, code, details }` format
- **IDE support**: Full autocompletion and type checking on validated data

### Negative

- **NestJS convention deviation**: Most NestJS tutorials use class-validator; onboarding developers may need orientation
- **Global pipe registration**: Currently using `app.useGlobalPipes()` instead of `APP_PIPE` provider (less testable)
- **Zod version coupling**: Major Zod updates (v3 -> v4) require coordinated migration of all DTOs

### Mitigations

| Risk                    | Mitigation                                                         |
| ----------------------- | ------------------------------------------------------------------ |
| Developer onboarding    | `backend/docs/ZOD-INTEGRATION-GUIDE.md` with examples and patterns |
| Pattern regression      | Architectural tests in CI (`shared/src/architectural.test.ts`)     |
| Zod major version bump  | Pin Zod version, update in dedicated migration PR                  |
| Global pipe testability | Low-priority migration to `APP_PIPE` tracked in Code Audit         |

---

## References

- [Zod Documentation](https://zod.dev)
- [nestjs-zod GitHub](https://github.com/BenLorantfy/nestjs-zod)
- [backend/docs/ZOD-INTEGRATION-GUIDE.md](../../../backend/docs/ZOD-INTEGRATION-GUIDE.md)
- [docs/TYPESCRIPT-STANDARDS.md Section 7.5](../../TYPESCRIPT-STANDARDS.md) (ID Param DTO Factory)
- [ADR-015: Shared Package Architecture](./ADR-015-shared-package-architecture.md) (Zod stays backend-only)
- [ADR-007: API Response Standardization](./ADR-007-api-response-standardization.md) (error response format)
- [adr.github.io](https://adr.github.io/) (ADR methodology)
