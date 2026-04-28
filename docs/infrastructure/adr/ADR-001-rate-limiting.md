# ADR-001: Rate Limiting Implementation

| Metadata                | Value                                                                  |
| ----------------------- | ---------------------------------------------------------------------- |
| **Status**              | Accepted                                                               |
| **Date**                | 2026-01-06 (Updated 2026-01-19, 2026-04-19)                            |
| **Decision Makers**     | SCS Technik                                                            |
| **Affected Components** | Backend API, Redis, Authentication                                     |
| **Related ADRs**        | ADR-049 (Tenant Domain Verification — introduced `domain-verify` tier) |

---

## Context

The Assixx backend requires rate limiting for protection against:

1. **Brute-force attacks** on login/signup endpoints
2. **DoS attacks** through request flooding
3. **API abuse** through excessive usage
4. **Resource exhaustion** on upload endpoints

### Requirements

- Multi-tier rate limiting (different limits per endpoint type)
- Distributed rate limiting (works across multiple backend instances)
- User-based tracking (not just IP-based)
- Integration with NestJS + Fastify
- Persistent storage (survives container restart)

### Existing Setup

- Backend: NestJS 11 + Fastify 5
- Cache: Redis 7 (already present in Docker Compose)
- Auth: JWT-based with HttpOnly Cookies

---

## Decision

We implement rate limiting with:

### Technology Stack

| Component     | Choice                              | Version |
| ------------- | ----------------------------------- | ------- |
| Rate Limiter  | `@nestjs/throttler`                 | 6.5.0   |
| Redis Storage | `@nest-lab/throttler-storage-redis` | 1.1.0   |
| Redis Client  | `ioredis`                           | 5.x     |

### Rate Limit Tiers

| Tier            | Limit | Window | Use Case                                                                     |
| --------------- | ----- | ------ | ---------------------------------------------------------------------------- |
| `auth`          | 10    | 5 min  | Brute-force protection (login, signup, password reset)                       |
| `public`        | 100   | 15 min | Public endpoints                                                             |
| `user`          | 1000  | 15 min | Authenticated users (default for most routes)                                |
| `admin`         | 2000  | 15 min | Admin endpoints (dashboard, bulk operations)                                 |
| `upload`        | 20    | 1 hour | File uploads                                                                 |
| `export`        | 1     | 1 min  | Audit log / bulk data export (prevents DoS via large export operations)      |
| `domain-verify` | 10    | 10 min | `POST /domains/:id/verify` — outbound DNS resolver protection (ADR-049 §2.7) |

### Tracking Strategy

- **Unauthenticated Requests**: IP address (with proxy header support)
- **Authenticated Requests**: User ID from JWT

### Guard Order

```
1. CustomThrottlerGuard  → Rate Limiting
2. JwtAuthGuard          → Authentication
3. RolesGuard            → Authorization
```

---

## Alternatives Considered

### 1. @fastify/rate-limit

| Pros                       | Cons                  |
| -------------------------- | --------------------- |
| Native Fastify Integration | No NestJS Decorators  |
| Hook-based                 | Manual guard setup    |
| Direct Redis support       | Less NestJS-idiomatic |

**Decision**: Rejected - `@nestjs/throttler` offers better DX with decorators.

### 2. Custom Implementation

| Pros             | Cons                         |
| ---------------- | ---------------------------- |
| Full control     | Increased maintenance effort |
| No dependencies  | Error-prone                  |
| Exactly tailored | Time-consuming               |

**Decision**: Rejected - Official NestJS package is battle-tested.

### 3. In-Memory Storage (no Redis)

| Pros                | Cons                        |
| ------------------- | --------------------------- |
| Simpler             | Not distributed             |
| No Redis dependency | Lost on restart             |
|                     | Multi-instance not possible |

**Decision**: Rejected - Redis already available, distributed rate limiting required.

### 4. nestjs-throttler-storage-redis (kkoomen)

| Pros           | Cons                     |
| -------------- | ------------------------ |
| Well-known     | **ARCHIVED** (Sept 2024) |
| Many tutorials | No maintenance           |

**Decision**: Rejected - Package is deprecated. Using `@nest-lab/throttler-storage-redis` (active fork) instead.

---

## Consequences

### Positive

1. **Brute-force protection**: Login with 10 attempts per 5 min
2. **Scalability**: Redis-backed = multi-instance ready
3. **User tracking**: Prevents IP rotation circumvention
4. **DX**: Simple `@AuthThrottle()` decorator usage
5. **Observability**: Logging on rate limit violations
6. **Custom error messages**: User-friendly error messages

### Negative

1. **Redis dependency**: Backend does not start without Redis
2. **Complexity**: Additional configuration required
3. **Dev friction**: Developers can lock themselves out (-> Manual Reset Docs)

### Neutral

1. **Monitoring**: Rate limit logs must be monitored
2. **Tuning**: Limits may need adjustment based on production experience

---

## Implementation Details

### Files Created

```
backend/src/nest/
├── throttler/
│   └── throttler.module.ts
├── common/
│   ├── guards/
│   │   └── throttler.guard.ts
│   └── decorators/
│       └── throttle.decorators.ts
```

### Files Modified

- `docker/docker-compose.yml` - Added REDIS_HOST, REDIS_PORT to backend
- `backend/package.json` - Added throttler packages, removed rate-limit-redis
- `backend/src/nest/app.module.ts` - Integrated ThrottlerModule and Guard

### Docker Environment

```yaml
# docker-compose.yml backend environment
REDIS_HOST: redis
REDIS_PORT: 6379
```

---

## Critical: SkipThrottle for Named Throttlers

**Problem (2026-01-19):** Login was blocked after 1-2 requests, even though the `auth` tier allows 10/5min.

