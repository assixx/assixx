# 📋 Assixx TypeScript Code Standards - The Definitive Style Guide

> **Version:** 3.1.0
> **Updated:** 2025-12-16
> **Based on:** ESLint & Prettier Configs + Power of Ten Rules
> **Philosophy:** MAXIMUM STRICTNESS - Zero-Tolerance for bad code
> **Database:** PostgreSQL 17 with `pg` library (NOT MySQL!)

## 🎯 Executive Summary

This document is our **Code of Conduct** - the single source of truth for TypeScript code in the Assixx project. It is based directly on our ESLint and Prettier configurations and ensures that **NO** ESLint errors or warnings occur.

**Golden Rule:** Code that violates these standards will NOT be merged.

> **Required Reading:** [Power of Ten Rules](./POWER-OF-TEN-RULES.md) - 10 rules for safety-critical code (NASA/JPL), adapted for TypeScript.

---

## ⚙️ tsconfig.base.json - Power of Ten Strict Mode

Our TypeScript configuration is based on the **Power of Ten Rules** (NASA/JPL). These settings are **NON-NEGOTIABLE**:

```jsonc
{
  "compilerOptions": {
    // === STRICT TYPE CHECKING (P10 Rule 10: Zero Warnings) ===
    "strict": true,
    "strictNullChecks": true, // Handle null/undefined explicitly
    "strictFunctionTypes": true, // Contravariant parameter types
    "strictPropertyInitialization": true, // Classes must be initialized
    "noImplicitAny": true, // NEVER implicit any
    "noImplicitThis": true,
    "useUnknownInCatchVariables": true, // catch(error) is unknown, NOT any

    // === CODE QUALITY (P10 Rule 7: Check return values) ===
    "noUnusedLocals": true, // No unused variables
    "noUnusedParameters": true, // No unused parameters
    "noImplicitReturns": true, // All paths must return
    "noFallthroughCasesInSwitch": true, // switch-case must have break/return

    // === ADVANCED STRICTNESS (P10 Rule 10: Maximum strictness) ===
    "noUncheckedIndexedAccess": true, // arr[i] is T | undefined!
    "exactOptionalPropertyTypes": true, // undefined vs "not defined"
    "noPropertyAccessFromIndexSignature": true, // obj["key"] instead of obj.key
    "noImplicitOverride": true, // Force override keyword

    // === PREVENT DEAD CODE ===
    "allowUnusedLabels": false,
    "allowUnreachableCode": false,
  },
}
```

### Important Implications:

#### `noUncheckedIndexedAccess: true`

```typescript
// ❌ WRONG - arr[0] could be undefined!
const users: User[] = await getUsers();
const firstUser = users[0];
console.log(firstUser.name); // Error: Object is possibly 'undefined'

// ✅ CORRECT - Explicit check
const firstUser = users[0];
if (firstUser !== undefined) {
  console.log(firstUser.name);
}

// ✅ CORRECT - With optional chaining
console.log(users[0]?.name ?? 'No user');
```

#### `exactOptionalPropertyTypes: true`

```typescript
interface User {
  name: string;
  nickname?: string; // Can be MISSING, but NOT undefined!
}

// ❌ WRONG
const user: User = { name: 'John', nickname: undefined }; // Error!

// ✅ CORRECT
const user: User = { name: 'John' }; // nickname missing completely
const user2: User = { name: 'Jane', nickname: 'JJ' }; // nickname present
```

#### `noPropertyAccessFromIndexSignature: true`

```typescript
interface Config {
  [key: string]: string;
}

const config: Config = { apiKey: 'secret' };

// ❌ WRONG - Looks like known property
console.log(config.apiKey); // Error!

// ✅ CORRECT - Explicit dynamic access
console.log(config['apiKey']);
```

---

## 📂 Path Aliases (tsconfig)

Both backend and frontend use path aliases for cleaner imports.

### Backend Path Aliases (`backend/tsconfig.json`)

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

```typescript
// ✅ CORRECT - Clean imports with aliases
import { execute } from '@utils/db';
import { security } from '@middleware/security';
import { UserService } from '@services/user.service';

// ❌ WRONG - Relative path hell
import { execute } from '../../../utils/db';
import { security } from '../../middleware/security';
```

