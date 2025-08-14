# 📋 Assixx TypeScript Code Standards - Der definitive Style Guide

> **Version:** 2.1.0
> **Aktualisiert:** 14.08.2025
> **Basiert auf:** ESLint & Prettier Configs
> **Philosophie:** MAXIMUM STRICTNESS - Zero-Tolerance für schlechten Code

## 🎯 Executive Summary

Dieses Dokument ist unser **Code of Conduct** - die einzige Wahrheit für TypeScript-Code im Assixx-Projekt. Es basiert direkt auf unseren ESLint und Prettier Konfigurationen und stellt sicher, dass **KEINE** ESLint-Fehler oder Warnungen entstehen.

**Goldene Regel:** Code, der gegen diese Standards verstößt, wird NICHT gemerged.

---

## 📁 1. Prettier Code Formatting

Alle Code-Formatierung wird durch Prettier automatisch gehandhabt. **KEINE** Diskussionen über Formatierung.

```json
{
  "semi": true,                    // IMMER Semikolons
  "trailingComma": "all",          // IMMER trailing commas
  "singleQuote": false,             // IMMER double quotes
  "printWidth": 80,                 // Max 80 Zeichen pro Zeile
  "tabWidth": 2,                    // 2 Spaces Einrückung
  "useTabs": false,                 // KEINE Tabs
  "arrowParens": "always",          // IMMER Klammern bei Arrow Functions
  "endOfLine": "lf",                // Unix Line Endings
  "bracketSpacing": true            // Spaces in Objekten { foo: bar }
}
```

### Beispiele:

```typescript
// ✅ RICHTIG - Prettier formatiert
const user = {
  id: 1,
  name: "Admin",
  roles: ["admin", "root"],
};

const calculate = (x: number): number => x * 2;

// ❌ FALSCH - Wird automatisch korrigiert
const user={id:1,name:'Admin',roles:['admin','root']}
const calculate = x => x * 2
```

---

## 🚫 2. TypeScript Type Safety - KEINE Kompromisse

### 2.1 NIEMALS `any` verwenden

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/no-explicit-any
function processData(data: any): void {
  console.log(data.value);
}

// ✅ RICHTIG - unknown mit Type Guards
function processData(data: unknown): void {
  if (
    typeof data === "object" &&
    data !== null &&
    "value" in data
  ) {
    console.log((data as { value: unknown }).value);
  }
}

// ✅ RICHTIG - Spezifischer Type
interface DataPayload {
  value: string;
  timestamp: number;
}

function processData(data: DataPayload): void {
  console.log(data.value);
}
```

### 2.2 Explizite Return Types PFLICHT

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/explicit-module-boundary-types
export function calculate(a: number, b: number) {
  return a + b;
}

// ✅ RICHTIG - Expliziter Return Type
export function calculate(a: number, b: number): number {
  return a + b;
}

// ✅ RICHTIG - Async mit Promise
export async function fetchUser(id: number): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json() as Promise<User>;
}
```

### 2.3 Nullish Coalescing (`??`) statt Logical OR (`||`)

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/prefer-nullish-coalescing
const port = process.env.PORT || 3000;  // Problem: "0" wird zu 3000
const name = user.name || "Anonymous";  // Problem: "" wird zu "Anonymous"

// ✅ RICHTIG - Nullish Coalescing
const port = process.env.PORT ?? 3000;  // Nur null/undefined → 3000
const name = user.name ?? "Anonymous";  // Nur null/undefined → "Anonymous"

// ✅ RICHTIG - Explizite Prüfung wenn || gewollt
const displayName = user.name || user.email || "Anonymous";  // Mit Kommentar warum
```

### 2.4 Keine Non-Null Assertions (`!`)

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/no-non-null-assertion
const userId = req.user!.id;  // Gefährlich!

// ✅ RICHTIG - Explizite Prüfung
if (!req.user) {
  res.status(401).json({ error: "Unauthorized" });
  return;
}
const userId = req.user.id;  // Jetzt type-safe
```

### 2.5 Strict Boolean Expressions

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/strict-boolean-expressions
if (user.name) {  // String in condition
  console.log(user.name);
}

if (!token) {  // Truthy check nicht erlaubt
  return;
}

if (items.length) {  // Number in condition
  processItems(items);
}

// ✅ RICHTIG - Explizite Boolean Checks
if (user.name !== undefined && user.name !== null && user.name !== "") {
  console.log(user.name);
}

// ✅ RICHTIG - Null/Empty String checks
const token = getAuthToken();
if (token === null || token === '') {
  return;
}

