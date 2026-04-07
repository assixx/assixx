# Assixx TypeScript Standards

> **Version:** 4.4.0
> **Updated:** 2026-04-07
> **Stack:** NestJS 11 + Fastify | SvelteKit 5 | PostgreSQL 17 + `pg`
> **Based on:** ESLint + Prettier configs, Power of Ten Rules (NASA/JPL)
> **Validation:** Zod schemas via `nestjs-zod` (NOT class-validator)
> **Compiler ADR:** [ADR-041](./infrastructure/adr/ADR-041-typescript-compiler-configuration.md)

Code that violates these standards will NOT be merged.

**Strict-Everywhere Policy** ([ADR-041](./infrastructure/adr/ADR-041-typescript-compiler-configuration.md)):
Production build configs (`backend/tsconfig.build.json`) MUST inherit the same
strict flags as dev type-checks. Weakening any strict flag is forbidden, even
in build-only configs. Reviewers must reject PRs that override strict flags
to `false`.

---

## 1. Compiler Configuration

### 1.1 tsconfig.base.json

Non-negotiable strict settings based on Power of Ten Rules:

```jsonc
{
  "compilerOptions": {
    // Strict Type Checking
    "strict": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitAny": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "useUnknownInCatchVariables": true,

    // Code Quality
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,

    // Advanced Strictness
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitOverride": true,

    // TS 5.6+ Strictness Additions (ADR-041)
    "noUncheckedSideEffectImports": true, // catches typo'd `import "./missing"`
    "strictBuiltinIteratorReturn": true, // Map/Set/Array iterators return undefined

    // Dead Code Prevention
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,

    // Target & Library
    "target": "ES2022", // emit compatibility
    "lib": ["ES2024"], // IntelliSense for Node 24 native APIs
  },
}
```

**NOT enabled (yet) — tracked in [ADR-041](./infrastructure/adr/ADR-041-typescript-compiler-configuration.md) Open Items:**

- `verbatimModuleSyntax: true` — would surface 41 NestJS interface imports that need `import type` rewrites
- `isolatedDeclarations: true` — would require explicit return types on every exported object literal member
- `useDefineForClassFields: false` — defaults to `true` (matches NestJS official template, no NestJS-specific issue observed)

**FORBIDDEN — never weaken strict in any tsconfig variant:**

```jsonc
// ⛔ NEVER do this in build/test/eslint tsconfig variants:
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": false, // ⛔ ADR-041 violation
    "noImplicitAny": false, // ⛔
    "strictNullChecks": false, // ⛔
    "noUncheckedIndexedAccess": false, // ⛔
  },
}
```

### 1.2 Key Implications

**`noUncheckedIndexedAccess`** -- Array access returns `T | undefined`:

```typescript
const users: User[] = await getUsers();

// WRONG -- users[0] could be undefined
const first = users[0];
console.log(first.name); // Error: possibly undefined

// CORRECT
const first = users[0];
if (first !== undefined) {
  console.log(first.name);
}

// CORRECT -- optional chaining
console.log(users[0]?.name ?? 'No user');
```

**`exactOptionalPropertyTypes`** -- optional !== undefined:

```typescript
interface User {
  name: string;
  nickname?: string; // Can be MISSING, but NOT explicitly undefined
}

// WRONG
const user: User = { name: 'John', nickname: undefined }; // Error

// CORRECT
const user: User = { name: 'John' }; // nickname omitted entirely
```

**`noPropertyAccessFromIndexSignature`** -- bracket access for index signatures:

```typescript
interface Config {
  [key: string]: string;
}

const config: Config = { apiKey: 'secret' };

// WRONG
console.log(config.apiKey); // Error

// CORRECT
console.log(config['apiKey']);
```

### 1.3 Path Aliases

**Backend** (`backend/tsconfig.json`):

```json
{
  "baseUrl": "./src",
  "paths": {
    "@/*": ["./*"],
    "@controllers/*": ["controllers/*"],
    "@models/*": ["models/*"],
    "@middleware/*": ["middleware/*"],
    "@services/*": ["services/*"],
    "@utils/*": ["utils/*"],
    "@types/*": ["types/*"]
  }
}
```

**Frontend** (`frontend/tsconfig.json`):