### Frontend Path Aliases (`frontend/tsconfig.json`)

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

```typescript
// ✅ CORRECT - Clean frontend imports
import { showError } from '@scripts/utils/alerts';
import type { ApiResponse } from '@types/api.types';

// ❌ WRONG - Deep relative paths
import { showError } from '../../utils/alerts';
```

---

## 📁 1. Prettier Code Formatting

All code formatting is handled automatically by Prettier. **NO** discussions about formatting.

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
  "jsxSingleQuote": false,
  "quoteProps": "as-needed",
  "experimentalTernaries": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports", "prettier-plugin-css-order"],
  "importOrder": ["^react", "^@?\\w", "^(@/|src/)", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true
}
```

### Import Sorting (Auto-Organized by Prettier)

The `@trivago/prettier-plugin-sort-imports` plugin automatically organizes imports in this order:

1. React imports (if applicable)
2. External packages (`@scope/package`, `package-name`)
3. Internal aliases (`@/`, `src/`)
4. Relative imports (`./`, `../`)

### Examples

```typescript
// ✅ CORRECT - Prettier formatted
const user = {
  id: 1,
  name: 'Admin',
  roles: ['admin', 'root'],
};

const calculate = (x: number): number => x * 2;

// ❌ WRONG - Will be auto-corrected
const user={id:1,name:"Admin",roles:["admin","root"]}
const calculate = x => x * 2
```

---

## 🚫 2. TypeScript Type Safety - NO Compromises

### 2.1 NEVER use `any`

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/no-explicit-any
function processData(data: any): void {
  console.log(data.value);
}

// ✅ CORRECT - unknown with Type Guards
function processData(data: unknown): void {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    console.log((data as { value: unknown }).value);
  }
}

// ✅ CORRECT - Specific Type
interface DataPayload {
  value: string;
  timestamp: number;
}

function processData(data: DataPayload): void {
  console.log(data.value);
}
```

### 2.2 Explicit Return Types REQUIRED

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/explicit-module-boundary-types
export function calculate(a: number, b: number) {
  return a + b;
}

// ✅ CORRECT - Explicit Return Type
export function calculate(a: number, b: number): number {
  return a + b;
}

// ✅ CORRECT - Async with Promise
export async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json() as Promise<User>;
}
```

### 2.3 Nullish Coalescing (`??`) instead of Logical OR (`||`)

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/prefer-nullish-coalescing
const port = process.env.PORT || 3000;  // Problem: "0" becomes 3000
const name = user.name || 'Anonymous';  // Problem: "" becomes "Anonymous"

// ✅ CORRECT - Nullish Coalescing
const port = process.env.PORT ?? 3000;  // Only null/undefined → 3000
const name = user.name ?? 'Anonymous';  // Only null/undefined → "Anonymous"

// ✅ CORRECT - Explicit check when || is intended
const displayName = user.name || user.email || 'Anonymous';  // With comment why
```

### 2.4 No Non-Null Assertions (`!`)

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/no-non-null-assertion
const userId = req.user!.id;  // Dangerous!

// ✅ CORRECT - Explicit check
if (!req.user) {
  res.status(401).json({ error: 'Unauthorized' });
  return;
}
const userId = req.user.id;  // Now type-safe
```

### 2.5 Strict Boolean Expressions

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/strict-boolean-expressions
if (user.name) {
  // String in condition
  console.log(user.name);
}

if (!token) {
  // Truthy check not allowed
  return;
}

if (items.length) {
  // Number in condition
  processItems(items);
}

// ✅ CORRECT - Explicit Boolean Checks
if (user.name !== undefined && user.name !== null && user.name !== '') {
  console.log(user.name);
}

// ✅ CORRECT - Null/Empty String checks
const token = getAuthToken();
if (token === null || token === '') {
  return;
}

// ✅ CORRECT - Number comparisons
if (items.length > 0) {
  processItems(items);
}

// ✅ CORRECT - Boolean values
if (isEnabled === true) {
  enableFeature();
}
```

