# 📋 Assixx TypeScript Code Standards - Der definitive Style Guide

> **Version:** 2.0.0
> **Aktualisiert:** 28.01.2025
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

if (items.length) {  // Number in condition
  processItems(items);
}

// ✅ RICHTIG - Explizite Boolean Checks
if (user.name !== undefined && user.name !== null && user.name !== "") {
  console.log(user.name);
}

// ✅ RICHTIG - Oder mit Helper
if (user.name?.length > 0) {
  console.log(user.name);
}

if (items.length > 0) {
  processItems(items);
}
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

**Letzte Aktualisierung:** 28.01.2025
**Basiert auf:** eslint.config.js (Backend & Frontend) + .prettierrc.json
**Maintainer:** Assixx Development Team