```json
{
  "baseUrl": "./src",
  "paths": {
    "@/*": ["./*"],
    "@scripts/*": ["scripts/*"],
    "@styles/*": ["styles/*"],
    "@components/*": ["components/*"],
    "@types/*": ["types/*"]
  }
}
```

Backend uses NestJS DI -- `DatabaseService` via constructor injection, never direct imports.

---

## 2. Type Safety

### 2.1 No `any`

```typescript
// WRONG
function processData(data: any): void { ... }

// CORRECT -- unknown with type guard
function processData(data: unknown): void {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    console.info((data as { value: unknown }).value);
  }
}

// CORRECT -- specific type
interface DataPayload {
  value: string;
  timestamp: number;
}

function processData(data: DataPayload): void {
  console.info(data.value);
}
```

### 2.2 Explicit Return Types on Exports

```typescript
// WRONG
export function calculate(a: number, b: number) {
  return a + b;
}

// CORRECT
export function calculate(a: number, b: number): number {
  return a + b;
}

// CORRECT -- async
export async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json() as Promise<User>;
}
```

### 2.3 Nullish Coalescing (`??`) Over Logical OR (`||`)

`||` coerces falsy values (`0`, `""`, `false`). `??` only handles `null`/`undefined`.

```typescript
// WRONG -- 0 and "" are falsy, get replaced
const port = process.env.PORT || 3000;
const name = user.name || 'Anonymous';

// CORRECT
const port = process.env.PORT ?? 3000;
const name = user.name ?? 'Anonymous';

// || only valid for actual boolean logic
const isActive = isEnabled || isForced; // both boolean
```

### 2.4 No Non-Null Assertions (`!`)

```typescript
// WRONG
const userId = req.user!.id;

// CORRECT -- early return
if (req.user === undefined || req.user === null) {
  throw new UnauthorizedException();
}
const userId = req.user.id; // now type-safe
```

### 2.5 Strict Boolean Expressions

Never use truthy/falsy checks. Always explicit.

```typescript
// WRONG
if (user.name) { ... }
if (!token) { return; }
if (items.length) { ... }

// CORRECT
if (user.name !== undefined && user.name !== null && user.name !== '') { ... }
if (token === null || token === '') { return; }
if (items.length > 0) { ... }
if (isEnabled === true) { ... }
```

### 2.6 Safe Type Casting

```typescript
// WRONG -- crash if null
const btn = document.querySelector('btn') as HTMLButtonElement;
btn.click();

// CORRECT -- include null in assertion
const btn = document.querySelector('btn') as HTMLButtonElement | null;
if (btn !== null) {
  btn.click();
}

// CORRECT -- JSON response
const data = (await response.json()) as { message?: string };
const message = data.message ?? 'No text';
```

### 2.7 Catch Variables Must Be `unknown`

```typescript
// WRONG -- error is implicitly any
promise.catch((error) => {
  console.error(error.message); // unsafe
});

// CORRECT
promise.catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown error:', error);
  }
});

// CORRECT -- type guard
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

promise.catch((error: unknown) => {
  const message = isError(error) ? error.message : String(error);
  console.error('Error:', message);
});
```

---

## 3. Variables and Functions

### 3.1 `const` Over `let`, Never `var`

```typescript
// WRONG
var oldStyle = 'bad';
let unchanged = 42; // never reassigned

// CORRECT
const immutable = 42;
let mutable = 0;
mutable += 1;
```

### 3.2 Unused Variables: `_` Prefix

```typescript
// WRONG
app.use((req, res, next, error) => { ... }); // error unused

// CORRECT
app.use((req, res, next, _error) => { ... });

// CORRECT -- destructuring rest
const { id, name, ...rest } = user;
```

### 3.3 Prefer Arrow Functions

```typescript
// WRONG
array.map(function (item) {
  return item * 2;
});

// CORRECT
array.map((item) => item * 2);

// CORRECT -- block body for complex logic
array.map((item) => {
  const doubled = item * 2;
  return doubled;
});
```

---

## 4. Async/Await

### 4.1 Always Await Promises

```typescript
// WRONG -- floating promise
fetchUser(123);

// CORRECT
await fetchUser(123);

// CORRECT -- explicit void for fire-and-forget
void fetchAnalytics();
```

### 4.2 Async Functions Return `Promise`