### 2.6 Nullish Coalescing vs Logical OR

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/prefer-nullish-coalescing
const name = user.name || 'Anonymous';  // || for nullable values
const count = data.count || 0;  // Problematic when count === 0

// ✅ CORRECT - Nullish coalescing for null/undefined
const name = user.name ?? 'Anonymous';
const count = data.count ?? 0;

// ✅ CORRECT - || only for real boolean logic
const isActive = isEnabled || isForced;  // Both are boolean
```

### 2.7 Safe Type Casting

```typescript
// ❌ WRONG - Unsafe casting
const btn = document.querySelector('btn') as HTMLButtonElement;
btn.click();  // Crash if null!

// ✅ CORRECT - With null check
const btn = document.querySelector('btn') as HTMLButtonElement | null;
if (btn !== null) {
  btn.click();
}

// ✅ CORRECT - Type assertion for JSON
const data = (await response.json()) as { message?: string };
const message = data.message ?? 'No text';
```

### 2.8 Avoid Alert/Confirm

```typescript
// ❌ WRONG - ESLint Error: no-alert
alert('Error occurred!');
const confirmed = confirm('Really delete?');

// ✅ CORRECT - Custom UI functions
import { showError, showSuccess } from './auth';
showError('Error occurred!');
showSuccess('Successfully saved');

// ✅ CORRECT - Modal dialogs
const confirmed = await showConfirmDialog('Really delete?');
```

---

## 📝 3. Variables and Functions

### 3.1 Unused Variables with `_` Prefix

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/no-unused-vars
app.use((req, res, next, error) => {
  // error not used
  console.log('Middleware');
  next();
});

// ✅ CORRECT - Underscore for intentionally unused
app.use((req, res, next, _error) => {
  console.log('Middleware');
  next();
});

// ✅ CORRECT - Destructuring with Rest
const { id, name, ...rest } = user; // rest ignores unused fields
```

### 3.2 Const over Let, never Var

```typescript
// ❌ WRONG - ESLint Error: prefer-const, no-var
var oldStyle = 'bad';
let unchanged = 42; // Never changed

// ✅ CORRECT
const immutable = 42;
let mutable = 0;
mutable += 1;
```

### 3.3 Prefer Arrow Functions

```typescript
// ❌ WRONG - ESLint Warning: prefer-arrow-callback
array.map(function (item) {
  return item * 2;
});

// ✅ CORRECT - Arrow Function
array.map((item) => item * 2);

// ✅ CORRECT - Arrow with block when complex
array.map((item) => {
  const doubled = item * 2;
  console.log(`Processing: ${doubled}`);
  return doubled;
});
```

---

## 🔄 4. Async/Await Best Practices

### 4.1 ALWAYS await Promises

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/no-floating-promises
fetchUser(123); // Promise is ignored!

async function process(): void {
  doAsyncWork(); // Not awaited!
}

// ✅ CORRECT - Await or handle
await fetchUser(123);

async function process(): Promise<void> {
  await doAsyncWork();
}

// ✅ CORRECT - Explicit void for Fire-and-Forget
void fetchAnalytics(); // Explicitly ignored
```

### 4.2 Async Functions return Promise

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/promise-function-async
function fetchData(): Promise<Data> {
  // Not marked async
  return fetch('/api/data').then((r) => r.json());
}

// ✅ CORRECT - Async/Await
async function fetchData(): Promise<Data> {
  const response = await fetch('/api/data');
  return response.json();
}
```

### 4.3 No async in void Callbacks

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/no-misused-promises
uploadMiddleware(req, res, async (err) => {
  // async in void callback
  await processFile();
});

// ✅ CORRECT - Sync callback with Promise
uploadMiddleware(req, res, (err) => {
  void (async () => {
    await processFile();
  })();
});
```

---

## 🌐 5. API Standards (Workshop Decisions)

### 5.1 REST URL Patterns

```typescript
// ✅ CORRECT - RESTful URLs
const API_ENDPOINTS = {
  // Collection Endpoints (Plural)
  USERS: '/api/v2/users',
  TEAMS: '/api/v2/teams',
  DOCUMENTS: '/api/v2/documents',

  // Resource Endpoints
  USER: '/api/v2/users/:id',
  TEAM: '/api/v2/teams/:id',
  DOCUMENT: '/api/v2/documents/:id',

  // Nested Resources (only when meaningful)
  TEAM_MEMBERS: '/api/v2/teams/:id/members',
  USER_DOCUMENTS: '/api/v2/users/:id/documents',
} as const;

