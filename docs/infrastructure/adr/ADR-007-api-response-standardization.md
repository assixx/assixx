# ADR-007: API Response Standardization

| Metadata                | Value                                              |
| ----------------------- | -------------------------------------------------- |
| **Status**              | Accepted                                           |
| **Date**                | 2026-01-14                                         |
| **Decision Makers**     | SCS Technik                                        |
| **Affected Components** | ResponseInterceptor, AllExceptionsFilter, Frontend |

---

## Context

Eine konsistente API erfordert einheitliche Response-Formate:

1. **Frontend-DX** - Einheitliche Struktur für Error-Handling
2. **Debugging** - Timestamps, Request-IDs für Logs
3. **Pagination** - Meta-Daten für Listen
4. **Error-Tracking** - Strukturierte Fehler für Sentry

### Problem

Ohne Standardisierung:

```typescript
// Endpoint A
return { users: [...] }

// Endpoint B
return { data: [...], total: 100 }

// Endpoint C
return [...]

// Error A
throw new Error('Not found')

// Error B
return { error: 'Not found', code: 404 }
```

**Resultat:** Frontend muss jeden Endpoint anders behandeln.

---

## Decision

### Einheitliche Response-Struktur

#### Success Response

```typescript
{
  "success": true,
  "data": { ... },           // Actual payload
  "timestamp": "2026-01-14T10:30:00.000Z"
}
```

#### Paginated Response

```typescript
{
  "success": true,
  "data": [...],             // Array of items
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "totalPages": 10
    }
  },
  "timestamp": "2026-01-14T10:30:00.000Z"
}
```

#### Error Response

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [              // Optional field errors
      { "field": "email", "message": "Invalid email" }
    ]
  },
  "timestamp": "2026-01-14T10:30:00.000Z",
  "path": "/api/v2/users",
  "requestId": "abc-123"      // Optional
}
```

### Implementation

| Component               | Responsibility             |
| ----------------------- | -------------------------- |
| **ResponseInterceptor** | Wraps successful responses |
| **AllExceptionsFilter** | Formats all errors         |

### Response Flow

```
Controller returns { users: [...] }
         │
         ▼
┌────────────────────────────────────┐
│ ResponseInterceptor                │
│ → Wraps in { success: true, data } │
│ → Adds timestamp                   │
│ → Handles pagination metadata      │
└────────────────────────────────────┘
         │
         ▼
Response: { success: true, data: { users: [...] }, timestamp: "..." }
```

### Error Flow

```
Service throws new UnauthorizedException('Invalid token')
         │
         ▼
┌────────────────────────────────────┐
│ AllExceptionsFilter                │
│ → Catches exception                │
│ → Determines status code           │
│ → Formats error structure          │
│ → Logs (warn for 4xx, error for 5xx)│
│ → Reports 5xx to Sentry            │
└────────────────────────────────────┘
         │
         ▼
