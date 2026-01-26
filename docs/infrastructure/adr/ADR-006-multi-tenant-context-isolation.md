# ADR-006: Multi-Tenant Context Isolation

| Metadata                | Value                                        |
| ----------------------- | -------------------------------------------- |
| **Status**              | Accepted                                     |
| **Date**                | 2026-01-14                                   |
| **Decision Makers**     | SCS Technik                                  |
| **Affected Components** | All Services, Database Queries, Interceptors |

---

## Context

Assixx ist eine Multi-Tenant SaaS-Anwendung:

- **Tenant = Firma** - Jede Firma hat eigene Daten
- **Strikte Isolation** - Tenant A darf niemals Daten von Tenant B sehen
- **Alle Tabellen** haben `tenant_id` Column
- **Jede Query** muss `WHERE tenant_id = ?` enthalten

### Problem

Wie propagiert man `tenantId` durch alle Service-Layer ohne:

1. Jeden Service-Parameter um `tenantId` zu erweitern?
2. Risiko zu vergessen, `tenantId` in einer Query zu verwenden?
3. Controller-zu-Service-zu-Repository Parameter-Drilling?

### Anforderungen

- Tenant-Context muss in ALLEN Services verfügbar sein
- Kein manuelles Durchreichen von `tenantId`
- Request-Scope (nicht global!)
- TypeScript-typisiert
- Einfach zu debuggen

---

## Decision

### CLS (Continuation-Local Storage) via nestjs-cls

Wir verwenden **nestjs-cls** für Request-Scoped Context:

```typescript
// Setzen (in Guard/Interceptor)
this.cls.set('tenantId', user.tenantId);

// Lesen (in jedem Service)
const tenantId = this.cls.get('tenantId');
```

### Architektur

```
Request
    │
    ▼
┌─────────────────────────────────────────┐
│ JwtAuthGuard                            │
│ → Validates JWT                         │
│ → Loads User from DB                    │
│ → Sets CLS: tenantId, userId, userRole  │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ TenantContextInterceptor (Backup)       │
│ → Sets CLS from request.user            │
│ → Logging für Debug                     │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ Controller                              │
│ → Keine tenantId Parameter nötig        │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ Service                                 │
│ const tenantId = this.cls.get('tenantId')│
│ → Automatisch verfügbar!                │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│ Database Query                          │
│ WHERE tenant_id = $tenantId             │
└─────────────────────────────────────────┘
```

### CLS Values

| Key         | Type   | Gesetzt von              | Verwendung             |
| ----------- | ------ | ------------------------ | ---------------------- |
| `tenantId`  | number | JwtAuthGuard             | Alle DB-Queries        |
| `userId`    | number | JwtAuthGuard             | Audit-Logs, Created-By |
| `userRole`  | string | JwtAuthGuard             | Service-Level Auth     |
| `userEmail` | string | TenantContextInterceptor | Logging                |

### Warum Double-Setting (Guard + Interceptor)?

```
Guard:       Setzt CLS bei erfolgreicher Auth
Interceptor: Backup + Logging für Debug

Reihenfolge: Guard → Interceptor → Controller
```

Der Interceptor ist ein **Safety-Net** falls CLS im Guard nicht gesetzt wurde.

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

| Pro         | Contra                                  |
| ----------- | --------------------------------------- |
| Explizit    | Jede Methode braucht tenantId Parameter |
| Keine Magic | Leicht zu vergessen                     |
|             | Tiefe Call-Stacks = viele Parameter     |
|             | Refactoring-Aufwand bei Änderungen      |

**Entscheidung:** Abgelehnt - Zu fehleranfällig bei 50+ Services.

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

| Pro                   | Contra                                     |
| --------------------- | ------------------------------------------ |
| Automatisch verfügbar | ALLE Services müssen REQUEST-scoped sein   |
| Keine CLS-Dependency  | Performance-Impact (keine Singletons mehr) |
|                       | Circular Dependency Probleme               |
|                       | Nicht in Background-Jobs verfügbar         |

**Entscheidung:** Abgelehnt - Performance-Kosten zu hoch.

### 3. AsyncLocalStorage direkt (Node.js native)

```typescript
import { AsyncLocalStorage } from 'async_hooks';

const als = new AsyncLocalStorage<{ tenantId: number }>();
```

| Pro              | Contra                             |
| ---------------- | ---------------------------------- |
| Keine Dependency | Manuelles Setup                    |
| Node.js native   | Kein NestJS Integration            |
|                  | Kein TypeScript Support out-of-box |
|                  | Middleware-Setup selbst schreiben  |

**Entscheidung:** Abgelehnt - nestjs-cls bietet bessere DX.

### 4. PostgreSQL Row-Level Security (RLS)

```sql
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id')::int);
```

| Pro                  | Contra                                |
| -------------------- | ------------------------------------- |
| DB-Level Enforcement | SET vor jeder Query nötig             |
| Unmöglich zu umgehen | Connection Pooling kompliziert        |
|                      | Debugging schwieriger                 |
|                      | Nicht alle Queries brauchen Isolation |

**Entscheidung:** Teilweise verwendet - RLS als zusätzliche Sicherheitsschicht, aber nicht primär.

---

## Consequences

### Positive

1. **Kein Parameter-Drilling** - Services haben automatisch Zugriff
2. **Typsicher** - `cls.get<number>('tenantId')`
3. **Debuggable** - Interceptor loggt Context
4. **Request-Isolated** - Keine Cross-Request Contamination
5. **Testbar** - CLS kann in Tests gemockt werden
6. **Flexibel** - Auch für userId, userRole, etc. verwendbar

### Negative

1. **Implicit Dependency** - Services brauchen ClsService injection
2. **Runtime Error** - `cls.get()` kann undefined sein wenn nicht gesetzt
3. **Learning Curve** - Entwickler müssen CLS verstehen

### Mitigations

| Problem        | Mitigation                       |
| -------------- | -------------------------------- |
| Undefined CLS  | Guard setzt IMMER vor Controller |
| Implicit Dep   | Dokumentation + Code Review      |
| Learning Curve | ADR + Inline Docs                |

---

## Implementation Details

### Files

```
backend/src/nest/
├── common/
│   ├── guards/
│   │   └── jwt-auth.guard.ts           # Sets CLS context
│   └── interceptors/
│       └── tenant-context.interceptor.ts # Backup + Logging
├── app.module.ts                        # ClsModule registration
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
// Empfohlen für häufige Verwendung
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
| Authenticated Request | tenantId in CLS                    | ✅     |
| Service Query         | WHERE tenant_id = ?                | ✅     |
| Parallel Requests     | Isolation (no cross-contamination) | ✅     |
| Public Endpoint       | CLS empty (OK)                     | ✅     |
| Background Job        | Manuelles CLS Setup möglich        | ✅     |

---

## References

- [nestjs-cls Documentation](https://github.com/Papooch/nestjs-cls)
- [Node.js AsyncLocalStorage](https://nodejs.org/api/async_context.html)
- [Multi-Tenancy Patterns](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/tenancy-models)
- [ADR-005: Authentication Strategy](./ADR-005-authentication-strategy.md) - Sets CLS context