// ❌ WRONG - Not RESTful
('/api/v2/getUsers'); // No verb in URL
('/api/v2/user'); // Singular for Collection
('/api/v2/User'); // Uppercase
('/api/v2/fetch-user-data'); // Kebab-case with verb
```

### 5.2 API Response Types

```typescript
// ✅ CORRECT - Standardized Response Types
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
    code: string; // "VALIDATION_ERROR", "NOT_FOUND", etc.
    message: string; // User-friendly message
    details?: Array<{
      field: string;
      message: string;
    }>;
  };
  meta?: {
    timestamp: string;
    requestId: string;
  };
}

// Usage
export async function getUsers(): Promise<User[]> {
  const response = await fetch('/api/v2/users');
  const data = (await response.json()) as ApiSuccessResponse<User[]>;

  if (!response.ok) {
    const error = data as unknown as ApiErrorResponse;
    throw new Error(error.error.message);
  }

  return data.data;
}
```

### 5.3 Field Naming - ALWAYS camelCase

```typescript
// ✅ CORRECT - camelCase for all API Fields
interface User {
  id: number;
  firstName: string; // NOT first_name
  lastName: string; // NOT last_name
  createdAt: string; // NOT created_at
  updatedAt: string; // NOT updated_at
  isActive: boolean; // NOT is_active
  hasPermission: boolean; // NOT has_permission
  userId: number; // NOT user_id
  tenantId: number; // NOT tenant_id
}

// ❌ WRONG - snake_case NEVER in API
interface WrongUser {
  user_id: number; // ❌ snake_case
  first_name: string; // ❌ snake_case
  created_at: string; // ❌ snake_case
  is_active: boolean; // ❌ snake_case
}
```

---

## 🛠️ 6. Template Strings and String Handling

### 6.1 Prefer Template Literals

```typescript
// ❌ WRONG - ESLint Error: prefer-template
const message = 'Hello ' + name + '!';
const url = baseUrl + '/' + endpoint;

// ✅ CORRECT - Template Literals
const message = `Hello ${name}!`;
const url = `${baseUrl}/${endpoint}`;
```

### 6.2 Restrict Template Expressions

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/restrict-template-expressions
const debug = `User: ${user}`;  // Object to string
const flag = `Active: ${isActive}`;  // Boolean to string

// ✅ CORRECT - Explicit conversion
const debug = `User: ${JSON.stringify(user)}`;
const flag = `Active: ${isActive ? 'Yes' : 'No'}`;

// ✅ CORRECT - Numbers are allowed
const price = `Price: ${amount}€`;
```

---

## 🎨 7. Console and Error Handling

### 7.1 Console Logs Restricted

```typescript
// ❌ WRONG - ESLint Error: no-console
console.log('Debug info'); // Not allowed

// ✅ CORRECT - Allowed Console Methods
console.warn('Warning: Deprecated API');
console.error('Error:', error);
console.info('Server started on port 3000');
console.debug('Debug mode:', config); // Backend only
```

### 7.2 Error Handling

```typescript
// ❌ WRONG - ESLint Error: prefer-promise-reject-errors
return Promise.reject('Error occurred'); // String rejection

// ✅ CORRECT - Error Objects
return Promise.reject(new Error('Error occurred'));

// ✅ CORRECT - Custom Error Classes
class ValidationError extends Error {
  constructor(
    public field: string,
    message: string,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

throw new ValidationError('email', 'Invalid email format');
```

### 7.3 Catch Callbacks ALWAYS with `: unknown`

```typescript
// ❌ WRONG - ESLint Error: @typescript-eslint/use-unknown-in-catch-callback-variable
promise.catch((error) => {
  // error is implicitly any
  console.error(error.message); // Unsafe!
});

// ✅ CORRECT - Explicitly unknown
promise.catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error('Unknown error:', error);
  }
});

// ✅ CORRECT - With Type Guard
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

promise.catch((error: unknown) => {
  const message = isError(error) ? error.message : String(error);
  console.error('Error:', message);
});
```