```typescript
// WRONG -- not marked async
function fetchData(): Promise<Data> {
  return fetch('/api/data').then((r) => r.json());
}

// CORRECT
async function fetchData(): Promise<Data> {
  const response = await fetch('/api/data');
  return response.json();
}
```

### 4.3 No Async in Void Callbacks

```typescript
// WRONG -- async in void callback
uploadMiddleware(req, res, async (err) => {
  await processFile();
});

// CORRECT -- wrap in IIFE
uploadMiddleware(req, res, (err) => {
  void (async () => {
    await processFile();
  })();
});
```

---

## 5. API Standards

### 5.1 REST URL Patterns

```typescript
// CORRECT -- plural nouns, no verbs
const API_ENDPOINTS = {
  USERS: '/api/v2/users',
  USER: '/api/v2/users/:id',
  TEAM_MEMBERS: '/api/v2/teams/:id/members',
} as const;

// WRONG
('/api/v2/getUsers'); // verb in URL
('/api/v2/user'); // singular for collection
('/api/v2/User'); // uppercase
('/api/v2/fetch-user-data'); // verb in URL
```

### 5.2 Response Types

```typescript
interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: string;
    version: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

interface ApiErrorResponse {
  success: false;
  error: {
    code: string; // "VALIDATION_ERROR", "NOT_FOUND"
    message: string; // user-friendly
    details?: Array<{ field: string; message: string }>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}
```

### 5.3 Field Naming: Always camelCase

```typescript
// CORRECT
interface User {
  id: number;
  firstName: string; // NOT first_name
  lastName: string; // NOT last_name
  createdAt: string; // NOT created_at
  isActive: boolean; // NOT is_active
  tenantId: number; // NOT tenant_id
}
```

snake_case is NEVER allowed in API fields.

---

## 6. Strings

### 6.1 Template Literals Over Concatenation

```typescript
// WRONG
const message = 'Hello ' + name + '!';

// CORRECT
const message = `Hello ${name}!`;
```

### 6.2 Restrict Template Expressions

```typescript
// WRONG -- object/boolean in template
const debug = `User: ${user}`;
const flag = `Active: ${isActive}`;

// CORRECT
const debug = `User: ${JSON.stringify(user)}`;
const flag = `Active: ${isActive ? 'Yes' : 'No'}`;

// Numbers are allowed
const price = `Price: ${amount}EUR`;
```

---

## 7. Error Handling

### 7.1 Console Methods

```typescript
// WRONG
console.log('Debug info'); // forbidden in production

// ALLOWED
console.warn('Deprecated API');
console.error('Error:', error);
console.info('Server started on port 3000');
console.debug('Debug mode:', config); // backend only
```

### 7.2 Error Objects, Not Strings

```typescript
// WRONG
return Promise.reject('Error occurred');

// CORRECT
return Promise.reject(new Error('Error occurred'));

// CORRECT -- custom error
class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### 7.3 Safe Error Message Extraction

`catch` variables are `unknown` (enforced by `useUnknownInCatchVariables`). Never cast with `(error as Error).message` — use the shared utility:

```typescript
import { getErrorMessage } from '../common/index.js';

// WRONG -- unsafe cast bypasses unknown typing
try { ... } catch (error: unknown) {
  this.logger.error(`Failed: ${(error as Error).message}`);
}

// CORRECT -- safe extraction
try { ... } catch (error: unknown) {
  this.logger.error(`Failed: ${getErrorMessage(error)}`);
}
```

`getErrorMessage()` lives in `backend/src/nest/common/utils/error.utils.ts` and handles `Error`, `string`, and unknown types safely.

**Enforced by:** Architectural test (`shared/src/architectural.test.ts`) — CI fails on `(error as Error)` usage.

### 7.4 `is_active` — Always Use `IS_ACTIVE` Constants

The `is_active` column uses integer codes: `0` = inactive, `1` = active, `3` = archived, `4` = deleted.

**Never** use hardcoded magic numbers. Always import from `@assixx/shared/constants`:

```typescript
import { IS_ACTIVE } from '@assixx/shared/constants';