Response: { success: false, error: { code: "UNAUTHORIZED", message: "..." }, ... }
```

---

## Alternatives Considered

### 1. Kein Interceptor (Manual Wrapping)

```typescript
@Get()
async getUsers() {
  const users = await this.usersService.findAll();
  return {
    success: true,
    data: users,
    timestamp: new Date().toISOString(),
  };
}
```

| Pro         | Contra                    |
| ----------- | ------------------------- |
| Explizit    | Repetitiv (50+ Endpoints) |
| Keine Magic | Leicht zu vergessen       |
|             | Inkonsistenzen möglich    |

**Entscheidung:** Abgelehnt - Zu fehleranfällig.

### 2. NestJS ClassSerializerInterceptor

| Pro               | Contra                    |
| ----------------- | ------------------------- |
| NestJS Built-in   | Nur für class-transformer |
| Decorator-basiert | Keine Response-Wrapping   |
|                   | Kein Pagination-Support   |

**Entscheidung:** Abgelehnt - Nicht für Response-Wrapping gedacht.

### 3. JSON:API Specification

```json
{
  "data": [...],
  "meta": { "total": 100 },
  "links": { "self": "/users", "next": "/users?page=2" }
}
```

| Pro        | Contra                           |
| ---------- | -------------------------------- |
| Standard   | Komplex für einfache APIs        |
| Hypermedia | Frontend braucht JSON:API Client |
|            | Overhead für kleine Responses    |

**Entscheidung:** Abgelehnt - Overkill für interne API.

### 4. GraphQL

| Pro                    | Contra                           |
| ---------------------- | -------------------------------- |
| Typed Responses        | Komplett andere Architektur      |
| Client-defined Queries | Learning Curve                   |
|                        | Nicht für alle Use-Cases optimal |

**Entscheidung:** Abgelehnt - REST ist etabliert, Migration nicht gerechtfertigt.

---

## Consequences

### Positive

1. **Frontend Simplicity** - Immer gleiche Struktur
2. **Type-Safety** - Frontend kann Response-Type definieren
3. **Debugging** - Timestamps in allen Responses
4. **Error-Consistency** - Einheitliche Error-Codes
5. **Sentry Integration** - 5xx automatisch getracked
6. **Zero Boilerplate** - Controller returnen nur Daten

### Negative

1. **Response Overhead** - ~100 Bytes extra pro Response
2. **Magic** - Interceptor transformiert implizit
3. **Edge Cases** - Raw Responses (Metrics, Files) brauchen Handling

### Mitigations

| Problem       | Mitigation                        |
| ------------- | --------------------------------- |
| Overhead      | Gzip komprimiert effektiv         |
| Magic         | Dokumentation, ADR                |
| Raw Responses | Content-Type Check im Interceptor |

---

## Implementation Details

### Files

```
backend/src/nest/common/
├── interceptors/
│   └── response.interceptor.ts    # Success wrapping
└── filters/
    └── all-exceptions.filter.ts   # Error formatting
```

### Global Registration

```typescript
// main.ts
app.useGlobalInterceptors(new ResponseInterceptor());
app.useGlobalFilters(new AllExceptionsFilter());

// ODER app.module.ts (für DI)
{
  provide: APP_INTERCEPTOR,
  useClass: ResponseInterceptor,
},
{
  provide: APP_FILTER,
  useClass: AllExceptionsFilter,
}
```

### Skip Wrapping (Raw Responses)

```typescript
// Automatisch erkannt:
// 1. Content-Type != application/json
// 2. typeof data === 'string'
// 3. Buffer.isBuffer(data)
// 4. Already wrapped (has success property)
```

### Error Codes

| HTTP Status | Error Code            |
| ----------- | --------------------- |
| 400         | BAD_REQUEST           |
| 401         | UNAUTHORIZED          |
| 403         | FORBIDDEN             |
| 404         | NOT_FOUND             |
| 409         | CONFLICT              |
| 422         | UNPROCESSABLE_ENTITY  |
| 429         | TOO_MANY_REQUESTS     |
| 500         | INTERNAL_SERVER_ERROR |

### Zod Validation Errors

```typescript
// Automatisch formatiert:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Invalid email" },
      { "field": "password", "message": "Too short" }
    ]
  }
}
```

### Sentry Integration

```typescript
// Nur 5xx Errors werden reported:
if (status >= 500) {
  Sentry.captureException(exception, {
    extra: { path, method, statusCode, errorCode },
    tags: { statusCode, errorCode },
  });
}
// 4xx = Client Errors = nicht reported
```

---

## Frontend Usage

```typescript
// TypeScript Types
interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
  meta?: {
    pagination?: Pagination;
  };
}

interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
  timestamp: string;
  path: string;
}

type ApiResult<T> = ApiResponse<T> | ApiError;

// Usage
const result = await fetch('/api/v2/users').then((r) => r.json());
if (result.success) {
  console.log(result.data); // Typed!
} else {
  console.error(result.error.message);
}
```

---

## Verification

| Scenario              | Expected                                                | Status |
| --------------------- | ------------------------------------------------------- | ------ |
| GET /users            | { success: true, data: [...] }                          | ✅     |
| GET /users?page=1     | { success: true, data: [...], meta: { pagination } }    | ✅     |
| POST /users (invalid) | { success: false, error: { code: "VALIDATION_ERROR" } } | ✅     |
| GET /invalid          | { success: false, error: { code: "NOT_FOUND" } }        | ✅     |
| 500 Error             | Sentry notification                                     | ✅     |
| GET /metrics          | Plain text (not wrapped)                                | ✅     |

---

## References

- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [Sentry NestJS Integration](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [ADR-002: Alerting & Monitoring](./ADR-002-alerting-monitoring.md) - Sentry setup