// ✅ RICHTIG - Number comparisons
if (items.length > 0) {
  processItems(items);
}

// ✅ RICHTIG - Boolean values
if (isEnabled === true) {
  enableFeature();
}
```

### 2.6 Nullish Coalescing vs Logical OR

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/prefer-nullish-coalescing
const name = user.name || "Anonymous";  // || für nullable values
const count = data.count || 0;  // Problematisch wenn count === 0

// ✅ RICHTIG - Nullish coalescing für null/undefined
const name = user.name ?? "Anonymous";
const count = data.count ?? 0;

// ✅ RICHTIG - || nur für echte boolean logic
const isActive = isEnabled || isForced;  // Beide sind boolean
```

### 2.7 Safe Type Casting

```typescript
// ❌ FALSCH - Unsafe casting
const btn = document.getElementById('btn') as HTMLButtonElement;
btn.click();  // Crash wenn null!

// ✅ RICHTIG - Mit null check
const btn = document.getElementById('btn') as HTMLButtonElement | null;
if (btn !== null) {
  btn.click();
}

// ✅ RICHTIG - Type assertion für JSON
const data = (await response.json()) as { message?: string };
const message = data.message ?? 'Kein Text';
```

### 2.8 Alert/Confirm vermeiden

```typescript
// ❌ FALSCH - ESLint Error: no-alert
alert('Fehler aufgetreten!');
const confirmed = confirm('Wirklich löschen?');

// ✅ RICHTIG - Custom UI functions
import { showError, showSuccess } from './auth';
showError('Fehler aufgetreten!');
showSuccess('Erfolgreich gespeichert');

// ✅ RICHTIG - Modal dialogs
const confirmed = await showConfirmDialog('Wirklich löschen?');
```

---

## 📝 3. Variablen und Funktionen

### 3.1 Ungenutzte Variablen mit `_` Prefix

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/no-unused-vars
app.use((req, res, next, error) => {  // error nicht genutzt
  console.log("Middleware");
  next();
});

// ✅ RICHTIG - Underscore für bewusst ungenutzt
app.use((req, res, next, _error) => {
  console.log("Middleware");
  next();
});

// ✅ RICHTIG - Destructuring mit Rest
const { id, name, ...rest } = user;  // rest ignoriert ungenutzte Felder
```

### 3.2 Const über Let, niemals Var

```typescript
// ❌ FALSCH - ESLint Error: prefer-const, no-var
var oldStyle = "bad";
let unchanged = 42;  // Wird nie geändert

// ✅ RICHTIG
const immutable = 42;
let mutable = 0;
mutable += 1;
```

### 3.3 Arrow Functions bevorzugen

```typescript
// ❌ FALSCH - ESLint Warning: prefer-arrow-callback
array.map(function(item) {
  return item * 2;
});

// ✅ RICHTIG - Arrow Function
array.map((item) => item * 2);

// ✅ RICHTIG - Arrow mit Block wenn komplex
array.map((item) => {
  const doubled = item * 2;
  console.log(`Processing: ${doubled}`);
  return doubled;
});
```

---

## 🔄 4. Async/Await Best Practices

### 4.1 Promises IMMER awaiten

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/no-floating-promises
fetchUser(123);  // Promise wird ignoriert!

async function process(): void {
  doAsyncWork();  // Nicht geawaited!
}

// ✅ RICHTIG - Await oder handle
await fetchUser(123);

async function process(): Promise<void> {
  await doAsyncWork();
}

// ✅ RICHTIG - Explicit void wenn Fire-and-Forget
void fetchAnalytics();  // Explizit ignoriert
```

### 4.2 Async Functions returnen Promise

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/promise-function-async
function fetchData(): Promise<Data> {  // Nicht async markiert
  return fetch("/api/data").then(r => r.json());
}

// ✅ RICHTIG - Async/Await
async function fetchData(): Promise<Data> {
  const response = await fetch("/api/data");
  return response.json();
}
```

### 4.3 Keine async in void Callbacks

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/no-misused-promises
uploadMiddleware(req, res, async (err) => {  // async in void callback
  await processFile();
});

// ✅ RICHTIG - Sync callback mit Promise
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
// ✅ RICHTIG - RESTful URLs
const API_ENDPOINTS = {
  // Collection Endpoints (Plural)
  USERS: "/api/v2/users",
  TEAMS: "/api/v2/teams",
  DOCUMENTS: "/api/v2/documents",

  // Resource Endpoints
  USER: "/api/v2/users/:id",
  TEAM: "/api/v2/teams/:id",
  DOCUMENT: "/api/v2/documents/:id",

  // Nested Resources (nur wenn sinnvoll)
  TEAM_MEMBERS: "/api/v2/teams/:id/members",
  USER_DOCUMENTS: "/api/v2/users/:id/documents",
} as const;

// ❌ FALSCH - Nicht RESTful
"/api/v2/getUsers"         // Kein Verb in URL
"/api/v2/user"            // Singular für Collection
"/api/v2/User"            // Großschreibung
"/api/v2/fetch-user-data" // Kebab-case mit Verb
```

