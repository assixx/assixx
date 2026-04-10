# ADR-006: Multi-Tenant Context Isolation

| Metadata                | Value                                        |
| ----------------------- | -------------------------------------------- |
| **Status**              | Accepted                                     |
| **Date**                | 2026-01-14                                   |
| **Decision Makers**     | SCS Technik                                  |
| **Affected Components** | All Services, Database Queries, Interceptors |
| **Related ADRs**        | ADR-005 (Auth), ADR-019 (RLS Enforcement)    |

---

## Context

Assixx is a multi-tenant SaaS application:

- **Tenant = Company** - Each company has its own data
- **Strict Isolation** - Tenant A must never see data from Tenant B
- **All tables** have a `tenant_id` column
- **Every query** must contain `WHERE tenant_id = ?`

### Problem

How to propagate `tenantId` through all service layers without:

1. Extending every service parameter with `tenantId`?
2. Risking forgetting to use `tenantId` in a query?
3. Controller-to-service-to-repository parameter drilling?

### Requirements

- Tenant context must be available in ALL services
- No manual passing of `tenantId`
- Request-scoped (not global!)
- TypeScript-typed
- Easy to debug

---

## Decision

### CLS (Continuation-Local Storage) via nestjs-cls

We use **nestjs-cls** for request-scoped context:

```typescript
// Setting (in Guard/Interceptor)
this.cls.set('tenantId', user.tenantId);

// Reading (in any service)
const tenantId = this.cls.get('tenantId');
```

### Architecture

```
Request
    \u2502
    \u25bc
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 JwtAuthGuard                            \u2502
\u2502 \u2192 Validates JWT                         \u2502
\u2502 \u2192 Loads User from DB                    \u2502
\u2502 \u2192 Sets CLS: tenantId, userId, userRole  \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
    \u2502
    \u25bc
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 TenantContextInterceptor (Backup)       \u2502
\u2502 \u2192 Sets CLS from request.user            \u2502
\u2502 \u2192 Logging for debug                     \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
    \u2502
    \u25bc
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 Controller                              \u2502
\u2502 \u2192 No tenantId parameter needed          \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
    \u2502
    \u25bc
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 Service                                 \u2502
\u2502 const tenantId = this.cls.get('tenantId')\u2502
\u2502 \u2192 Automatically available!              \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
    \u2502
    \u25bc
\u250c\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510
\u2502 Database Query                          \u2502
\u2502 WHERE tenant_id = $tenantId             \u2502
\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
```

### CLS Values

| Key         | Type   | Set by                   | Usage                  |
| ----------- | ------ | ------------------------ | ---------------------- |
| `tenantId`  | number | JwtAuthGuard             | All DB queries         |
| `userId`    | number | JwtAuthGuard             | Audit logs, created-by |
| `userRole`  | string | JwtAuthGuard             | Service-level auth     |
| `userEmail` | string | TenantContextInterceptor | Logging                |

### Why Double-Setting (Guard + Interceptor)?

```
Guard:       Sets CLS on successful auth
Interceptor: Backup + logging for debug

Order: Guard \u2192 Interceptor \u2192 Controller
```

The interceptor is a **safety net** in case CLS was not set in the guard.

---

## Alternatives Considered

### 1. Parameter Drilling

```typescript
// Controller
@Get()
getUsers(@CurrentUser() user: AuthUser) {
  return this.usersService.findAll(user.tenantId);
}

// Service
async findAll(tenantId: number) {
  return this.repository.find({ tenantId });
}
```

| Pros     | Cons                                    |
| -------- | --------------------------------------- |
| Explicit | Every method needs a tenantId parameter |
| No magic | Easy to forget                          |
|          | Deep call stacks = many parameters      |
|          | Refactoring effort on changes           |

**Decision:** Rejected - Too error-prone with 50+ services.

### 2. Request-Scoped Services

```typescript
@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  constructor(@Inject(REQUEST) private request: FastifyRequest) {}

  get tenantId() {
    return this.request.user.tenantId;
  }
}
```

| Pros                    | Cons                                    |
| ----------------------- | --------------------------------------- |
| Automatically available | ALL services must be REQUEST-scoped     |
| No CLS dependency       | Performance impact (no more singletons) |
|                         | Circular dependency problems            |
|                         | Not available in background jobs        |

**Decision:** Rejected - Performance costs too high.

### 3. AsyncLocalStorage directly (Node.js native)

```typescript
import { AsyncLocalStorage } from 'async_hooks';

const als = new AsyncLocalStorage<{ tenantId: number }>();
```