// CORRECT — readable, centralized, type-safe
`SELECT * FROM users WHERE is_active = ${IS_ACTIVE.ACTIVE}`;
`UPDATE users SET is_active = ${IS_ACTIVE.DELETED} WHERE id = $1`;
`WHERE is_active IN (${IS_ACTIVE.ACTIVE}, ${IS_ACTIVE.ARCHIVED})`;
`WHERE is_active != ${IS_ACTIVE.DELETED}`;

// WRONG — magic numbers
`SELECT * FROM users WHERE is_active = 1`;
`UPDATE users SET is_active = 4 WHERE id = $1`;
```

**Enforced by:** Architectural test (`shared/src/architectural.test.ts`) — CI fails on hardcoded `is_active = N` in production code.

### 7.5 ID Param DTOs — Always Use Factory

Route param DTOs use the centralized factory in `backend/src/nest/common/dto/param.factory.ts`:

```typescript
// Custom param name — use factory
import { createZodDto } from 'nestjs-zod';

import { createIdParamSchema } from '../../common/dto/index.js';
// Compound params — use idField
import { idField } from '../../common/dto/index.js';

// Standard :id param — re-export from factory
export { IdParamDto as AssetIdParamDto, IdParamSchema as AssetIdParamSchema } from '../../common/dto/index.js';

export const AdminIdParamSchema = createIdParamSchema('adminId');
export class AdminIdParamDto extends createZodDto(AdminIdParamSchema) {}

export const CompoundParamSchema = z.object({
  adminId: idField,
  departmentId: idField,
});
```

**Never:** Inline `z.coerce.number().int().positive()` in param DTOs. Never import `IdSchema` from `common.schema.ts` in param DTOs.

**Enforced by:** Architectural test (`shared/src/architectural.test.ts`) — CI fails on inline ID validation in `*-param.dto.ts` files.

### 7.6 No `alert`/`confirm`

```typescript
// CORRECT -- custom UI
import { showError } from './auth';

// WRONG
alert('Error occurred!');

showError('Error occurred!');
```

---

## 8. DOM and Browser Patterns

### 8.1 localStorage/sessionStorage

```typescript
// WRONG -- truthy check
const token = localStorage.getItem('token');
if (token) { ... } // strict-boolean-expressions violation

// CORRECT
const token = localStorage.getItem('token');
if (token !== null && token !== '') {
  api.setAuth(token);
}

// BETTER -- helper
function getStorageValue(key: string): string | null {
  const value = localStorage.getItem(key);
  return (value !== null && value !== '') ? value : null;
}
```

### 8.2 HTMLElement Type Guards

```typescript
// WRONG -- crash if null
const button = document.querySelector('btn') as HTMLButtonElement;
button.textContent = 'Click';

// CORRECT -- null check
const button = document.querySelector('btn') as HTMLButtonElement | null;
if (button !== null) {
  button.textContent = 'Click';
}

// BEST -- instanceof (textContent guaranteed string)
const element = document.querySelector('btn');
if (element instanceof HTMLButtonElement) {
  element.textContent = 'Click';
}
```

### 8.3 Dataset Validation

```typescript
// WRONG -- unsafe assumption
const role = (element as HTMLElement).dataset.role as 'admin' | 'user';

// CORRECT -- type guard
type UserRole = 'admin' | 'user' | 'guest';

function isValidRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'user' || value === 'guest';
}

if (element instanceof HTMLElement) {
  const roleValue = element.dataset.role;
  if (isValidRole(roleValue)) {
    setUserRole(roleValue); // type-safe
  }
}
```

---

## 9. Database (PostgreSQL 17)

### 9.1 Query Patterns

Always use `DatabaseService` via NestJS DI. Never import pool directly.
Always use `$1, $2, $3` placeholders (NOT `?`).

```typescript
// DatabaseService injected via constructor
interface UserRow {
  id: number;
  email: string;
}

// SELECT
const users = await this.db.query<UserRow>('SELECT * FROM users WHERE id = $1 AND tenant_id = $2', [userId, tenantId]);

// INSERT with RETURNING
const rows = await this.db.query<{ id: number }>(
  'INSERT INTO users (email, password, tenant_id) VALUES ($1, $2, $3) RETURNING id',
  [email, hashedPassword, tenantId],
);
const insertId = rows[0]?.id;

