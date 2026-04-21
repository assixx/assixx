/**
 * OAuthHandoffService — unit tests (ADR-050 §OAuth, masterplan Phase 3).
 *
 * Scope:
 *   - mint() stores payload with 60 s TTL and returns a 64-hex-char opaque token.
 *   - consume() performs R15 order: `redis.get` → host-check → `redis.del`.
 *     • Valid token + matching host     → payload returned + single-use DEL.
 *     • Unknown/expired token           → NotFoundException HANDOFF_TOKEN_INVALID, no DEL.
 *     • Valid token + host mismatch     → ForbiddenException HANDOFF_HOST_MISMATCH, NO DEL
 *                                         (legitimate user's token is NOT burned by an
 *                                          attacker who intercepted the redirect).
 *     • Valid token + null host         → same as mismatch (apex / localhost cannot
 *                                          complete a handoff).
 *     • Malformed JSON / type-guard     → NotFoundException HANDOFF_TOKEN_INVALID.
 *
 * Mock boundary: ioredis is substituted by a plain object with `set`/`get`/`del`
 * spies — identical shape to `oauth-state.service.test.ts` for consistency.
 *
 * @see backend/src/nest/auth/oauth/oauth-handoff.service.ts
 * @see docs/infrastructure/adr/ADR-050-tenant-subdomain-routing.md §R15
 * @see docs/FEAT_TENANT_SUBDOMAIN_ROUTING_MASTERPLAN.md Phase 3
 */
import { ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthHandoffService } from './oauth-handoff.service.js';
import type { OAuthHandoffPayload } from './oauth.types.js';

const HANDOFF_TTL = 60;
const TENANT_ID = 42;
const OTHER_TENANT_ID = 999;

function createMockRedis(): {
  set: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
} {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
  };
}