---

## 🌐 7.4 DOM and Browser API Patterns

### localStorage/sessionStorage Handling

```typescript
// ❌ WRONG - Truthy check for nullable string
const token = localStorage.getItem('token');
if (token) {  // ESLint Error: strict-boolean-expressions
  api.setAuth(token);
}

// ✅ CORRECT - Explicit null and empty checks
const token = localStorage.getItem('token');
if (token !== null && token !== '') {
  api.setAuth(token);
}

// 🚀 EVEN BETTER - Helper Function
function getStorageValue(key: string): string | null {
  const value = localStorage.getItem(key);
  return (value !== null && value !== '') ? value : null;
}

const token = getStorageValue('token');
if (token !== null) {
  api.setAuth(token);
}
```

### HTMLElement Type Guards and textContent

```typescript
// ❌ WRONG - Unsafe type assertion
const button = document.querySelector('btn') as HTMLButtonElement;
button.textContent = 'Click';  // Crash if null!

// ✅ CORRECT - With null check
const button = document.querySelector('btn') as HTMLButtonElement | null;
if (button !== null) {
  button.textContent = 'Click';  // textContent is string here
}

// 🚀 EVEN BETTER - instanceof check
const element = document.querySelector('btn');
if (element instanceof HTMLButtonElement) {
  // After instanceof, textContent is ALWAYS string, never null
  element.textContent = 'Click';  // No ?? or || needed!
}

// IMPORTANT: textContent behavior
const element = document.querySelector('.class');
if (element !== null) {
  // textContent can be null if element has no text
  const text = element.textContent;  // string | null
  if (text !== null && text !== '') {
    console.info(text);
  }
}

// BUT: After instanceof HTMLElement
if (element instanceof HTMLElement) {
  // textContent is GUARANTEED string (empty string if no text)
  const text = element.textContent;  // string, never null!
  if (text !== '') {
    console.info(text);
  }
}
```

### Dataset Values Validation

```typescript
// ❌ WRONG - Unsafe assumption about dataset
const role = (element as HTMLElement).dataset.role as 'admin' | 'user';
if (role) {
  // Dangerous!
  setUserRole(role);
}

// ✅ CORRECT - Dataset validation
const element = event.target;
if (element instanceof HTMLElement) {
  const roleValue = element.dataset.role;
  // Dataset values are always string | undefined
  if (roleValue === 'admin' || roleValue === 'user') {
    setUserRole(roleValue); // Now type-safe!
  }
}

// 🚀 EVEN BETTER - Type Guard Function
type UserRole = 'admin' | 'user' | 'guest';

function isValidRole(value: unknown): value is UserRole {
  return value === 'admin' || value === 'user' || value === 'guest';
}

if (element instanceof HTMLElement) {
  const roleValue = element.dataset.role;
  if (isValidRole(roleValue)) {
    setUserRole(roleValue); // Type-safe!
  }
}
```

---

## 🏗️ 8. Import/Export Standards

### 8.1 No Duplicate Imports

```typescript
// ❌ WRONG - ESLint Error: no-duplicate-imports
import { useState } from 'react';
import { useEffect } from 'react';

// ✅ CORRECT - Combined Import
import { useState, useEffect } from 'react';
```

### 8.2 Object Shorthand

```typescript
// ❌ WRONG - ESLint Error: object-shorthand
const user = {
  name: name,
  email: email,
  save: function() { }
};

// ✅ CORRECT - Shorthand
const user = {
  name,
  email,
  save() { }
};
```

### 8.3 Operator Precedence

```typescript
// ❌ WRONG - ESLint Error: no-mixed-operators
const time = now.getTime() - 24 * 60 * 60 * 1000;
const result = a + b * c - d;

// ✅ CORRECT - With parentheses for clarity
const time = now.getTime() - (24 * 60 * 60 * 1000);
const result = a + (b * c) - d;

// ✅ CORRECT - Grouped for readability
const dayInMs = 24 * 60 * 60 * 1000;
const time = now.getTime() - dayInMs;
```