// UPDATE/DELETE
await this.db.query('UPDATE users SET name = $1 WHERE id = $2 AND tenant_id = $3', [newName, userId, tenantId]);
```

### 9.2 Multi-Tenant Transactions (RLS)

```typescript
await this.db.tenantTransaction(async (client) => {
  await client.query('INSERT INTO users (email, tenant_id) VALUES ($1, $2) RETURNING id', [email, tenantId]);
  await client.query('INSERT INTO profiles (user_id, tenant_id) VALUES ($1, $2)', [userId, tenantId]);
});
```

### 9.3 Validation

All input validated with Zod schemas via `nestjs-zod`. See [ZOD-INTEGRATION-GUIDE.md](../backend/docs/ZOD-INTEGRATION-GUIDE.md).

---

## 10. Import/Export

### 10.1 No Duplicate Imports

```typescript
// WRONG
import { useState } from 'react';
import { useEffect } from 'react';

// CORRECT
import { useState, useEffect } from 'react';
```

### 10.2 Object Shorthand

```typescript
// WRONG
const user = { name: name, email: email, save: function() { } };

// CORRECT
const user = { name, email, save() { } };
```

### 10.3 Operator Precedence

```typescript
// WRONG -- ambiguous
const time = now.getTime() - 24 * 60 * 60 * 1000;

// CORRECT -- parentheses for clarity
const dayInMs = 24 * 60 * 60 * 1000;
const time = now.getTime() - dayInMs;
```

---

## 11. Formatting (Prettier)

Formatting is automated. No discussions.

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "experimentalTernaries": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-css-order"],
  "importOrder": ["^react", "^@?\\w", "^(@/|src/)", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
```

Import sort order: React -> External packages -> Internal aliases -> Relative imports.

---

## 12. Tooling

### 12.1 Pre-Commit Checklist

Run before every commit:

```bash
pnpm run format       # 1. Format
pnpm run lint         # 2. Lint (0 errors required)
pnpm run type-check   # 3. TypeScript (0 errors required)
pnpm run build        # 4. Build
```

### 12.2 ESLint Commands

```bash
pnpm run lint          # show all errors
pnpm run lint:fix      # auto-fix
pnpm run type-check    # TypeScript only
pnpm run format        # Prettier format
pnpm run format:check  # check without fixing
```

### 12.3 ESLint Plugins

| Plugin                         | Purpose                                    |
| ------------------------------ | ------------------------------------------ |
| `@typescript-eslint`           | Core TypeScript rules                      |
| `eslint-plugin-promise`        | Promise best practices, no floating        |
| `eslint-plugin-sonarjs`        | Code smell detection, cognitive complexity |
| `eslint-plugin-unicorn`        | Modern JavaScript patterns                 |
| `eslint-plugin-no-unsanitized` | XSS prevention (innerHTML, etc.)           |

### 12.4 Test File Exceptions

Only in `*.test.ts` / `*.spec.ts`:

- `any` is allowed for mock data
- `console.log` is allowed

### 12.5 Database Layer Exceptions

Files in `backend/src/database/**/*.ts` have relaxed limits:

| Rule                     | Standard | Database Layer |
| ------------------------ | -------- | -------------- |
| `max-lines`              | 800      | 1000           |
| `max-lines-per-function` | 60       | 80             |

---

## 13. Absolute No-Gos

Immediate rejection in code review:

1. `any` without `eslint-disable` + justification
2. `||` instead of `??` for defaults
3. Missing return types on exported functions
4. Non-null assertions (`!`)
5. Unawaited promises (floating)
6. `snake_case` in API fields
7. `var` keyword
8. `console.log` in production code
9. String/number in boolean conditions without explicit checks
10. Commits with ESLint errors
11. Catch callbacks without `: unknown`
12. `(error as Error).message` — use `getErrorMessage(error)` instead
13. localStorage/sessionStorage with truthy checks instead of `!== null`
14. Type assertions (`as`) without `| null` for DOM elements
15. Dataset values without validation
16. Hardcoded `is_active = 0/1/3/4` magic numbers — use `IS_ACTIVE` from `@assixx/shared/constants`
17. Inline `z.coerce.number().int().positive()` in param DTOs — use `idField`/`createIdParamSchema` from `common/dto`

---

## 14. Naming Conventions

