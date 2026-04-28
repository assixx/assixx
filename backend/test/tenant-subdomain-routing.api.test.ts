/**
 * Tenant Subdomain Routing API Integration Tests — ADR-050 / Masterplan Phase 4.
 *
 * Exercises the FULL HTTP surface of ADR-050:
 *   A. Cross-tenant JWT replay (JwtAuthGuard's `CROSS_TENANT_HOST_MISMATCH`
 *      check — the single load-bearing line of the whole design)
 *   B. Apex / unknown-subdomain / nested-subdomain semantics (`hostTenantId=null`
 *      → cross-check skipped, by design — no timing leak on "is this slug real?")
 *   C. OAuth `/authorize` — `returnToSlug` propagation via X-Forwarded-Host
 *      (trusted) AND `?return_to_slug=` query fallback (tamper-prone, R15-defused)
 *   D. OAuth `/handoff` — R15 host-cross-check BEFORE Redis DEL (token preserved
 *      on mismatch so the legitimate user's flow can still complete)
 *   E. CORS allowlist (apex + subdomain + dev-localhost accept, foreign origin
 *      no-ACAO) — the regex in `main.ts` IS the policy contract
 *
 * ── Test-infra strategy (D8 resolution) ──────────────────────────────────────
 *   All 47 existing API tests hit `localhost:3000`. `extractSlug('localhost')`
 *   returns null → middleware sets `hostTenantId=null` → guard skips the
 *   cross-check. Those tests stay green with zero modification. THIS file is
 *   the opt-in: it uses `withTenantHost(slug)` from `helpers.ts` to spoof the
 *   Nginx-set `X-Forwarded-Host` header. Fastify's `trustProxy: true`
 *   (main.ts:284, ADR-050 §"Fastify trustProxy prerequisite") makes that
 *   header authoritative — same as production.
 *
 * ── Redis seeding (mirrors `oauth.api.test.ts` pattern) ──────────────────────
 *   Redis is only reachable inside the docker network (dev-convenience 6379
 *   publish is dropped in prod per R14 / `docker-compose.prod.yml`). We seed
 *   `oauth:handoff:{token}` via `docker exec assixx-redis redis-cli` instead
 *   of a real OAuth round-trip (which would require a signed Microsoft
 *   id_token — infeasible without mocking the whole Entra flow).
 *
 * ── DB fixtures (dev environment, verified 2026-04-21) ──────────────────────
 *   | id | subdomain | deletion_status |
 *   |----|-----------|-----------------|
 *   |  1 | apitest   | active          |  ← apitest tenant (auth.tenantId)
 *   |  2 | firma-a   | active          |
 *   |  3 | firma-b   | active          |  ← used as "other tenant" for replay
 *
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 4
 */
import { execSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AuthState,
  BASE_URL,
  type JsonBody,
  authHeaders,
  authOnly,
  loginApitest,
  withTenantHost,
} from './helpers.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** Dev Redis password — same as every other `*.api.test.ts`; mirrors docker/.env. */
const REDIS_PASSWORD = 'dev_only_redis_p@ss_a1b2c3d4e5f6g7h8i9j0';

/**
 * Cross-tenant replay uses `firma-b` (tenant id 3) as the "other" tenant —
 * hardcoded subdomain is fine because the test environment is the single
 * source of truth for fixture IDs (see file-header table).
 */
const OTHER_TENANT_SUBDOMAIN = 'firma-b';

/** Slug that passes the regex but has no matching tenant row → `hostTenantId=null`. */
const UNKNOWN_SUBDOMAIN = 'nonexistent-tenant-xyz';

/** Microsoft authorize origin — asserted loosely so a future tenant-id swap doesn't flake the test. */
const MS_AUTHORIZE_ORIGIN = 'login.microsoftonline.com';

// ─── Redis helpers (via docker exec — port 6379 not host-exposed in dev either
// because the anonymous-network publish is dropped in `docker-compose.prod.yml`,
// but the test-runner itself shells out to the container anyway for parity with
// `oauth.api.test.ts`) ────────────────────────────────────────────────────────

/**
 * Set a Redis key via docker exec. Value fed via stdin to avoid shell-escaping
 * the handoff JSON payload (which contains curly braces + quotes). TTL applied
 * as a second command — tiny race window, irrelevant for tests.
 */
