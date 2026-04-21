/**
 * TenantHostResolverMiddleware — unit tests (ADR-050, masterplan Phase 3).
 *
 * Scope (plan §Phase 3, 5 cases expanded to 9 for branch coverage):
 *   1. Cache hit → uses cached value, no DB query, no SET.
 *   2. Cache miss + DB hit → DB queried, Redis SETEX(60), req.hostTenantId set.
 *   3. Cache miss + DB miss → hostTenantId = null, no SET (don't cache "unknown").
 *   4. Malformed / apex host → extractSlug=null → hostTenantId=null, short-circuit.
 *   5. No Host header (internal call) → hostTenantId=null, next() called.
 *   6. X-Forwarded-Host preferred over Host header.
 *   7. Redis failure → swallowed → hostTenantId=null, next() called (availability).
 *   8. DB failure → swallowed → hostTenantId=null, next() called.
 *   9. Three-state semantics: `undefined` before middleware, `null` / `number` after.
 *
 * Mock boundary:
 *   - ioredis via `{ get, set }` spies.
 *   - DatabaseService via `{ systemQuery }` spy.
 *   - FastifyRequest via a minimal object with `headers` — the middleware only
 *     reads `x-forwarded-host` + `host`.
 *
 * @see backend/src/nest/common/middleware/tenant-host-resolver.middleware.ts
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §R5/R13
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 3
 */
import { Logger } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../database/database.service.js';
import {
  type HostAwareRequest,
  TenantHostResolverMiddleware,
} from './tenant-host-resolver.middleware.js';

const CACHE_TTL = 60;
const TENANT_ID = 42;

function createMockRedis(): {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
} {
  return {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue('OK'),
  };
}

function createMockDb(): {
  systemQuery: ReturnType<typeof vi.fn>;
} {
  return {
    systemQuery: vi.fn(),
  };
}

function makeRequest(headers: Record<string, string | string[] | undefined> = {}): FastifyRequest {
  return {
    headers,
  } as unknown as FastifyRequest;
}

describe('TenantHostResolverMiddleware', () => {
  let middleware: TenantHostResolverMiddleware;
  let mockRedis: ReturnType<typeof createMockRedis>;
  let mockDb: ReturnType<typeof createMockDb>;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    mockDb = createMockDb();
    next = vi.fn();

    middleware = new TenantHostResolverMiddleware(
      mockRedis as unknown as Redis,
      mockDb as unknown as DatabaseService,
    );

    // Silence logger during tests — error paths log warn on every failure.
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  // ─── Cache hit ────────────────────────────────────────────────────────────

  describe('cache hit', () => {
    it('sets hostTenantId from cached value without DB query', async () => {
      mockRedis.get.mockResolvedValueOnce(String(TENANT_ID));
      const req = makeRequest({ 'x-forwarded-host': 'firma-a.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBe(TENANT_ID);
      expect(mockRedis.get).toHaveBeenCalledWith(`slug:firma-a`);
      expect(mockDb.systemQuery).not.toHaveBeenCalled();
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('treats non-numeric cache value as null (corrupt cache defence)', async () => {
      // A Redis value of e.g. "not-a-number" should NOT crash; the middleware
      // returns null (cross-check skipped) rather than propagating a NaN.
      mockRedis.get.mockResolvedValueOnce('not-a-number');
      const req = makeRequest({ 'x-forwarded-host': 'firma-a.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Cache miss, DB hit ───────────────────────────────────────────────────

  describe('cache miss + DB hit', () => {
    it('queries DB, caches with 60 s TTL, sets hostTenantId', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.systemQuery.mockResolvedValueOnce([{ id: TENANT_ID }]);
      const req = makeRequest({ 'x-forwarded-host': 'firma-a.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect(mockDb.systemQuery).toHaveBeenCalledWith(
        expect.stringContaining("FROM tenants WHERE subdomain = $1 AND deletion_status = 'active'"),
        ['firma-a'],
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        'slug:firma-a',
        String(TENANT_ID),
        'EX',
        CACHE_TTL,
      );
      expect((req as HostAwareRequest).hostTenantId).toBe(TENANT_ID);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Cache miss, DB miss (unknown slug) ──────────────────────────────────

  describe('cache miss + DB miss (unknown slug)', () => {
    it('sets hostTenantId=null and does NOT cache the miss', async () => {
      // Rationale (source comment): we don't cache negative results — a slug
      // that resolves after signup must not be shadowed by a stale null
      // cache entry. TTL is 0 effectively.
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.systemQuery.mockResolvedValueOnce([]);
      const req = makeRequest({ 'x-forwarded-host': 'phantom.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Apex / malformed / no-host — extractSlug returns null ────────────────

  describe('extractSlug() returns null (apex / localhost / unknown pattern)', () => {
    it('short-circuits to null for the apex `www.assixx.com` — no Redis, no DB', async () => {
      const req = makeRequest({ 'x-forwarded-host': 'www.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(mockDb.systemQuery).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('short-circuits to null for `localhost:3000` (dev / internal call)', async () => {
      // Internal Docker calls (cron, deletion-worker) hit backend directly.
      // extractSlug('localhost') → null keeps them out of the cross-check.
      const req = makeRequest({ host: 'localhost:3000' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('short-circuits to null for malformed Host header `a.b.assixx.com`', async () => {
      const req = makeRequest({ 'x-forwarded-host': 'a.b.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(mockRedis.get).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('short-circuits to null when neither X-Forwarded-Host nor Host header is present', async () => {
      const req = makeRequest({});

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // ─── X-Forwarded-Host priority + fallbacks ────────────────────────────────

  describe('host source priority', () => {
    it('prefers X-Forwarded-Host over the Host header (nginx-trusted source)', async () => {
      mockRedis.get.mockResolvedValueOnce(String(TENANT_ID));
      const req = makeRequest({
        'x-forwarded-host': 'firma-a.assixx.com',
        host: 'localhost:3000', // would short-circuit if it won priority
      });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBe(TENANT_ID);
      expect(mockRedis.get).toHaveBeenCalledWith('slug:firma-a');
    });

    it('falls back to the Host header when X-Forwarded-Host is absent', async () => {
      mockRedis.get.mockResolvedValueOnce(String(TENANT_ID));
      const req = makeRequest({ host: 'firma-a.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBe(TENANT_ID);
    });

    it('handles X-Forwarded-Host as an array (multi-hop proxies)', async () => {
      mockRedis.get.mockResolvedValueOnce(String(TENANT_ID));
      const req = makeRequest({ 'x-forwarded-host': ['firma-a.assixx.com', 'other'] });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBe(TENANT_ID);
    });
  });

  // ─── Error policy: availability over strict correctness ───────────────────

  describe('error policy — Redis/DB failure', () => {
    it('swallows a Redis GET failure → hostTenantId=null, next() still called', async () => {
      mockRedis.get.mockRejectedValueOnce(new Error('redis connection lost'));
      const req = makeRequest({ 'x-forwarded-host': 'firma-a.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('swallows a DB failure → hostTenantId=null, next() still called', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      mockDb.systemQuery.mockRejectedValueOnce(new Error('pool exhausted'));
      const req = makeRequest({ 'x-forwarded-host': 'firma-a.assixx.com' });

      await middleware.use(req, {} as FastifyReply, next);

      expect((req as HostAwareRequest).hostTenantId).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