### 5.2 API Response Types

```typescript
// ✅ RICHTIG - Standardisierte Response Types
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
    code: string;        // "VALIDATION_ERROR", "NOT_FOUND", etc.
    message: string;     // User-friendly message
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
  const response = await fetch("/api/v2/users");
  const data = await response.json() as ApiSuccessResponse<User[]>;

  if (!response.ok) {
    const error = data as unknown as ApiErrorResponse;
    throw new Error(error.error.message);
  }

  return data.data;
}
```

### 5.3 Field Naming - IMMER camelCase

```typescript
// ✅ RICHTIG - camelCase für alle API Fields
interface User {
  id: number;
  firstName: string;        // NICHT first_name
  lastName: string;         // NICHT last_name
  createdAt: string;        // NICHT created_at
  updatedAt: string;        // NICHT updated_at
  isActive: boolean;        // NICHT is_active
  hasPermission: boolean;   // NICHT has_permission
  userId: number;           // NICHT user_id
  tenantId: number;         // NICHT tenant_id
}

// ❌ FALSCH - snake_case NIEMALS in API
interface WrongUser {
  user_id: number;         // ❌ snake_case
  first_name: string;      // ❌ snake_case
  created_at: string;      // ❌ snake_case
  is_active: boolean;      // ❌ snake_case
}
```

---

## 🛠️ 6. Template Strings und String Handling

### 6.1 Template Literals bevorzugen

```typescript
// ❌ FALSCH - ESLint Error: prefer-template
const message = "Hello " + name + "!";
const url = baseUrl + "/" + endpoint;

// ✅ RICHTIG - Template Literals
const message = `Hello ${name}!`;
const url = `${baseUrl}/${endpoint}`;
```

### 6.2 Restrict Template Expressions

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/restrict-template-expressions
const debug = `User: ${user}`;  // Object to string
const flag = `Active: ${isActive}`;  // Boolean to string

// ✅ RICHTIG - Explizite Konvertierung
const debug = `User: ${JSON.stringify(user)}`;
const flag = `Active: ${isActive ? "Yes" : "No"}`;

// ✅ RICHTIG - Numbers sind erlaubt
const price = `Price: ${amount}€`;
```

---

## 🎨 7. Console und Error Handling

### 7.1 Console Logs eingeschränkt

```typescript
// ❌ FALSCH - ESLint Error: no-console
console.log("Debug info");  // Nicht erlaubt

// ✅ RICHTIG - Erlaubte Console Methods
console.warn("Warning: Deprecated API");
console.error("Error:", error);
console.info("Server started on port 3000");
console.debug("Debug mode:", config);  // Backend only
```

### 7.2 Error Handling

```typescript
// ❌ FALSCH - ESLint Error: prefer-promise-reject-errors
return Promise.reject("Error occurred");  // String rejection

// ✅ RICHTIG - Error Objects
return Promise.reject(new Error("Error occurred"));

// ✅ RICHTIG - Custom Error Classes
class ValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

throw new ValidationError("email", "Invalid email format");
```

### 7.3 Catch Callbacks IMMER mit `: unknown`

```typescript
// ❌ FALSCH - ESLint Error: @typescript-eslint/use-unknown-in-catch-callback-variable
promise.catch((error) => {  // error ist implizit any
  console.error(error.message);  // Unsicher!
});

// ✅ RICHTIG - Explizit unknown
promise.catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("Unknown error:", error);
  }
});

// ✅ RICHTIG - Mit Type Guard
function isError(error: unknown): error is Error {
  return error instanceof Error;
}

promise.catch((error: unknown) => {
  const message = isError(error) ? error.message : String(error);
  console.error("Error:", message);
});
```

---

## 🌐 7.4 DOM und Browser API Patterns

### localStorage/sessionStorage Handling

```typescript
// ❌ FALSCH - Truthy check für nullable string
const token = localStorage.getItem("token");
if (token) {  // ESLint Error: strict-boolean-expressions
  api.setAuth(token);
}