function redisSet(key: string, value: string, ttlSeconds: number): void {
  execSync(
    `docker exec -i assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning -x SET ${key}`,
    { input: value, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning EXPIRE ${key} ${String(ttlSeconds)}`,
    { stdio: 'pipe' },
  );
}

function redisExists(key: string): boolean {
  const out = execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning EXISTS ${key}`,
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  ).trim();
  return out === '1';
}

function redisDel(key: string): void {
  execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning DEL ${key}`,
    { stdio: 'pipe' },
  );
}

/**
 * Flush all throttle keys — OAuth `/authorize` + `/handoff` are guarded by
 * `AuthThrottle` (plan §2.4). Back-to-back tests in this file would exhaust
 * the budget; clearing before each rate-limited describe keeps the run hermetic.
 */
function flushThrottleKeys(): void {
  execSync(
    `docker exec assixx-redis redis-cli -a '${REDIS_PASSWORD}' --no-auth-warning EVAL "local keys = redis.call('KEYS', 'throttle:*') for i, key in ipairs(keys) do redis.call('DEL', key) end return #keys" 0`,
    { stdio: 'pipe' },
  );
}

// ─── Handoff-token mint helper ───────────────────────────────────────────────

/**
 * Build a Redis-seeded handoff token for a given tenantId. Mirrors the exact
 * shape `OAuthHandoffService.mint()` stores (see `oauth-handoff.service.ts`).
 * Returns `{ token, key }` — caller is responsible for DEL if the consumer
 * fails (R15 invariant: preserved on host-mismatch) or for verifying DEL on
 * happy path.
 */
function seedHandoffToken(
  tenantId: number,
  userId: number,
): { token: string; key: string; accessToken: string; refreshToken: string } {
  const token = randomBytes(32).toString('hex');
  const key = `oauth:handoff:${token}`;
  // Distinct sentinel strings per seeding — `toBe()` asserts the exact bytes
  // round-tripped, not just "any string".
  const accessToken = `fake-access-${token.slice(0, 8)}`;
  const refreshToken = `fake-refresh-${token.slice(0, 8)}`;
  redisSet(
    key,
    JSON.stringify({ userId, tenantId, accessToken, refreshToken, createdAt: Date.now() }),
    60,
  );
  return { token, key, accessToken, refreshToken };
}

// ─── Auth (cached — one login for the whole suite, see helpers.ts) ───────────

let auth: AuthState;

beforeAll(async () => {
  auth = await loginApitest();
});

// ═════════════════════════════════════════════════════════════════════════════
// A. Cross-tenant JWT replay — JwtAuthGuard cross-check (ADR-050 §2.3)
// ═════════════════════════════════════════════════════════════════════════════

describe('A. Cross-tenant JWT replay — JwtAuthGuard cross-check', () => {
  describe('Control: matching subdomain host (apitest JWT + apitest host)', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        headers: { ...authOnly(auth.authToken), ...withTenantHost('assixx') },
      });
    });

    it('returns 200 (host matches JWT tenantId → cross-check passes)', () => {
      expect(res.status).toBe(200);
    });
  });

  describe('R2: JWT tenantId ≠ hostTenantId → 403 CROSS_TENANT_HOST_MISMATCH', () => {
    let res: Response;
    let body: JsonBody;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        headers: { ...authOnly(auth.authToken), ...withTenantHost(OTHER_TENANT_SUBDOMAIN) },
      });
      body = (await res.json()) as JsonBody;
    });

    it('returns 403 Forbidden', () => {
      expect(res.status).toBe(403);
    });

    it('surfaces the discriminable CROSS_TENANT_HOST_MISMATCH code (Loki-alertable)', () => {
      expect(body.error?.code).toBe('CROSS_TENANT_HOST_MISMATCH');
    });
  });

  describe('No X-Forwarded-Host (localhost / internal call) → cross-check skipped', () => {
    let res: Response;

    beforeAll(async () => {
      // No withTenantHost() — the Host header defaults to localhost:3000 →
      // extractSlug returns null → middleware sets hostTenantId=null → guard skips.
      res = await fetch(`${BASE_URL}/users`, {
        headers: authOnly(auth.authToken),
      });
    });

    it('returns 200 (hostTenantId=null → guard skip)', () => {
      expect(res.status).toBe(200);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// B. Apex / unknown-subdomain / nested-subdomain semantics
// ═════════════════════════════════════════════════════════════════════════════

describe('B. Apex & unknown-subdomain behaviour', () => {
  describe('Unknown subdomain (passes regex, no DB row) → hostTenantId=null', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        headers: { ...authOnly(auth.authToken), ...withTenantHost(UNKNOWN_SUBDOMAIN) },
      });
    });

    it('returns 200 — DB lookup miss is silent (R4 no-timing-leak design)', () => {
      expect(res.status).toBe(200);
    });
  });

  describe('Nested subdomain (a.b.assixx.com) → extractSlug rejects → null', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        headers: { ...authOnly(auth.authToken), 'X-Forwarded-Host': 'a.b.assixx.com' },
      });
    });

    it('returns 200 — anchored regex rejects nested subdomain (R11)', () => {
      expect(res.status).toBe(200);
    });
  });

  describe('Apex host + no JWT → 401 (not 403 — cross-check inapplicable)', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        headers: { 'X-Forwarded-Host': 'www.assixx.com' },
      });
    });

    it('returns 401 Unauthorized (no token) — apex is public-auth-surface', () => {
      expect(res.status).toBe(401);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// C. OAuth /authorize — returnToSlug propagation (ADR-050 §Step 2.5c)
// ═════════════════════════════════════════════════════════════════════════════

describe('C. OAuth /authorize — returnToSlug sources', () => {
  describe('Trusted source: X-Forwarded-Host → subdomain extracted', () => {
    let res: Response;

    beforeAll(async () => {
      flushThrottleKeys();
      res = await fetch(`${BASE_URL}/auth/oauth/microsoft/authorize?mode=login`, {
        redirect: 'manual',
        headers: withTenantHost('assixx'),
      });
    });

    it('returns 302 Found', () => {
      expect(res.status).toBe(302);
    });

    it('redirects to Microsoft authorize URL (slug round-trip in Redis state)', () => {
      expect(res.headers.get('location')).toContain(MS_AUTHORIZE_ORIGIN);
    });
  });

  describe('Fallback source: ?return_to_slug= query param (post-Nginx-307 case)', () => {
    let res: Response;

    beforeAll(async () => {
      flushThrottleKeys();
      res = await fetch(
        `${BASE_URL}/auth/oauth/microsoft/authorize?mode=login&return_to_slug=assixx`,
        { redirect: 'manual' },
      );
    });

    it('returns 302 Found (regex-validated fallback accepted)', () => {
      expect(res.status).toBe(302);
    });

    it('redirects to Microsoft authorize URL', () => {
      expect(res.headers.get('location')).toContain(MS_AUTHORIZE_ORIGIN);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// D. OAuth /handoff — R15 host-check BEFORE Redis DEL
// ═════════════════════════════════════════════════════════════════════════════

describe('D. OAuth /handoff endpoint', () => {
  describe('Malformed token (not 64 hex chars) → 400 VALIDATION_ERROR', () => {
    let res: Response;
    let body: JsonBody;

    beforeAll(async () => {
      flushThrottleKeys();
      res = await fetch(`${BASE_URL}/auth/oauth/handoff`, {
        method: 'POST',
        headers: { ...authHeaders(auth.authToken), ...withTenantHost('assixx') },
        body: JSON.stringify({ token: 'too-short' }),
      });
      body = (await res.json()) as JsonBody;
    });

    it('returns 400 (DTO regex rejects before any Redis hit — DoS-hardening)', () => {
      expect(res.status).toBe(400);
    });

    it('surfaces VALIDATION_ERROR code', () => {
      expect(body.error?.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Unknown valid-format token → 404 HANDOFF_TOKEN_INVALID', () => {
    let res: Response;
    let body: JsonBody;

    beforeAll(async () => {
      flushThrottleKeys();
      const token = randomBytes(32).toString('hex');
      res = await fetch(`${BASE_URL}/auth/oauth/handoff`, {
        method: 'POST',
        headers: { ...authHeaders(auth.authToken), ...withTenantHost('assixx') },
        body: JSON.stringify({ token }),
      });
      body = (await res.json()) as JsonBody;
    });

    it('returns 404 Not Found', () => {
      expect(res.status).toBe(404);
    });

    it('surfaces HANDOFF_TOKEN_INVALID code (distinct from HOST_MISMATCH)', () => {
      expect(body.error?.code).toBe('HANDOFF_TOKEN_INVALID');
    });
  });

  describe('R15: valid token + wrong host → 403 + token PRESERVED in Redis', () => {
    let res: Response;
    let body: JsonBody;
    let keyExistsAfter: boolean;
    let seededKey: string;

    beforeAll(async () => {
      flushThrottleKeys();
      // Seed a handoff payload for apitest (tenant 1 per fixtures).
      const seeded = seedHandoffToken(auth.tenantId, auth.userId);
      seededKey = seeded.key;

      // Submit from firma-b.assixx.com (tenant 3) — host ≠ payload.tenantId.
      res = await fetch(`${BASE_URL}/auth/oauth/handoff`, {
        method: 'POST',
        headers: { ...authHeaders(auth.authToken), ...withTenantHost(OTHER_TENANT_SUBDOMAIN) },
        body: JSON.stringify({ token: seeded.token }),
      });
      body = (await res.json()) as JsonBody;
      // R15 invariant: consume() must NOT DEL the key on host-mismatch —
      // legit user's in-flight OAuth must still be completable.
      keyExistsAfter = redisExists(seededKey);
    });

    afterAll(() => {
      // Clean up the preserved key so the suite is hermetic.
      redisDel(seededKey);
    });

    it('returns 403 Forbidden', () => {
      expect(res.status).toBe(403);
    });

    it('surfaces HANDOFF_HOST_MISMATCH (distinct from CROSS_TENANT_HOST_MISMATCH)', () => {
      expect(body.error?.code).toBe('HANDOFF_HOST_MISMATCH');
    });

    it('R15 invariant: token NOT consumed — legit user can still complete OAuth', () => {
      expect(keyExistsAfter).toBe(true);
    });
  });

  describe('Happy path: valid token + matching host → 200, token consumed', () => {
    let res: Response;
    let body: JsonBody;
    let keyExistsAfter: boolean;
    let seededAccessToken: string;
    let seededRefreshToken: string;

    beforeAll(async () => {
      flushThrottleKeys();
      const seeded = seedHandoffToken(auth.tenantId, auth.userId);
      seededAccessToken = seeded.accessToken;
      seededRefreshToken = seeded.refreshToken;

      res = await fetch(`${BASE_URL}/auth/oauth/handoff`, {
        method: 'POST',
        headers: { ...authHeaders(auth.authToken), ...withTenantHost('assixx') },
        body: JSON.stringify({ token: seeded.token }),
      });
      body = (await res.json()) as JsonBody;
      keyExistsAfter = redisExists(seeded.key);
    });

    it('returns 200 OK', () => {
      expect(res.status).toBe(200);
    });

    it('echoes accessToken from the Redis-stored payload (bit-for-bit round-trip)', () => {
      expect(body.data?.accessToken).toBe(seededAccessToken);
    });

    it('echoes refreshToken from the Redis-stored payload', () => {
      expect(body.data?.refreshToken).toBe(seededRefreshToken);
    });

    it('echoes tenantId from the payload (used by SvelteKit for cookie-set)', () => {
      expect(body.data?.tenantId).toBe(auth.tenantId);
    });

    it('single-use invariant: key DELETED after successful consume', () => {
      expect(keyExistsAfter).toBe(false);
    });
  });

  describe('Apex / missing-host context → 403 HANDOFF_HOST_MISMATCH', () => {
    let res: Response;
    let body: JsonBody;
    let keyExistsAfter: boolean;
    let seededKey: string;

    beforeAll(async () => {
      flushThrottleKeys();
      const seeded = seedHandoffToken(auth.tenantId, auth.userId);
      seededKey = seeded.key;
      // No withTenantHost() → Host: localhost → hostTenantId=null → service
      // explicitly rejects: "the subdomain origin is the ONLY valid consumer".
      res = await fetch(`${BASE_URL}/auth/oauth/handoff`, {
        method: 'POST',
        headers: authHeaders(auth.authToken),
        body: JSON.stringify({ token: seeded.token }),
      });
      body = (await res.json()) as JsonBody;
      keyExistsAfter = redisExists(seededKey);
    });

    afterAll(() => {
      redisDel(seededKey);
    });

    it('returns 403 Forbidden', () => {
      expect(res.status).toBe(403);
    });

    it('surfaces HANDOFF_HOST_MISMATCH (null host treated as mismatch)', () => {
      expect(body.error?.code).toBe('HANDOFF_HOST_MISMATCH');
    });

    it('token NOT consumed (R15 applies even on null host)', () => {
      expect(keyExistsAfter).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// E. CORS allowlist — the regex in main.ts IS the policy
// ═════════════════════════════════════════════════════════════════════════════

describe('E. CORS allowlist (main.ts isAllowedCorsOrigin)', () => {
  describe('Apex origin (https://www.assixx.com) → allowed', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://www.assixx.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization',
        },
      });
    });

    it('Access-Control-Allow-Origin reflects the request origin', () => {
      expect(res.headers.get('access-control-allow-origin')).toBe('https://www.assixx.com');
    });
  });

  describe('Subdomain origin (https://assixx.assixx.com) → allowed', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://assixx.assixx.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization',
        },
      });
    });

    it('Access-Control-Allow-Origin reflects the subdomain origin', () => {
      expect(res.headers.get('access-control-allow-origin')).toBe('https://assixx.assixx.com');
    });
  });

  describe('Foreign origin (https://evil.example.com) → rejected', () => {
    let res: Response;

    beforeAll(async () => {
      res = await fetch(`${BASE_URL}/users`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://evil.example.com',
          'Access-Control-Request-Method': 'GET',
          'Access-Control-Request-Headers': 'Authorization',
        },
      });
    });

    it('no Access-Control-Allow-Origin header set (browser will block)', () => {
      expect(res.headers.get('access-control-allow-origin')).toBeNull();
    });
  });
});