---

## ✅ 9. Pre-Commit Checklist

Before EVERY commit, MUST run:

```bash
# 1. Format Check
pnpm run format

# 2. Lint Check (MUST show 0 Errors)
pnpm run lint

# 3. TypeScript Check (MUST show 0 Errors)
pnpm run type-check

# 4. Build Test
pnpm run build
```

Automated with Git Hooks:

```json
// package.json
{
  "scripts": {
    "pre-commit": "pnpm run format && pnpm run lint && pnpm run type-check"
  }
}
```

---

## 🚨 10. Test File Exceptions

ONLY in test files (`*.test.ts`, `*.spec.ts`) are allowed:

```typescript
// Test files only - Exceptions enabled
describe('UserService', () => {
  it('should handle any data', () => {
    const mockData: any = { test: true }; // any allowed in tests
    console.log('Test output'); // console.log allowed in tests

    expect(mockData).toBeDefined();
  });
});
```

---

## 📊 11. ESLint Command Reference

```bash
# Show all errors
pnpm run lint

# Auto-fix what's possible
pnpm run lint:fix

# TypeScript check only
pnpm run type-check

# Format with Prettier
pnpm run format

# Check format without fixing
pnpm run format:check
```

---

## 🔌 ESLint Plugins (Active)

Our ESLint configuration uses these plugins for maximum code quality:

| Plugin                         | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `@typescript-eslint`           | Core TypeScript rules                        |
| `eslint-plugin-promise`        | Promise best practices, no floating promises |
| `eslint-plugin-sonarjs`        | Code smell detection, cognitive complexity   |
| `eslint-plugin-unicorn`        | Modern JavaScript patterns                   |
| `eslint-plugin-no-secrets`     | Prevents hardcoded secrets/API keys          |
| `eslint-plugin-no-unsanitized` | XSS prevention (innerHTML, etc.)             |
| `eslint-plugin-tsdoc`          | TSDoc comment validation                     |
| `eslint-plugin-storybook`      | Storybook-specific rules                     |

---

## 🗄️ Database Layer Exceptions

Files in `backend/src/database/**/*.ts` have relaxed limits due to complex query builders:

| Rule                     | Standard | Database Layer |
| ------------------------ | -------- | -------------- |
| `max-lines`              | 800      | 1000           |
| `max-lines-per-function` | 60       | 80             |

**Rationale:** Database utilities often contain multiple related queries and helper functions that are logically grouped together.

---

## 🔴 12. Absolute No-Gos

These result in **immediate rejection** in code review:

1. **`any` type without `// eslint-disable-next-line` with justification**
2. **`||` instead of `??` for defaults**
3. **Missing return types on exported functions**
4. **Non-null assertions (`!`)**
5. **Unawaited promises**
6. **snake_case in API fields**
7. **`var` keyword**
8. **`console.log` in production code**
9. **String/Number in boolean conditions without explicit checks**
10. **Commits with ESLint errors**
11. **Catch callbacks without `: unknown` type**
12. **localStorage/sessionStorage with truthy checks instead of `!== null`**
13. **Type assertions (`as`) without `| null` for DOM elements**
14. **Dataset values without validation**

---

## 📋 13. New File Checklist

When creating new TypeScript files:

- [ ] File starts with correct import block (sorted by Prettier)
- [ ] All functions have explicit return types
- [ ] No `any` types
- [ ] Interfaces/Types are exported and documented
- [ ] camelCase for all variables and properties
- [ ] PascalCase for Types/Interfaces/Classes
- [ ] Prettier runs without changes
- [ ] ESLint shows 0 errors
- [ ] TypeScript compiles without errors

---

## 🎯 14. Legacy Code Migration

When migrating old code:

```typescript
// Phase 1: Mark with TODO
// TODO: Migrate to TypeScript standards
// @ts-expect-error - Legacy code, will be migrated
const oldData: any = getLegacyData();

// Phase 2: Gradual migration
interface LegacyData {
  [key: string]: unknown; // Better than any
}

// Phase 3: Full typing
interface UserData {
  id: number;
  name: string;
  email: string;
}
```