function validPayload(overrides?: Partial<OAuthHandoffPayload>): OAuthHandoffPayload {
  return {
    userId: 1,
    tenantId: TENANT_ID,
    accessToken: 'access-abc',
    refreshToken: 'refresh-xyz',
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

describe('OAuthHandoffService', () => {
  let service: OAuthHandoffService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    service = new OAuthHandoffService(mockRedis as unknown as Redis);

    // Silence the logger's warn-on-malformed-JSON output during tests.
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  // ─── mint() ───────────────────────────────────────────────────────────────

  describe('mint()', () => {
    it('returns a 64-hex-char opaque token (32 random bytes → hex)', async () => {
      const token = await service.mint({
        userId: 1,
        tenantId: TENANT_ID,
        accessToken: 'a',
        refreshToken: 'r',
      });
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('stores the payload at key `handoff:{token}` with 60-second TTL', async () => {
      const token = await service.mint({
        userId: 1,
        tenantId: TENANT_ID,
        accessToken: 'a',
        refreshToken: 'r',
      });
      expect(mockRedis.set).toHaveBeenCalledWith(
        `handoff:${token}`,
        expect.any(String),
        'EX',
        HANDOFF_TTL,
      );
    });

    it('serialises userId + tenantId + tokens + createdAt into the JSON payload', async () => {
      const before = Date.now();
      await service.mint({
        userId: 7,
        tenantId: TENANT_ID,
        accessToken: 'access-abc',
        refreshToken: 'refresh-xyz',
      });
      const after = Date.now();

      const storedJson = mockRedis.set.mock.calls[0]?.[1] as string;
      const payload = JSON.parse(storedJson) as OAuthHandoffPayload;

      expect(payload.userId).toBe(7);
      expect(payload.tenantId).toBe(TENANT_ID);
      expect(payload.accessToken).toBe('access-abc');
      expect(payload.refreshToken).toBe('refresh-xyz');
      expect(payload.createdAt).toBeGreaterThanOrEqual(before);
      expect(payload.createdAt).toBeLessThanOrEqual(after);
    });

    it('mints unique tokens across consecutive calls (not a fixed constant)', async () => {
      const t1 = await service.mint({
        userId: 1,
        tenantId: TENANT_ID,
        accessToken: 'a',
        refreshToken: 'r',
      });
      const t2 = await service.mint({
        userId: 1,
        tenantId: TENANT_ID,
        accessToken: 'a',
        refreshToken: 'r',
      });
      expect(t1).not.toBe(t2);
    });
  });

  // ─── consume() happy path ────────────────────────────────────────────────

  describe('consume() — valid token + matching host', () => {
    it('returns the parsed payload on match', async () => {
      const payload = validPayload();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(payload));

      const result = await service.consume('tok-abc', TENANT_ID);

      expect(result).toEqual(payload);
    });

    it('performs R15 order: redis.get called before redis.del', async () => {
      const payload = validPayload();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await service.consume('tok-abc', TENANT_ID);

      // Both called exactly once and in order.
      expect(mockRedis.get).toHaveBeenCalledWith('handoff:tok-abc');
      expect(mockRedis.del).toHaveBeenCalledWith('handoff:tok-abc');
      const getOrder = mockRedis.get.mock.invocationCallOrder[0] ?? 0;
      const delOrder = mockRedis.del.mock.invocationCallOrder[0] ?? 0;
      expect(getOrder).toBeLessThan(delOrder);
    });
  });

  // ─── consume() — unknown / expired (no token in Redis) ───────────────────

  describe('consume() — unknown / expired token', () => {
    it('throws NotFoundException with code HANDOFF_TOKEN_INVALID when Redis has no key', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      await expect(service.consume('missing-tok', TENANT_ID)).rejects.toThrow(NotFoundException);
    });

    it('does NOT call redis.del when the token is unknown', async () => {
      mockRedis.get.mockResolvedValueOnce(null);
      await expect(service.consume('missing-tok', TENANT_ID)).rejects.toBeDefined();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('surfaces the HANDOFF_TOKEN_INVALID error code in the exception body', async () => {
      mockRedis.get.mockResolvedValueOnce(null);

      // `.catch(e => e)` + outer assertions avoids `vitest/no-conditional-expect`
      // while still letting us inspect the error-code payload (which
      // `.rejects.toThrow()` alone cannot do).
      const err = await service.consume('missing-tok', TENANT_ID).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(NotFoundException);
      const response = (err as NotFoundException).getResponse() as { code: string };
      expect(response.code).toBe('HANDOFF_TOKEN_INVALID');
    });
  });

  // ─── consume() — host mismatch (R15: token NOT burned) ───────────────────

  describe('consume() — host mismatch (R15 DoS-resistance)', () => {
    it('throws ForbiddenException with code HANDOFF_HOST_MISMATCH on tenant mismatch', async () => {
      const payload = validPayload({ tenantId: TENANT_ID });
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(service.consume('tok-abc', OTHER_TENANT_ID)).rejects.toThrow(ForbiddenException);
    });

    it('does NOT call redis.del on host mismatch — legit user keeps the token', async () => {
      // R15 rationale: an attacker who intercepts the 302 and replays it to
      // the WRONG subdomain must not be able to burn the legit user's
      // token. Check happens BEFORE del.
      const payload = validPayload({ tenantId: TENANT_ID });
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(service.consume('tok-abc', OTHER_TENANT_ID)).rejects.toBeDefined();

      expect(mockRedis.get).toHaveBeenCalledWith('handoff:tok-abc');
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when hostTenantId is null (apex / localhost)', async () => {
      // Apex/localhost requests have hostTenantId=null after
      // TenantHostResolverMiddleware. A handoff by design lives on a real
      // subdomain, so null is treated as mismatch.
      const payload = validPayload();
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(payload));

      await expect(service.consume('tok-abc', null)).rejects.toThrow(ForbiddenException);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('surfaces the HANDOFF_HOST_MISMATCH error code in the exception body', async () => {
      const payload = validPayload({ tenantId: TENANT_ID });
      mockRedis.get.mockResolvedValueOnce(JSON.stringify(payload));

      const err = await service.consume('tok-abc', OTHER_TENANT_ID).catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ForbiddenException);
      const response = (err as ForbiddenException).getResponse() as { code: string };
      expect(response.code).toBe('HANDOFF_HOST_MISMATCH');
    });
  });

  // ─── consume() — tamper-resistance ───────────────────────────────────────

  describe('consume() — malformed payload', () => {
    it('throws NotFoundException HANDOFF_TOKEN_INVALID on malformed JSON', async () => {
      mockRedis.get.mockResolvedValueOnce('{not valid json');
      await expect(service.consume('tok-abc', TENANT_ID)).rejects.toThrow(NotFoundException);
      // No del, because malformed payload short-circuits BEFORE host-check.
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('throws NotFoundException HANDOFF_TOKEN_INVALID when payload shape is wrong', async () => {
      // type-guard rejects missing required fields (no userId, no tokens).
      mockRedis.get.mockResolvedValueOnce(JSON.stringify({ tenantId: TENANT_ID, foo: 'bar' }));
      await expect(service.consume('tok-abc', TENANT_ID)).rejects.toThrow(NotFoundException);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a required field has wrong type', async () => {
      mockRedis.get.mockResolvedValueOnce(
        JSON.stringify({
          userId: 'not-a-number', // violates typeof userId === 'number'
          tenantId: TENANT_ID,
          accessToken: 'a',
          refreshToken: 'r',
          createdAt: 1,
        }),
      );
      await expect(service.consume('tok-abc', TENANT_ID)).rejects.toThrow(NotFoundException);
      expect(mockRedis.del).not.toHaveBeenCalled();
    });
  });

  // ─── consume() — round-trip with freshly-minted token ────────────────────

  describe('mint() + consume() round-trip', () => {
    it('consume(mint()) returns the exact payload that was minted', async () => {
      // This proves the pair is self-consistent — sufficient assertion
      // that the serialisation format round-trips without drift.
      const minted = await service.mint({
        userId: 13,
        tenantId: TENANT_ID,
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
      });
      const storedJson = mockRedis.set.mock.calls[0]?.[1] as string;
      mockRedis.get.mockResolvedValueOnce(storedJson);

      const result = await service.consume(minted, TENANT_ID);

      expect(result.userId).toBe(13);
      expect(result.tenantId).toBe(TENANT_ID);
      expect(result.accessToken).toBe('access-token-value');
      expect(result.refreshToken).toBe('refresh-token-value');
      expect(typeof result.createdAt).toBe('number');
    });
  });
});