**Root Cause:** `@nestjs/throttler` applies ALL defined throttlers, not just the one named in the decorator. The `export` throttler (1/min) blocked immediately.

**Solution:** Each decorator must explicitly skip the other throttlers:

```typescript
// WRONG - all 6 throttlers are applied\!
export const AuthThrottle = () =>
  Throttle({ auth: { limit: 10, ttl: 5 * MS_MINUTE } });

// CORRECT - only auth throttler active
export const AuthThrottle = () =>
  applyDecorators(
    Throttle({ auth: { limit: 10, ttl: 5 * MS_MINUTE } }),
    SkipThrottle({ public: true, user: true, admin: true, upload: true, export: true, 'domain-verify': true }),
  );
```

**Important from NestJS Docs:**

> "Simply using `@SkipThrottle()` without an object will not skip any named throttlers."

---

## Mandatory Rule: Adding a New Throttler Tier

> **This rule is binding. Violating it produces production bugs that are invisible in unit tests.**

When adding a new named throttler to `AppThrottlerModule`, every convenience decorator in `backend/src/nest/common/decorators/throttle.decorators.ts` must be updated in **the same PR**.

### Mandatory sequence

1. Register the tier in `backend/src/nest/throttler/throttler.module.ts`:
   ```typescript
   throttlers: [
     // …existing tiers…
     { name: '<new-tier>', ttl: <ms>, limit: <count> },
   ],
   ```
2. Add (or reuse) a convenience decorator in `throttle.decorators.ts` that applies the new tier AND skips ALL OTHERS:
   ```typescript
   export const NewTierThrottle = (): ThrottleDecorator =>
     applyDecorators(
       Throttle({ '<new-tier>': { limit, ttl } }),
       SkipThrottle({
         auth: true,
         public: true,
         user: true,
         admin: true,
         upload: true,
         export: true,
         // …every other registered tier except `<new-tier>`…
       }),
     ) as ThrottleDecorator;
   ```
3. **AUDIT every existing decorator** and add `'<new-tier>': true` to its `SkipThrottle({...})` list:
   - `AuthThrottle`
   - `UserThrottle`
   - `AdminThrottle`
   - `ExportThrottle`
   - `FeedbackThrottle`
   - Any other convenience decorator in the file
4. Verify with `grep -n "SkipThrottle" backend/src/nest/common/decorators/throttle.decorators.ts` — every decorator (except the one that OWNS the new tier) must list the new tier.
5. Run the full integration test suite. Any 429 on a non-`<new-tier>`-endpoint means a decorator wasn't updated.

### Why this matters

`@nestjs/throttler` **applies every registered tier to every route** unless explicitly skipped. So the moment a new tier lands in `AppThrottlerModule`, every `@UserThrottle()` / `@AuthThrottle()` / … endpoint silently starts counting against that new tier too. If the new tier is tight (e.g. 10/10min), this caps every authenticated endpoint at that rate — invisible in unit tests (mocks bypass Redis), visible only in load/integration testing or live production traffic.

### Regression case study (2026-04-19)

[ADR-049](./ADR-049-tenant-domain-verification.md) §2.7 introduced the `domain-verify` tier (10/10min) on `POST /domains/:id/verify`. The `domain-verify` key was added to `AppThrottlerModule` **but not to the other decorators' `SkipThrottle` lists**. Result: for ~24 hours, every authenticated endpoint (POST /users, POST /domains, GET /auth/me, …) silently counted against a 10/10min bucket. An actual customer session would have 429'd within minutes of normal usage.

The bug was surfaced NOT by unit tests (they mock `pg` and `ioredis` — the real constraint layer never runs) but by a **live smoke-test** where the same `assixx` user exhausted the bucket across a suite of ~40 POST calls. Redis counter inspection proved the hypothesis: `throttle:{<hash>:domain-verify}:hits = 12` with a `:blocked` key, despite the failing route being `@UserThrottle()` (not `@DomainVerifyThrottle()`).

**Mitigation:** the 5 non-`domain-verify` decorators got `'domain-verify': true` added to their `SkipThrottle`, the integration suite went green in a single run (41 passed, 4 deferred, 0 failed), and this ADR section was added to codify the rule so the next tier addition doesn't repeat the mistake.

### Optional CI guard (follow-up, not implemented)

A simple arch-test in `shared/src/architectural.test.ts` could enforce this automatically:

- Parse `throttler.module.ts` to extract the tier-name list (regex `{ name: '(\w+)'`).
- Parse `throttle.decorators.ts` to extract every decorator's `SkipThrottle({...})` entries.
- Assert: for every decorator EXCEPT `<Tier>Throttle`, all tiers except its own are listed as `true`.
- Failure message points at the drifting decorator + missing tier, same pattern as §2.11 arch-test in ADR-049.

---

## Verification

### Tested Scenarios

| Scenario           | Expected     | Actual       | Status |
| ------------------ | ------------ | ------------ | ------ |
| 10 Login Attempts  | 429 on 11th  | 429 on 11th  | ✅     |
| Redis Keys Created | throttle:\*  | throttle:\*  | ✅     |
| Error Message      | Custom text  | Custom text  | ✅     |
| Manual Reset       | Keys deleted | Keys deleted | ✅     |

### Documentation

- [Rate Limiting Guide](../RATE-LIMITING-NESTJS-PLAN.md)

---

## References

- [NestJS Throttler Docs](https://docs.nestjs.com/security/rate-limiting)
- [@nestjs/throttler GitHub](https://github.com/nestjs/throttler)
- [@nest-lab/throttler-storage-redis](https://github.com/jmcdo29/nest-lab/tree/main/packages/throttler-storage-redis)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
