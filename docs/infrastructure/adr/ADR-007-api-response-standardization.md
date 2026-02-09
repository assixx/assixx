# ADR-007: API Response Standardization

| Metadata                | Value                                              |
| ----------------------- | -------------------------------------------------- |
| **Status**              | Accepted                                           |
| **Date**                | 2026-01-14                                         |
| **Decision Makers**     | SCS Technik                                        |
| **Affected Components** | ResponseInterceptor, AllExceptionsFilter, Frontend |

---

## Context

A consistent API requires uniform response formats:

1. **Frontend DX** - Uniform structure for error handling
2. **Debugging** - Timestamps, request IDs for logs
3. **Pagination** - Metadata for lists
4. **Error Tracking** - Structured errors for Sentry

### Problem

Without standardization:

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

**Result:** Frontend must handle every endpoint differently.

---

## Decision

### Uniform Response Structure

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
         \u2502
         \u25bc
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 ResponseInterceptor                \u2502
\u2502 \u2192 Wraps in { success: true, data } \u2502
\u2502 \u2192 Adds timestamp                   \u2502
\u2502 \u2192 Handles pagination metadata      \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
         \u2502
         \u25bc
Response: { success: true, data: { users: [...] }, timestamp: "..." }
```

### Error Flow

```
Service throws new UnauthorizedException('Invalid token')
         \u2502
         \u25bc
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 AllExceptionsFilter                \u2502
\u2502 \u2192 Catches exception                \u2502
\u2502 \u2192 Determines status code           \u2502
\u2502 \u2192 Formats error structure          \u2502
\u2502 \u2192 Logs (warn for 4xx, error for 5xx)\u2502
\u2502 \u2192 Reports 5xx to Sentry            \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
         \u2502
         \u25bc
Response: { success: false, error: { code: "UNAUTHORIZED", message: "..." }, ... }
```

---

## Alternatives Considered

### 1. No Interceptor (Manual Wrapping)

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

| Pros     | Cons                       |
| -------- | -------------------------- |
| Explicit | Repetitive (50+ endpoints) |
| No magic | Easy to forget             |
|          | Inconsistencies possible   |

**Decision:** Rejected - Too error-prone.

### 2. NestJS ClassSerializerInterceptor

| Pros            | Cons                       |
| --------------- | -------------------------- |
| NestJS built-in | Only for class-transformer |
| Decorator-based | No response wrapping       |
|                 | No pagination support      |

**Decision:** Rejected - Not designed for response wrapping.

### 3. JSON:API Specification

```json
{
  "data": [...],
  "meta": { "total": 100 },
  "links": { "self": "/users", "next": "/users?page=2" }
}
```

| Pros       | Cons                           |
| ---------- | ------------------------------ |
| Standard   | Complex for simple APIs        |
| Hypermedia | Frontend needs JSON:API client |
|            | Overhead for small responses   |

**Decision:** Rejected - Overkill for internal API.

### 4. GraphQL

| Pros                   | Cons                              |
| ---------------------- | --------------------------------- |
| Typed responses        | Completely different architecture |
| Client-defined queries | Learning curve                    |
|                        | Not optimal for all use cases     |

**Decision:** Rejected - REST is established, migration not justified.

---

## Consequences

### Positive

1. **Frontend simplicity** - Always the same structure
2. **Type-safety** - Frontend can define response type
3. **Debugging** - Timestamps in all responses
4. **Error consistency** - Uniform error codes
5. **Sentry integration** - 5xx automatically tracked
6. **Zero boilerplate** - Controllers only return data

### Negative

1. **Response overhead** - ~100 bytes extra per response
2. **Magic** - Interceptor transforms implicitly
3. **Edge cases** - Raw responses (metrics, files) need handling

### Mitigations

| Problem       | Mitigation                        |
| ------------- | --------------------------------- |
| Overhead      | Gzip compresses effectively       |
| Magic         | Documentation, ADR                |
| Raw Responses | Content-Type check in interceptor |

---

## Implementation Details

### Files

```
backend/src/nest/common/
\u251c\u2500\u2500 interceptors/
\u2502   \u2514\u2500\u2500 response.interceptor.ts    # Success wrapping
\u2514\u2500\u2500 filters/
    \u2514\u2500\u2500 all-exceptions.filter.ts   # Error formatting
```

### Global Registration

```typescript
// main.ts
app.useGlobalInterceptors(new ResponseInterceptor());
app.useGlobalFilters(new AllExceptionsFilter());

// OR app.module.ts (for DI)
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
// Automatically detected:
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
// Automatically formatted:
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
// Only 5xx errors are reported:
if (status >= 500) {
  Sentry.captureException(exception, {
    extra: { path, method, statusCode, errorCode },
    tags: { statusCode, errorCode },
  });
}
// 4xx = Client errors = not reported
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
| GET /users            | { success: true, data: [...] }                          | \u2705 |
| GET /users?page=1     | { success: true, data: [...], meta: { pagination } }    | \u2705 |
| POST /users (invalid) | { success: false, error: { code: "VALIDATION_ERROR" } } | \u2705 |
| GET /invalid          | { success: false, error: { code: "NOT_FOUND" } }        | \u2705 |
| 500 Error             | Sentry notification                                     | \u2705 |
| GET /metrics          | Plain text (not wrapped)                                | \u2705 |

---

## References

- [NestJS Interceptors](https://docs.nestjs.com/interceptors)
- [NestJS Exception Filters](https://docs.nestjs.com/exception-filters)
- [Sentry NestJS Integration](https://docs.sentry.io/platforms/javascript/guides/nestjs/)
- [ADR-002: Alerting & Monitoring](./ADR-002-alerting-monitoring.md) - Sentry setup