| Context             | Convention    | Example                   |
| ------------------- | ------------- | ------------------------- |
| Variables/Functions | `camelCase`   | `getUserName`, `isActive` |
| Types/Interfaces    | `PascalCase`  | `UserResponse`, `ApiData` |
| Constants/Enums     | `UPPER_SNAKE` | `MAX_RETRIES`, `API_URL`  |
| Files               | `kebab-case`  | `user-service.ts`         |
| Booleans            | `is/has/can`  | `isAdmin`, `hasAccess`    |

---

## 15. New File Checklist

- [ ] Imports sorted (Prettier handles this)
- [ ] All exported functions have explicit return types
- [ ] No `any` types
- [ ] Interfaces/Types exported and documented
- [ ] camelCase for variables/properties
- [ ] PascalCase for Types/Interfaces/Classes
- [ ] `pnpm run lint` = 0 errors
- [ ] `pnpm run type-check` = 0 errors

---

## 16. Quick Reference

| Category  | Use                       | Avoid               |
| --------- | ------------------------- | ------------------- |
| Types     | `unknown`, specific types | `any`               |
| Defaults  | `??` (nullish coalescing) | `\|\|` (logical or) |
| Strings   | Template literals         | Concatenation       |
| Functions | Arrow functions           | `function` keyword  |
| Variables | `const`, `let`            | `var`               |
| Async     | `async/await`             | `.then()` chains    |
| Loops     | `for...of`, `.map()`      | `for...in`          |
| Checks    | Explicit (`!== null`)     | Truthy/falsy        |
| Exports   | Named exports             | Default exports     |
| Quotes    | Single quotes (`'`)       | Double quotes (`"`) |

---

## References

### Official TypeScript Documentation

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) -- comprehensive language guide
- [Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html) -- primitives, unions, type aliases, interfaces
- [Functions](https://www.typescriptlang.org/docs/handbook/2/functions.html) -- call signatures, generics, overloads, rest params
- [Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html) -- optional, readonly, index signatures, extending
- [Classes](https://www.typescriptlang.org/docs/handbook/2/classes.html) -- visibility, static, abstract, implements
- [Conditional Types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html) -- distributive, infer
- [Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html) -- Partial, Required, Pick, Omit, Record, ReturnType, Awaited
- [TSConfig Reference](https://www.typescriptlang.org/tsconfig) -- all compiler options explained

### Project-Specific

- [Power of Ten Rules](./POWER-OF-TEN-RULES.md) -- NASA/JPL rules adapted for TypeScript
- [Zod Integration Guide](../backend/docs/ZOD-INTEGRATION-GUIDE.md) -- validation with nestjs-zod
- [Database Migration Guide](./DATABASE-MIGRATION-GUIDE.md) -- PostgreSQL patterns, RLS
- [Code of Conduct](./CODE-OF-CONDUCT.md) -- hard limits, ESLint enforcement

---

## Changelog

| Version | Date       | Changes                                                                                                                                                       |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4.4.0   | 2026-04-07 | ADR-041: Strict-everywhere policy, removed dead `baseUrl`/`paths`, added `noUncheckedSideEffectImports` + `strictBuiltinIteratorReturn`, lib bumped to ES2024 |
| 4.3.0   | 2026-03-07 | Added Section 7.5 ID Param DTO Factory, No-Go #17, architectural test for inline ID validation in param DTOs                                                  |
| 4.2.0   | 2026-03-07 | Added Section 7.4 IS_ACTIVE constants, No-Go #16 magic numbers, architectural test for is_active enforcement                                                  |
| 4.1.0   | 2026-03-07 | Added Section 7.3 getErrorMessage() pattern, No-Go #15 (error as Error) cast, architectural test enforcement                                                  |
| 4.0.0   | 2026-02-17 | Major restructure: categorized, removed redundancy, removed legacy Express patterns, added official TS references, added changelog                            |
| 3.1.0   | 2025-12-16 | Added DOM/browser patterns, dataset validation, catch callback rules                                                                                          |
| 3.0.0   | 2025-10-xx | PostgreSQL migration, NestJS DI patterns, Zod validation                                                                                                      |
| 2.0.0   | 2025-08-xx | Power of Ten integration, strict tsconfig                                                                                                                     |
| 1.0.0   | 2025-07-xx | Initial TypeScript standards                                                                                                                                  |
