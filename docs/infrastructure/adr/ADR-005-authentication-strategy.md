# ADR-005: Authentication Strategy

| Metadata                | Value                                      |
| ----------------------- | ------------------------------------------ |
| **Status**              | Accepted                                   |
| **Date**                | 2026-01-14                                 |
| **Decision Makers**     | SCS Technik                                |
| **Affected Components** | Backend Guards, JWT, Database, CLS Context |

---

## Context

The Assixx backend requires a robust authentication strategy for:

1. **Multi-Tenant SaaS** - Strict isolation between tenants
2. **Role-based Access** - admin, employee, root with different permissions
3. **Role-Switching** - Admins can act as employees
4. **Multiple Token Sources** - Browser (Cookie), API (Header), WebSocket (Query)
5. **Security** - Token invalidation when a user is deactivated

### Requirements

- JWT-based stateless authentication
- Immediate invalidation upon user deactivation (not waiting for token expiry)
- Tenant context for all downstream services
- Support for HttpOnly Cookies (CSRF protection)
- WebSocket compatibility

### Existing Setup

- Backend: NestJS 11 + Fastify 5
- Database: PostgreSQL 17
- Context: nestjs-cls for request scope

---

## Decision

### Custom JwtAuthGuard instead of Passport.js

We implement a **Custom JwtAuthGuard** without Passport.js:

```
backend/src/nest/common/guards/jwt-auth.guard.ts
```

### Architectural Decisions

| Decision                | Chosen                    | Rationale                                 |
| ----------------------- | ------------------------- | ----------------------------------------- |
| **Auth Library**        | Custom Guard              | Full control, no Passport.js overhead     |
| **Token Storage**       | 3 sources                 | Header + Cookie + Query for all use cases |
| **User Validation**     | DB lookup per request     | Immediate invalidation possible           |
| **Context Propagation** | CLS (nestjs-cls)          | Request scope without parameter drilling  |
| **Token Type**          | Explicit `type: 'access'` | Prevents refresh token misuse             |

### Token Extraction (Order)

```typescript
1. Authorization: Bearer <token>  // API clients
2. Cookie: accessToken            // Browser (HttpOnly)
3. Query: ?token=<token>          // WebSocket handshake
```

### Validation Steps

```
1. Extract token from request
2. Verify JWT signature
3. Check token type = 'access'
4. Load user from DB (fresh data!)
5. Check is_active = 1
6. Validate role (root | admin | employee)
7. Set CLS context (tenantId, userId, userRole)
8. Attach user to request
```

### Why DB Lookup on Every Request?

| Scenario         | JWT Only                          | With DB Lookup      |
| ---------------- | --------------------------------- | ------------------- |
| User deactivated | Access until token expiry (15min) | Immediately blocked |
| Role changed     | Old role until token expiry       | Immediately updated |
| User deleted     | Access until token expiry         | Immediately 401     |

**Trade-off:** ~1ms latency per request vs. immediate invalidation

---

## Alternatives Considered

### 1. Passport.js (@nestjs/passport)

| Pros              | Cons                               |
| ----------------- | ---------------------------------- |
| Widely used       | Overhead for simple JWT validation |
| Many strategies   | Abstraction layer not needed       |
| Community support | Passport session not needed        |
|                   | Harder to debug                    |

**Decision:** Rejected - We only need JWT, not OAuth/SAML/etc.

### 2. JWT Only without DB Lookup

| Pros          | Cons                           |
| ------------- | ------------------------------ |
| Faster (~1ms) | No immediate invalidation      |
| Stateless     | User changes delayed           |
| Less DB load  | Security gap upon deactivation |

**Decision:** Rejected - Security > Performance for auth.

### 3. Token Blacklist in Redis

| Pros           | Cons                         |
| -------------- | ---------------------------- |
| Faster than DB | Additional complexity        |
| Stateless-like | Sync between Redis/DB needed |
|                | Blacklist can grow           |

**Decision:** Rejected - DB lookup is simpler and sufficiently fast.

### 4. Short-lived Tokens (1min) without DB Lookup

| Pros              | Cons                              |
| ----------------- | --------------------------------- |
| Stateless         | Very frequent token refreshes     |
| Fast invalidation | More load on auth endpoint        |
|                   | UX issues on offline/slow network |

**Decision:** Rejected - 15min token + DB lookup is a better compromise.

---

## Consequences

### Positive

1. **Immediate invalidation** - Deactivated users are blocked immediately
2. **Simple architecture** - No Passport.js, no Redis blacklist
3. **Full control** - Custom logic for multi-tenant, role-switching
4. **Debuggability** - Clear code flow, no magic
5. **Flexible token sources** - Browser, API, WebSocket all supported
6. **CLS integration** - Tenant context automatically available in all services

### Negative

1. **DB load** - One SELECT per authenticated request
2. **Latency** - ~1ms additional per request
3. **No social login** - Passport.js strategies not available (not needed)

### Mitigations

| Problem | Mitigation                                |
| ------- | ----------------------------------------- |
| DB load | Connection pooling, query is indexed (PK) |
| Latency | Query < 1ms, acceptable for security gain |

---

## Implementation Details

### Files

```
backend/src/nest/common/
\u251c\u2500\u2500 guards/
\u2502   \u2514\u2500\u2500 jwt-auth.guard.ts       # Custom JWT Guard
\u251c\u2500\u2500 decorators/
\u2502   \u251c\u2500\u2500 public.decorator.ts     # @Public() bypass auth
\u2502   \u251c\u2500\u2500 current-user.decorator.ts # @CurrentUser() param
\u2502   \u2514\u2500\u2500 tenant.decorator.ts     # @TenantId() param
\u2514\u2500\u2500 interfaces/
    \u2514\u2500\u2500 auth.interface.ts       # NestAuthUser, JwtPayload types
```

### Global Registration

```typescript
// app.module.ts
{
  provide: APP_GUARD,
  useClass: JwtAuthGuard,  // Applied to ALL routes
}
```

### @Public() Decorator

```typescript
// Bypasses JwtAuthGuard
@Public()
@Get('health')
getHealth() { ... }
```

---

## Verification

| Scenario           | Expected                  | Status |
| ------------------ | ------------------------- | ------ |
| Valid Token        | 200 + User attached       | \u2705 |
| No Token           | 401 Unauthorized          | \u2705 |
| Expired Token      | 401 Unauthorized          | \u2705 |
| Refresh Token used | 401 Invalid token type    | \u2705 |
| User deactivated   | 401 User inactive         | \u2705 |
| Invalid Role       | 401 Invalid role          | \u2705 |
| @Public() endpoint | 200 without token         | \u2705 |
| CLS Context        | tenantId/userId available | \u2705 |

---

## References

- [NestJS Guards](https://docs.nestjs.com/guards)
- [JWT Best Practices](https://auth0.com/blog/jwt-security-best-practices/)
- [nestjs-cls](https://github.com/Papooch/nestjs-cls)
- [ADR-001: Rate Limiting](./ADR-001-rate-limiting.md) - Related security measure