// ✅ RICHTIG - Explizite null und empty checks
const token = localStorage.getItem("token");
if (token !== null && token !== "") {
  api.setAuth(token);
}

// 🚀 NOCH BESSER - Helper Function
function getStorageValue(key: string): string | null {
  const value = localStorage.getItem(key);
  return (value !== null && value !== "") ? value : null;
}

const token = getStorageValue("token");
if (token !== null) {
  api.setAuth(token);
}
```

### HTMLElement Type Guards und textContent

```typescript
// ❌ FALSCH - Unsafe type assertion
const button = document.getElementById("btn") as HTMLButtonElement;
button.textContent = "Click";  // Crash wenn null!

// ✅ RICHTIG - Mit null check
const button = document.getElementById("btn") as HTMLButtonElement | null;
if (button !== null) {
  button.textContent = "Click";  // textContent ist hier string
}

// 🚀 NOCH BESSER - instanceof check
const element = document.getElementById("btn");
if (element instanceof HTMLButtonElement) {
  // Nach instanceof ist textContent IMMER string, nie null
  element.textContent = "Click";  // Kein ?? oder || nötig!
}

// WICHTIG: textContent Verhalten
const element = document.querySelector(".class");
if (element !== null) {
  // textContent kann null sein wenn element kein Text hat
  const text = element.textContent;  // string | null
  if (text !== null && text !== "") {
    console.info(text);
  }
}

// ABER: Nach instanceof HTMLElement
if (element instanceof HTMLElement) {
  // textContent ist GARANTIERT string (empty string wenn kein Text)
  const text = element.textContent;  // string, nie null!
  if (text !== "") {
    console.info(text);
  }
}
```

### Dataset Values Validation

```typescript
// ❌ FALSCH - Unsichere Annahme über dataset
const role = (element as HTMLElement).dataset.role as "admin" | "user";
if (role) {  // Gefährlich!
  setUserRole(role);
}

// ✅ RICHTIG - Dataset validation
const element = event.target;
if (element instanceof HTMLElement) {
  const roleValue = element.dataset.role;
  // Dataset values sind immer string | undefined
  if (roleValue === "admin" || roleValue === "user") {
    setUserRole(roleValue);  // Jetzt type-safe!
  }
}

// 🚀 NOCH BESSER - Type Guard Function
type UserRole = "admin" | "user" | "guest";

function isValidRole(value: unknown): value is UserRole {
  return value === "admin" || value === "user" || value === "guest";
}

if (element instanceof HTMLElement) {
  const roleValue = element.dataset.role;
  if (isValidRole(roleValue)) {
    setUserRole(roleValue);  // Type-safe!
  }
}
```

---

## 🏗️ 8. Import/Export Standards

### 8.1 Keine doppelten Imports

```typescript
// ❌ FALSCH - ESLint Error: no-duplicate-imports
import { useState } from "react";
import { useEffect } from "react";

// ✅ RICHTIG - Combined Import
import { useState, useEffect } from "react";
```

### 8.2 Object Shorthand

```typescript
// ❌ FALSCH - ESLint Error: object-shorthand
const user = {
  name: name,
  email: email,
  save: function() { }
};

// ✅ RICHTIG - Shorthand
const user = {
  name,
  email,
  save() { }
};
```

### 8.3 Operator Precedence

```typescript
// ❌ FALSCH - ESLint Error: no-mixed-operators
const time = now.getTime() - 24 * 60 * 60 * 1000;
const result = a + b * c - d;

// ✅ RICHTIG - Mit Klammern für Klarheit
const time = now.getTime() - (24 * 60 * 60 * 1000);
const result = a + (b * c) - d;

// ✅ RICHTIG - Gruppiert für Lesbarkeit
const dayInMs = 24 * 60 * 60 * 1000;
const time = now.getTime() - dayInMs;
```

---

## ✅ 9. Pre-Commit Checklist

Vor JEDEM Commit MUSS durchlaufen:

```bash
# 1. Format Check
pnpm run format

# 2. Lint Check (MUSS 0 Errors zeigen)
pnpm run lint

# 3. TypeScript Check (MUSS 0 Errors zeigen)
pnpm run type-check

