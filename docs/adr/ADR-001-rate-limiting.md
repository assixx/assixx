# ADR-001: Rate Limiting Implementation

| Metadata | Value |
|----------|-------|
| **Status** | Accepted |
| **Date** | 2026-01-06 |
| **Decision Makers** | SCS Technik |
| **Affected Components** | Backend API, Redis, Authentication |

---

## Context

Das Assixx-Backend benötigt Rate Limiting zum Schutz vor:

1. **Brute-Force-Attacken** auf Login/Signup-Endpoints
2. **DoS-Attacken** durch Request-Flooding
3. **API-Missbrauch** durch übermäßige Nutzung
4. **Resource-Erschöpfung** bei Upload-Endpoints

### Anforderungen

- Multi-Tier Rate Limiting (unterschiedliche Limits pro Endpoint-Typ)
- Distributed Rate Limiting (funktioniert über mehrere Backend-Instanzen)
- User-basiertes Tracking (nicht nur IP-basiert)
- Integration mit NestJS + Fastify
- Persistente Speicherung (überlebt Container-Restart)

### Bestehendes Setup

- Backend: NestJS 11 + Fastify 5
- Cache: Redis 7 (bereits in Docker-Compose vorhanden)
- Auth: JWT-basiert mit HttpOnly Cookies

---

## Decision

Wir implementieren Rate Limiting mit:

### Technologie-Stack

| Component | Choice | Version |
|-----------|--------|---------|
| Rate Limiter | `@nestjs/throttler` | 6.5.0 |
| Redis Storage | `@nest-lab/throttler-storage-redis` | 1.1.0 |
| Redis Client | `ioredis` | 5.x |

### Rate Limit Tiers

| Tier | Limit | Window | Use Case |
|------|-------|--------|----------|
| `auth` | 5 | 15 min | Brute-Force-Schutz |
| `public` | 100 | 15 min | Public Endpoints |
| `user` | 1000 | 15 min | Authenticated Users |
| `admin` | 2000 | 15 min | Admin Endpoints |
| `upload` | 20 | 1 hour | File Uploads |

### Tracking-Strategie

- **Unauthenticated Requests**: IP-Adresse (mit Proxy-Header-Support)
- **Authenticated Requests**: User ID aus JWT

### Guard-Reihenfolge

```
1. CustomThrottlerGuard  → Rate Limiting
2. JwtAuthGuard          → Authentication
3. RolesGuard            → Authorization
```

---

## Alternatives Considered

### 1. @fastify/rate-limit

| Pro | Contra |
|-----|--------|
| Native Fastify Integration | Keine NestJS Decorators |
| Hook-basiert | Manuelles Guard-Setup |
| Direkte Redis-Unterstützung | Weniger NestJS-idiomatisch |

**Entscheidung**: Abgelehnt - `@nestjs/throttler` bietet bessere DX mit Decorators.

### 2. Custom Implementation

| Pro | Contra |
|-----|--------|
| Volle Kontrolle | Erhöhter Wartungsaufwand |
| Keine Dependencies | Fehleranfällig |
| Exakt passend | Zeitaufwändig |

**Entscheidung**: Abgelehnt - Official NestJS Package ist battle-tested.

### 3. In-Memory Storage (kein Redis)

| Pro | Contra |
|-----|--------|
| Einfacher | Nicht distributed |
| Keine Redis-Abhängigkeit | Verloren bei Restart |
| | Multi-Instance nicht möglich |

**Entscheidung**: Abgelehnt - Redis bereits vorhanden, distributed Rate Limiting erforderlich.

### 4. nestjs-throttler-storage-redis (kkoomen)

| Pro | Contra |
|-----|--------|
| Bekannt | **ARCHIVED** (Sept 2024) |
| Viele Tutorials | Keine Maintenance |

**Entscheidung**: Abgelehnt - Paket ist deprecated. Stattdessen `@nest-lab/throttler-storage-redis` (aktiver Fork).

---

## Consequences

### Positive

1. **Brute-Force-Schutz**: Login mit 5 Attempts pro 15 Min
2. **Skalierbarkeit**: Redis-backed = Multi-Instance ready
3. **User-Tracking**: Verhindert IP-Rotation-Umgehung
4. **DX**: Einfache `@AuthThrottle()` Decorator-Nutzung
5. **Observability**: Logging bei Rate-Limit-Verletzungen
6. **Custom Error Messages**: User-freundliche Fehlermeldungen

### Negative

1. **Redis-Abhängigkeit**: Backend startet nicht ohne Redis
2. **Komplexität**: Zusätzliche Konfiguration erforderlich
3. **Dev-Friction**: Entwickler können sich selbst aussperren (→ Manual Reset Docs)

### Neutral

1. **Monitoring**: Rate-Limit-Logs müssen überwacht werden
2. **Tuning**: Limits müssen ggf. nach Production-Erfahrung angepasst werden

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

## Verification

### Tested Scenarios

| Scenario | Expected | Actual | Status |
|----------|----------|--------|--------|
| 5 Login Attempts | 429 on 6th | 429 on 6th | ✅ |
| Redis Keys Created | throttle:* | throttle:* | ✅ |
| Error Message | Custom text | Custom text | ✅ |
| Manual Reset | Keys deleted | Keys deleted | ✅ |

### Documentation

- [Rate Limiting Guide](../RATE-LIMITING-NESTJS-PLAN.md)

---

## References

- [NestJS Throttler Docs](https://docs.nestjs.com/security/rate-limiting)
- [@nestjs/throttler GitHub](https://github.com/nestjs/throttler)
- [@nest-lab/throttler-storage-redis](https://github.com/jmcdo29/nest-lab/tree/main/packages/throttler-storage-redis)
- [OWASP Rate Limiting](https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html)