---

## 📚 Quick Reference

| Category  | Use                           | Don't Use            |
| --------- | ----------------------------- | -------------------- |
| Types     | `unknown`, specific types     | `any`                |
| Defaults  | `??` (nullish coalescing)     | `\|\|` (logical or)  |
| Strings   | Template Literals             | String Concatenation |
| Functions | Arrow Functions               | `function` keyword   |
| Variables | `const`, `let`                | `var`                |
| Async     | `async/await`                 | `.then()` chains     |
| Loops     | `for...of`, `.map()`          | `for...in`           |
| Checks    | Explicit boolean (`!== null`) | Truthy/Falsy         |
| Exports   | Named Exports                 | Default Exports      |
| Quotes    | Single quotes (`'`)           | Double quotes (`"`)  |

---

**This standard is MANDATORY. Code that does not meet these standards will NOT be merged.**

**Last Updated:** 2025-12-16
**Based on:** eslint.config.js + tsconfig.base.json + Power of Ten Rules + .prettierrc.json
**Database:** PostgreSQL 17 with `pg` library (NOT MySQL!)
**Validation:** Zod schemas (NOT express-validator!)
**Maintainer:** Assixx Development Team

## TypeScript Architecture Guide

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
import { typed } from '../utils/routeHandlers';

// For authenticated routes
router.get(
  '/profile',
  ...security.user(),
  typed.auth(async (req, res) => {
    // req is AuthenticatedRequest
    // req.user is fully typed
  }),
);

// For routes with params
router.get(
  '/user/:id',
  ...security.admin(),
  typed.params<{ id: string }>(async (req, res) => {
    const userId = req.params.id; // typed as string
  }),
);

// For routes with body
router.post(
  '/create',
  ...security.admin(validateCreateUser),
  typed.body<CreateUserBody>(async (req, res) => {
    const { email, password } = req.body; // fully typed
  }),
);
```

### 3. Security Middleware (`/src/middleware/security.ts`)

Pre-configured security stacks for different endpoint types:

```typescript
// Public endpoints (no auth, rate limited)
router.get('/public', ...security.public(), handler);

// Authenticated user endpoints
router.get('/profile', ...security.user(), handler);

// Admin-only endpoints
router.get('/admin/users', ...security.admin(), handler);

// With validation
router.post('/user', ...security.admin(validateCreateUser), handler);
```

## Implementation Guidelines

### Creating New Routes

1. Import required components:

```typescript
import { Router } from 'express';

import { security } from '../middleware/security';
import { errorResponse, successResponse } from '../types/response.types';
import { typed } from '../utils/routeHandlers';
```

1. Define request interfaces if needed:

```typescript
interface CreateUserBody {
  email: string;
  password: string;
  role: string;
}
```

2.Implement route with proper typing:

```typescript
router.post(
  '/users',
  ...security.admin(validateCreateUser),
  typed.body<CreateUserBody>(async (req, res) => {
    try {
      const { email, password, role } = req.body;
      const tenantId = req.user.tenantId;

      // Implementation

      res.json(successResponse(result));
    } catch (error) {
      res.status(500).json(errorResponse('Server error', 500));
    }
  }),
);
```

### Database Queries (PostgreSQL 17)

**IMPORTANT**: Use the centralized database utilities from `/src/utils/db.ts` with **PostgreSQL `$1, $2, $3` placeholders**:

```typescript
import { ResultSetHeader, RowDataPacket, execute, query, transaction } from '../utils/db';

// SELECT queries - use $1, $2, $3 placeholders (NOT ?)
const [rows] = await execute<RowDataPacket[]>('SELECT * FROM users WHERE id = $1 AND tenant_id = $2', [
  userId,
  tenantId,
]);

// INSERT with RETURNING (PostgreSQL best practice)
const [result] = await execute<RowDataPacket[]>(
  'INSERT INTO users (email, password, tenant_id) VALUES ($1, $2, $3) RETURNING id',
  [email, hashedPassword, tenantId],
);
const insertId = result[0]?.id;