# 4. Build Test
pnpm run build
```

Automatisiert mit Git Hooks:

```json
// package.json
{
  "scripts": {
    "pre-commit": "pnpm run format && pnpm run lint && pnpm run type-check"
  }
}
```

---

## 🚨 10. Test File Ausnahmen

NUR in Test-Dateien (`*.test.ts`, `*.spec.ts`) sind erlaubt:

```typescript
// Test files only - Ausnahmen aktiviert
describe("UserService", () => {
  it("should handle any data", () => {
    const mockData: any = { test: true };  // any erlaubt in Tests
    console.log("Test output");  // console.log erlaubt in Tests

    expect(mockData).toBeDefined();
  });
});
```

---

## 📊 11. ESLint Command Reference

```bash
# Zeige alle Errors
pnpm run lint

# Auto-Fix was möglich
pnpm run lint:fix

# Nur TypeScript prüfen
pnpm run type-check

# Format mit Prettier
pnpm run format

# Check Format ohne Fix
pnpm run format:check
```

---

## 🔴 12. Absolute No-Gos

Diese führen zu **sofortiger Ablehnung** im Code Review:

1. **`any` Type ohne `// eslint-disable-next-line` mit Begründung**
2. **`||` statt `??` für Defaults**
3. **Fehlende Return Types bei exported Functions**
4. **Non-null Assertions (`!`)**
5. **Ungeawaitete Promises**
6. **snake_case in API Fields**
7. **`var` Keyword**
8. **`console.log` oder(info) in Production Code**
9. **String/Number in Boolean Conditions ohne explizite Checks**
10. **Commits mit ESLint Errors**
11. **Catch Callbacks ohne `: unknown` Type**
12. **localStorage/sessionStorage mit truthy checks statt `!== null`**
13. **Type Assertions (`as`) ohne `| null` bei DOM Elements**
14. **Dataset values ohne Validation**

---

## 📋 13. Neue Datei Checklist

Beim Erstellen neuer TypeScript-Dateien:

- [ ] Datei startet mit korrektem Import-Block
- [ ] Alle Functions haben explizite Return Types
- [ ] Keine `any` Types
- [ ] Interfaces/Types sind exportiert und dokumentiert
- [ ] camelCase für alle Variablen und Properties
- [ ] PascalCase für Types/Interfaces/Classes
- [ ] Prettier läuft ohne Änderungen
- [ ] ESLint zeigt 0 Errors
- [ ] TypeScript kompiliert ohne Fehler

---

## 🎯 14. Migration von Legacy Code

Bei der Migration von altem Code:

```typescript
// Phase 1: Mark mit TODO
// TODO: Migrate to TypeScript standards
// @ts-expect-error - Legacy code, will be migrated
const oldData: any = getLegacyData();

// Phase 2: Schrittweise Migration
interface LegacyData {
  [key: string]: unknown;  // Besser als any
}

// Phase 3: Vollständige Typisierung
interface UserData {
  id: number;
  name: string;
  email: string;
}
```

---

## 📚 Quick Reference

| Was | Verwenden | Nicht verwenden |
|-----|-----------|-----------------|
| Types | `unknown`, spezifische Types | `any` |
| Defaults | `??` (nullish) | `||` (logical) |
| Strings | Template Literals | String Concatenation |
| Functions | Arrow Functions | function keyword |
| Variables | `const`, `let` | `var` |
| Async | `async/await` | `.then()` chains |
| Loops | `for...of`, `.map()` | `for...in` |
| Checks | Explizite Boolean | Truthy/Falsy |
| Exports | Named Exports | Default Exports (meist) |

---

**Dieser Standard ist VERBINDLICH. Code, der diese Standards nicht erfüllt, wird NICHT gemerged.**

**Letzte Aktualisierung:** 14.08.2025
**Basiert auf:** eslint.config.js (Backend & Frontend) + .prettierrc.json
**Maintainer:** Assixx Development Team


# TypeScript Architecture Guide

An Claude: Korriegire und opitmiere diese Datei ständig, wenn du meinst, dass was geändert hat oder wir es besser machen können.

Achte auf eslint config im backend und frontend. Wir wollen besten typescript code der möglich ist nach best practice und nach ultimatische strengen typsicheren Regeln!!!!!!!!!! This is most important file of all with together with code of cunduct TYPESCRIPTS-STANDARDS.md!!!

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
  }),
);

// For routes with params
router.get(
  "/user/:id",
  ...security.admin(),
  typed.params<{ id: string }>(async (req, res) => {
    const userId = req.params.id; // typed as string
  }),
);

// For routes with body
router.post(
  "/create",
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
  }),
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
  "/items",
  ...security.user(),
  typed.query<PaginationQuery>(async (req, res) => {
    const page = parseInt(req.query.page || "1");
    const limit = parseInt(req.query.limit || "10");
    // Implementation
  }),
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
