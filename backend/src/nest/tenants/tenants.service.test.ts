/**
 * TenantsService unit tests.
 *
 * Covers the cache-through branding lookup:
 *   - Cache hit → no DB query, parsed payload returned.
 *   - Cache miss + DB hit → DB queried, Redis SETEX with 5-min TTL, payload returned.
 *   - Cache miss + DB miss → null-brand sentinel, NO cache write (avoids shadowing
 *     a post-signup tenant).
 *   - Redis outage → null-brand sentinel (fail-soft).
 *   - Malformed cache entry → treated as miss, DB fallback kicks in.
 *
 * Mirrors the `oauth-state.service.test.ts` pattern: plain mocks for Redis
 * (set/get/del spies) + a DatabaseService stub, no Redis container required.
 *
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 5 Step 5.3
 */
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { TenantsService } from './tenants.service.js';

interface BrandingRow {
  company_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
}

interface RedisMock {
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
}

interface DbMock {
  systemQuery: ReturnType<typeof vi.fn>;
}

const FIVE_MINUTES_SECONDS = 300;

describe('TenantsService', () => {
  let redis: RedisMock;
  let db: DbMock;
  let service: TenantsService;

  beforeEach(() => {
    redis = {
      get: vi.fn<(key: string) => Promise<string | null>>(),
      set: vi.fn<(key: string, value: string, mode: string, ttl: number) => Promise<'OK'>>(),
    };
    db = {
      systemQuery: vi.fn<(sql: string, params: unknown[]) => Promise<BrandingRow[]>>(),
    };
    service = new TenantsService(redis as unknown as Redis, db as unknown as DatabaseService);
  });

  describe('cache hit', () => {
    it('returns cached branding without touching the DB', async () => {
      redis.get.mockResolvedValueOnce(
        JSON.stringify({
          name: 'Firma A GmbH',
          logoUrl: 'https://cdn.example.com/firma-a.png',
          primaryColor: '#ff0066',
        }),
      );

      const result = await service.getBranding('firma-a');

      expect(result).toEqual({
        name: 'Firma A GmbH',
        logoUrl: 'https://cdn.example.com/firma-a.png',
        primaryColor: '#ff0066',
      });
      expect(redis.get).toHaveBeenCalledWith('firma-a');
      expect(db.systemQuery).not.toHaveBeenCalled();
      expect(redis.set).not.toHaveBeenCalled();
    });

    it('treats a malformed cache entry as a miss', async () => {
      redis.get.mockResolvedValueOnce('{not json{{');
      db.systemQuery.mockResolvedValueOnce([
        { company_name: 'Firma B', logo_url: null, primary_color: '#111111' },
      ]);
      redis.set.mockResolvedValueOnce('OK');

      const result = await service.getBranding('firma-b');

      expect(result).toEqual({ name: 'Firma B', logoUrl: null, primaryColor: '#111111' });
      expect(db.systemQuery).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
    });
  });

  describe('cache miss + DB hit', () => {
    it('queries DB, writes Redis with 5-min TTL, returns fresh branding', async () => {
      redis.get.mockResolvedValueOnce(null);
      db.systemQuery.mockResolvedValueOnce([
        {
          company_name: 'ApiTest Corp',
          logo_url: 'https://cdn.example.com/apitest.svg',
          primary_color: '#0066cc',
        },
      ]);
      redis.set.mockResolvedValueOnce('OK');

      const result = await service.getBranding('apitest');

      expect(result).toEqual({
        name: 'ApiTest Corp',
        logoUrl: 'https://cdn.example.com/apitest.svg',
        primaryColor: '#0066cc',
      });
      expect(db.systemQuery).toHaveBeenCalledWith(expect.stringContaining('FROM tenants'), [
        'apitest',
      ]);
      expect(redis.set).toHaveBeenCalledWith(
        'apitest',
        expect.any(String),
        'EX',
        FIVE_MINUTES_SECONDS,
      );
    });
  });

  describe('cache miss + DB miss', () => {
    it('returns null-brand and does NOT write Redis (unknown tenants stay uncached)', async () => {
      redis.get.mockResolvedValueOnce(null);
      db.systemQuery.mockResolvedValueOnce([]);

      const result = await service.getBranding('nonexistent');

      expect(result).toEqual({ name: null, logoUrl: null, primaryColor: null });
      // No negative caching — if the tenant gets created mid-session, a
      // subsequent login attempt must see it without waiting for the 5-min
      // TTL to expire.
      expect(redis.set).not.toHaveBeenCalled();
    });
  });

  describe('error handling (fail-soft)', () => {
    it('returns null-brand when Redis GET throws', async () => {
      redis.get.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await service.getBranding('firma-a');

      expect(result).toEqual({ name: null, logoUrl: null, primaryColor: null });
    });

    it('returns null-brand when DB systemQuery throws', async () => {
      redis.get.mockResolvedValueOnce(null);
      db.systemQuery.mockRejectedValueOnce(new Error('DB down'));

      const result = await service.getBranding('firma-a');

      expect(result).toEqual({ name: null, logoUrl: null, primaryColor: null });
    });
  });
});