| Pros           | Cons                                 |
| -------------- | ------------------------------------ |
| No dependency  | Manual setup                         |
| Node.js native | No NestJS integration                |
|                | No TypeScript support out-of-box     |
|                | Must write middleware setup yourself |

**Decision:** Rejected - nestjs-cls offers better DX.

### 4. PostgreSQL Row-Level Security (RLS)

```sql
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::int);
```

| Pros                 | Cons                            |
| -------------------- | ------------------------------- |
| DB-level enforcement | SET required before every query |
| Impossible to bypass | Connection pooling complicated  |
|                      | Debugging more difficult        |
|                      | Not all queries need isolation  |

**Decision:** Originally adopted as a secondary security layer. **Updated 2026-02-07 (see [ADR-019](./ADR-019-multi-tenant-rls-isolation.md)):** RLS is now the **primary database-layer enforcement** mechanism. CLS (this ADR) and RLS (ADR-019) are complementary — CLS propagates `tenantId` through the application layer, then `tenantTransaction()` injects it into PostgreSQL via `set_config('app.tenant_id', ...)` where strict-mode RLS policies block cross-tenant access at the engine level. Together they form the 3-layer Defense-in-Depth: CLS → `set_config` → RLS policies. The Cons listed above (SET required, pooling, debugging) were resolved by the `tenantTransaction()` wrapper and the Triple-User-Model (`app_user`/`sys_user`/`assixx_user`) documented in ADR-019.

---

## Consequences

### Positive

1. **No parameter drilling** - Services have automatic access
2. **Type-safe** - `cls.get<number>('tenantId')`
3. **Debuggable** - Interceptor logs context
4. **Request-isolated** - No cross-request contamination
5. **Testable** - CLS can be mocked in tests
6. **Flexible** - Also usable for userId, userRole, etc.

### Negative

1. **Implicit dependency** - Services need ClsService injection
2. **Runtime error** - `cls.get()` can be undefined if not set
3. **Learning curve** - Developers need to understand CLS

### Mitigations

| Problem        | Mitigation                          |
| -------------- | ----------------------------------- |
| Undefined CLS  | Guard ALWAYS sets before controller |
| Implicit dep   | Documentation + code review         |
| Learning curve | ADR + inline docs                   |

---

## Implementation Details

### Files

```
backend/src/nest/
\u251c\u2500\u2500 common/
\u2502   \u251c\u2500\u2500 guards/
\u2502   \u2502   \u2514\u2500\u2500 jwt-auth.guard.ts           # Sets CLS context
\u2502   \u2514\u2500\u2500 interceptors/
\u2502       \u2514\u2500\u2500 tenant-context.interceptor.ts # Backup + logging
\u251c\u2500\u2500 app.module.ts                        # ClsModule registration
```

### Module Registration

```typescript
// app.module.ts
import { ClsModule } from 'nestjs-cls';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req) => {
          cls.set('requestId', req.id);
        },
      },
    }),
  ],
})
```

### Service Usage

```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly cls: ClsService,
    private readonly db: DatabaseService,
  ) {}

  async findAll(): Promise<User[]> {
    const tenantId = this.cls.get<number>('tenantId');

    return this.db.query('SELECT * FROM users WHERE tenant_id = $1', [tenantId]);
  }
}
```

### Type-Safe Wrapper (Optional)

```typescript
// Recommended for frequent usage
@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  get tenantId(): number {
    const id = this.cls.get<number>('tenantId');
    if (id === undefined) {
      throw new Error('tenantId not set in CLS');
    }
    return id;
  }

  get userId(): number {
    return this.cls.get<number>('userId') ?? 0;
  }
}
```

---

## Verification

| Scenario              | Expected                           | Status |
| --------------------- | ---------------------------------- | ------ |
| Authenticated Request | tenantId in CLS                    | \u2705 |
| Service Query         | WHERE tenant_id = ?                | \u2705 |
| Parallel Requests     | Isolation (no cross-contamination) | \u2705 |
| Public Endpoint       | CLS empty (OK)                     | \u2705 |
| Background Job        | Manual CLS setup possible          | \u2705 |

---

## References

- [nestjs-cls Documentation](https://github.com/Papooch/nestjs-cls)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html)
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) - Sets CLS context
- [ADR-019: Multi-Tenant RLS Isolation](./ADR-019-multi-tenant-rls-isolation.md) - Database-layer enforcement (complementary to this ADR)