// UPDATE/DELETE queries
const [updateResult] = await execute<ResultSetHeader>('UPDATE users SET name = $1 WHERE id = $2 AND tenant_id = $3', [
  newName,
  userId,
  tenantId,
]);

// Transactions with RLS context
await transaction(
  async (connection) => {
    await connection.execute('INSERT INTO users (email, tenant_id) VALUES ($1, $2) RETURNING id', [email, tenantId]);
    await connection.execute('INSERT INTO profiles (user_id, tenant_id) VALUES ($1, $2)', [userId, tenantId]);
  },
  { tenantId, userId },
); // RLS context for Row Level Security
```

**PostgreSQL vs MySQL Syntax:**
| MySQL | PostgreSQL |
|-------|------------|
| `?` placeholder | `$1, $2, $3` |
| `LAST_INSERT_ID()` | `RETURNING id` |
| `LIMIT ?, ?` | `LIMIT $1 OFFSET $2` |

**Never import pool directly from database.ts or config/database.ts**.

### Error Handling

Use the standardized error handler:

```typescript
import { getErrorMessage } from '../utils/errorHandler';

try {
  // Your code
} catch (error) {
  console.error('Operation failed:', error);
  const message = getErrorMessage(error);
  res.status(500).json(errorResponse(message, 500));
}
```

## Migration from Old Patterns

### Old Pattern

```typescript
router.post('/endpoint', authenticateToken as any, authorizeRole('admin') as any, async (req: any, res: any) => {
  // Untyped implementation
});
```

### New Pattern

```typescript
router.post(
  '/endpoint',
  ...security.admin(validationRules),
  typed.body<RequestBody>(async (req, res) => {
    // Fully typed implementation
  }),
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
4. Validate all user input using **Zod schemas** (see [ZOD-INTEGRATION-GUIDE.md](../backend/docs/ZOD-INTEGRATION-GUIDE.md))
5. Use parameterized queries with PostgreSQL `$1, $2` placeholders to prevent SQL injection

## References

- [Power of Ten Rules](./POWER-OF-TEN-RULES.md) - **REQUIRED READING** - 10 Rules for Safety-Critical Code (NASA/JPL)
- [TypeScript Security Best Practices](../../docs/TYPESCRIPT-SECURITY-BEST-PRACTICES.md)
- [User Update Security Fix](./USER_UPDATE_SECURITY_FIX_SUMMARY.md)
- [Phase 2 Migration Guide](../../docs/PHASE2-MIGRATION-GUIDE.md)
- [Database Migration Guide](../../docs/DATABASE-MIGRATION-GUIDE.md)
- [TypeScript Database Utilities](./TYPESCRIPT-DB-UTILITIES.md) - **MUST READ for database operations**

## Common Patterns

### Multi-tenant Query Pattern (PostgreSQL)

```typescript
import { RowDataPacket, execute } from '../utils/db';

// PostgreSQL uses $1, $2, $3 placeholders (NOT ?)
const [users] = await execute<RowDataPacket[]>('SELECT * FROM users WHERE tenant_id = $1 AND role = $2', [
  req.user.tenantId,
  'employee',
]);
```

### File Upload Pattern

```typescript
router.post(
  '/upload',
  ...security.user(),
  upload.single('file'),
  typed.auth(async (req, res) => {
    if (!req.file) {
      return res.status(400).json(errorResponse('No file uploaded', 400));
    }
    // Process file
  }),
);
```

### Pagination Pattern

```typescript
interface PaginationQuery {
  page?: string;
  limit?: string;
}

router.get(
  '/items',
  ...security.user(),
  typed.query<PaginationQuery>(async (req, res) => {
    const page = parseInt(req.query.page || '1');
    const limit = parseInt(req.query.limit || '10');
    // Implementation
  }),
);
```

## Testing

When testing typed routes, use proper type assertions:

```typescript
import request from 'supertest';

import app from '../app';

describe('User Routes', () => {
  it('should create user with proper types', async () => {
    const response = await request(app).post('/api/users').set('Authorization', `Bearer ${token}`).send({
      email: 'test@example.com',
      password: 'SecurePass123',
      role: 'employee',
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
