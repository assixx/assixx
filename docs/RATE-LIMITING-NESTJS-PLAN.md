# Rate Limiting - NestJS Implementation

> **Status**: IMPLEMENTED
> **Implemented**: 2026-01-06
> **Verified**: Against official docs (@nestjs/throttler v6.5.0)
> **Branch**: feature/nestjs-migration

---

## 1. Overview

Multi-tier rate limiting system using `@nestjs/throttler` with Redis storage for distributed deployments.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    NestJS Backend                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │              CustomThrottlerGuard               │    │
│  │  - Extracts User ID from JWT (if present)      │    │
│  │  - Falls back to IP for unauthenticated        │    │
│  │  - Handles proxy headers (X-Forwarded-For)     │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
│                          ▼                               │
│  ┌─────────────────────────────────────────────────┐    │
│  │         ThrottlerStorageRedisService            │    │
│  │  - Distributed rate limiting                    │    │
│  │  - Keys: throttle:{hash}:{tier}:hits/blocked   │    │
│  └─────────────────────────────────────────────────┘    │
│                          │                               │
└──────────────────────────┼───────────────────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  Docker Redis   │
                  │  assixx-redis   │
                  │  Port 6379      │
                  └─────────────────┘
```

---

## 2. Rate Limit Tiers

| Tier | Limit | Window | Use Case | Tracking Key |
|------|-------|--------|----------|--------------|
| `auth` | **5** | 15 min | Login, Signup, Refresh | IP |
| `public` | 100 | 15 min | Public pages | IP |
| `user` | 1000 | 15 min | Authenticated endpoints | User ID |
| `admin` | 2000 | 15 min | Admin endpoints | User ID |
| `upload` | 20 | 1 hour | File uploads | User ID |

---

## 3. Installed Packages

```json
{
  "@nestjs/throttler": "6.5.0",
  "@nest-lab/throttler-storage-redis": "1.1.0",
  "ioredis": "^5.6.1"
}
```

**Removed**: `rate-limit-redis` (was Express-only, unused)

---

## 4. File Structure

```
backend/src/nest/
├── throttler/
│   └── throttler.module.ts           # ThrottlerModule + Redis config
├── common/
│   ├── guards/
│   │   └── throttler.guard.ts        # Custom guard (IP/User tracking)
│   └── decorators/
│       └── throttle.decorators.ts    # @AuthThrottle(), @UploadThrottle(), etc.
└── app.module.ts                     # Integration
```

---

## 5. Usage

### Apply Rate Limits with Decorators

```typescript
import { AuthThrottle, UploadThrottle, NoThrottle } from '../common/decorators/throttle.decorators.js';

@Controller('auth')
export class AuthController {
  @Post('login')
  @Public()
  @AuthThrottle()  // 5 req / 15 min
  async login() { }
}

@Controller('documents')
export class DocumentsController {
  @Post('upload')
  @UploadThrottle()  // 20 req / hour
  async upload() { }
}

// Skip rate limiting (use sparingly!)
@Get('health')
@NoThrottle()
async health() { }
```

### Available Decorators

| Decorator | Limit | Window |
|-----------|-------|--------|
| `@AuthThrottle()` | 5 | 15 min |
| `@PublicThrottle()` | 100 | 15 min |
| `@UserThrottle()` | 1000 | 15 min |
| `@AdminThrottle()` | 2000 | 15 min |
| `@UploadThrottle()` | 20 | 1 hour |
| `@NoThrottle()` | Skip | - |

---

## 6. Error Response

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": {
    "code": "TOO_MANY_REQUESTS",
    "message": "Rate limit exceeded. Please wait 60 seconds before retrying."
  },
  "timestamp": "2026-01-06T10:20:10.706Z",
  "path": "/api/v2/auth/login"
}
```

HTTP Status: `429 Too Many Requests`

---

## 7. Redis Key Structure

```
throttle:throttle:{hash}:{tier}:hits      → Request count
throttle:throttle:{hash}:{tier}:blocked   → Block status (if limit exceeded)
```

### Check Keys

```bash
# View all throttle keys
docker exec assixx-redis redis-cli KEYS "throttle:*"

# Check TTL for a specific key
docker exec assixx-redis redis-cli TTL "throttle:throttle:{hash}:auth:hits"
```

---

## 8. Development: Manual Reset

### Reset All Rate Limits

```bash
docker exec assixx-redis redis-cli KEYS "throttle:*" | xargs -I {} docker exec assixx-redis redis-cli DEL {}
```

### Reset Only Auth Limits (Login/Signup)

```bash
docker exec assixx-redis redis-cli KEYS "throttle:*auth*" | xargs -I {} docker exec assixx-redis redis-cli DEL {}
```

### Reset Only Upload Limits

```bash
docker exec assixx-redis redis-cli KEYS "throttle:*upload*" | xargs -I {} docker exec assixx-redis redis-cli DEL {}
```

### Check Remaining TTL

```bash
# Show TTL for all auth keys
for key in $(docker exec assixx-redis redis-cli KEYS "throttle:*auth*"); do
  echo -n "$key: "
  docker exec assixx-redis redis-cli TTL "$key"
done
```

---

## 9. Testing

### Test Auth Rate Limit (5 requests)

```bash
for i in {1..8}; do
  echo -n "Request $i: "
  curl -s -o /dev/null -w '%{http_code}\n' \
    -X POST http://localhost:3000/api/v2/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@test.de","password":"wrong"}'
  sleep 0.2
done

# Expected: 1-5 = 400 (bad credentials), 6-8 = 429 (rate limited)
```

### Verify Rate Limit Headers

```bash
curl -v http://localhost:3000/api/v2/users 2>&1 | grep -i "retry-after"
```

---

## 10. Configuration

### Environment Variables

```env
# docker/.env
REDIS_HOST=redis
REDIS_PORT=6379
```

### Modify Limits

Edit `backend/src/nest/throttler/throttler.module.ts`:

```typescript
throttlers: [
  { name: 'auth', ttl: 15 * MS_MINUTE, limit: 5 },      // Change here
  { name: 'public', ttl: 15 * MS_MINUTE, limit: 100 },
  // ...
],
```

---

## 11. Guard Execution Order

```
1. CustomThrottlerGuard  → Rate limiting (FIRST)
2. JwtAuthGuard          → Authentication
3. RolesGuard            → Authorization (LAST)
```

The throttler runs FIRST to block spam before authentication overhead.

---

## 12. Troubleshooting

### "429 Too Many Requests" in Development

```bash
# Reset all limits
docker exec assixx-redis redis-cli KEYS "throttle:*" | xargs -I {} docker exec assixx-redis redis-cli DEL {}
```

### Redis Connection Error

1. Check Redis is running: `docker-compose ps | grep redis`
2. Check env vars in docker-compose.yml: `REDIS_HOST=redis`, `REDIS_PORT=6379`
3. Test connection: `docker exec assixx-redis redis-cli ping`

### Rate Limit Not Working

1. Verify `CustomThrottlerGuard` is in `app.module.ts` providers
2. Check decorator is applied: `@AuthThrottle()` on endpoint
3. Check logs: `docker logs assixx-backend | grep -i throttle`

---

## 13. References

- [@nestjs/throttler v6.5.0](https://github.com/nestjs/throttler)
- [@nest-lab/throttler-storage-redis v1.1.0](https://github.com/jmcdo29/nest-lab/tree/main/packages/throttler-storage-redis)
- [ioredis](https://github.com/redis/ioredis)
- [ADR-007: Rate Limiting](./adr/ADR-007-rate-limiting.md)
