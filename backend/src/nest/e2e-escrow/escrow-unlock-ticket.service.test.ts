/**
 * Unit tests for EscrowUnlockTicketService
 *
 * Mocked dependency: ioredis (`set`, `getdel`).
 * Tests both ticket variants (unlock + bootstrap), replay defense
 * (userId/tenantId mismatch), and malformed-payload type-guard rejection.
 *
 * @see ADR-022 (E2E Key Escrow)
 * @see ADR-022 §Amendment 2026-04-22 (cross-origin unlock handoff)
 * @see ADR-022 §Amendment 2026-04-25 (bootstrap variant)
 * @see ADR-018 (Testing Strategy — Tier 1 unit tests)
 */
import { UnauthorizedException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EscrowUnlockTicketService } from './escrow-unlock-ticket.service.js';

// =============================================================
// Mock Factories
// =============================================================

function createMockRedis() {
  return {
    set: vi.fn(),
    getdel: vi.fn(),
  };
}
type MockRedis = ReturnType<typeof createMockRedis>;

// Stable test fixtures
const VALID_WRAPPING_KEY = Buffer.alloc(32, 0xab).toString('base64');
const VALID_SALT = Buffer.alloc(32, 0xcd).toString('base64');
const VALID_PARAMS = { memory: 65536, iterations: 3, parallelism: 1 };
const USER_ID = 42;
const TENANT_ID = 1;
const SAMPLE_TICKET_ID = '019dc5b0-5488-749c-b322-61bb78d02e12';

// =============================================================
// Test Suite
// =============================================================

describe('EscrowUnlockTicketService', () => {
  let service: EscrowUnlockTicketService;
  let mockRedis: MockRedis;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    service = new EscrowUnlockTicketService(mockRedis as unknown as Redis);
  });

  // -----------------------------------------------------------
  // create()
  // -----------------------------------------------------------

  describe('create()', () => {
    describe('unlock variant (no bootstrap)', () => {
      it('should return a UUIDv7-shaped ticket ID', async () => {
        mockRedis.set.mockResolvedValueOnce('OK');
        const ticketId = await service.create(USER_ID, TENANT_ID, VALID_WRAPPING_KEY);

        // UUID format: 8-4-4-4-12 hex chars
        expect(ticketId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      });

      it('should call Redis.set with `unlock:` prefix and 60s TTL', async () => {
        mockRedis.set.mockResolvedValueOnce('OK');
        await service.create(USER_ID, TENANT_ID, VALID_WRAPPING_KEY);

        expect(mockRedis.set).toHaveBeenCalledOnce();
        const call = mockRedis.set.mock.calls[0];
        expect(call).toBeDefined();
        const [key, , ex, ttl] = call as unknown as [string, string, string, number];
        expect(key.startsWith('unlock:')).toBe(true);
        expect(ex).toBe('EX');
        expect(ttl).toBe(60);
      });

      it('should NOT include bootstrap field in payload', async () => {
        mockRedis.set.mockResolvedValueOnce('OK');
        await service.create(USER_ID, TENANT_ID, VALID_WRAPPING_KEY);

        const call = mockRedis.set.mock.calls[0];
        expect(call).toBeDefined();
        const value = (call as unknown as [string, string])[1];
        const payload = JSON.parse(value) as Record<string, unknown>;
        expect(payload).not.toHaveProperty('bootstrap');
        expect(payload['wrappingKey']).toBe(VALID_WRAPPING_KEY);
        expect(payload['userId']).toBe(USER_ID);
        expect(payload['tenantId']).toBe(TENANT_ID);
        expect(typeof payload['createdAt']).toBe('number');
      });
    });

    describe('bootstrap variant', () => {
      it('should include bootstrap field with salt + params in payload', async () => {
        mockRedis.set.mockResolvedValueOnce('OK');
        await service.create(USER_ID, TENANT_ID, VALID_WRAPPING_KEY, {
          argon2Salt: VALID_SALT,
          argon2Params: VALID_PARAMS,
        });

        const call = mockRedis.set.mock.calls[0];
        expect(call).toBeDefined();
        const value = (call as unknown as [string, string])[1];
        const payload = JSON.parse(value) as Record<string, unknown>;
        expect(payload).toHaveProperty('bootstrap');
        expect(payload['bootstrap']).toEqual({
          argon2Salt: VALID_SALT,
          argon2Params: VALID_PARAMS,
        });
      });

      it('should still return a UUIDv7-shaped ticket ID', async () => {
        mockRedis.set.mockResolvedValueOnce('OK');
        const ticketId = await service.create(USER_ID, TENANT_ID, VALID_WRAPPING_KEY, {
          argon2Salt: VALID_SALT,
          argon2Params: VALID_PARAMS,
        });
        expect(ticketId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      });

      it('should still use 60s TTL on bootstrap variant', async () => {
        mockRedis.set.mockResolvedValueOnce('OK');
        await service.create(USER_ID, TENANT_ID, VALID_WRAPPING_KEY, {
          argon2Salt: VALID_SALT,
          argon2Params: VALID_PARAMS,
        });
        const call = mockRedis.set.mock.calls[0];
        expect(call).toBeDefined();
        const [, , ex, ttl] = call as unknown as [string, string, string, number];
        expect(ex).toBe('EX');
        expect(ttl).toBe(60);
      });
    });
  });

  // -----------------------------------------------------------
  // consume()
  // -----------------------------------------------------------

  describe('consume()', () => {
    /** Build a serialized unlock-ticket payload with optional overrides. */
    function unlockPayload(overrides: Record<string, unknown> = {}): string {
      return JSON.stringify({
        wrappingKey: VALID_WRAPPING_KEY,
        userId: USER_ID,
        tenantId: TENANT_ID,
        createdAt: Date.now(),
        ...overrides,
      });
    }

    /** Build a serialized bootstrap-ticket payload with optional overrides. */
    function bootstrapPayload(overrides: Record<string, unknown> = {}): string {
      return JSON.stringify({
        wrappingKey: VALID_WRAPPING_KEY,
        userId: USER_ID,
        tenantId: TENANT_ID,
        createdAt: Date.now(),
        bootstrap: { argon2Salt: VALID_SALT, argon2Params: VALID_PARAMS },
        ...overrides,
      });
    }

    // ---------- unlock ticket ----------

    describe('unlock ticket', () => {
      it('should return wrappingKey without bootstrap', async () => {
        mockRedis.getdel.mockResolvedValueOnce(unlockPayload());
        const result = await service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID);

        expect(result.wrappingKey).toBe(VALID_WRAPPING_KEY);
        expect(result.bootstrap).toBeUndefined();
      });

      it('should call Redis.getdel exactly once with the prefixed key', async () => {
        mockRedis.getdel.mockResolvedValueOnce(unlockPayload());
        await service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID);

        expect(mockRedis.getdel).toHaveBeenCalledExactlyOnceWith(`unlock:${SAMPLE_TICKET_ID}`);
      });
    });

    // ---------- bootstrap ticket ----------

    describe('bootstrap ticket', () => {
      it('should return wrappingKey + bootstrap fields', async () => {
        mockRedis.getdel.mockResolvedValueOnce(bootstrapPayload());
        const result = await service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID);

        expect(result.wrappingKey).toBe(VALID_WRAPPING_KEY);
        expect(result.bootstrap).toEqual({
          argon2Salt: VALID_SALT,
          argon2Params: VALID_PARAMS,
        });
      });
    });

    // ---------- replay defense ----------

    describe('replay defense', () => {
      it('should throw UnauthorizedException when ticket not found (Redis returns null)', async () => {
        mockRedis.getdel.mockResolvedValueOnce(null);
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException on userId mismatch', async () => {
        mockRedis.getdel.mockResolvedValueOnce(unlockPayload({ userId: 999 }));
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw UnauthorizedException on tenantId mismatch', async () => {
        mockRedis.getdel.mockResolvedValueOnce(unlockPayload({ tenantId: 999 }));
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });

    // ---------- malformed payloads ----------

    describe('malformed payloads', () => {
      it('should throw on invalid JSON', async () => {
        mockRedis.getdel.mockResolvedValueOnce('not-json{');
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw when wrappingKey is missing', async () => {
        mockRedis.getdel.mockResolvedValueOnce(
          JSON.stringify({ userId: USER_ID, tenantId: TENANT_ID, createdAt: Date.now() }),
        );
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw when payload is null', async () => {
        mockRedis.getdel.mockResolvedValueOnce(JSON.stringify(null));
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw when bootstrap.argon2Salt is missing', async () => {
        mockRedis.getdel.mockResolvedValueOnce(
          unlockPayload({ bootstrap: { argon2Params: VALID_PARAMS } }),
        );
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw when bootstrap.argon2Params is missing', async () => {
        mockRedis.getdel.mockResolvedValueOnce(
          unlockPayload({ bootstrap: { argon2Salt: VALID_SALT } }),
        );
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw when bootstrap.argon2Params is missing memory', async () => {
        mockRedis.getdel.mockResolvedValueOnce(
          unlockPayload({
            bootstrap: {
              argon2Salt: VALID_SALT,
              argon2Params: { iterations: 3, parallelism: 1 },
            },
          }),
        );
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });

      it('should throw when bootstrap is non-object (string)', async () => {
        mockRedis.getdel.mockResolvedValueOnce(unlockPayload({ bootstrap: 'invalid' }));
        await expect(service.consume(SAMPLE_TICKET_ID, USER_ID, TENANT_ID)).rejects.toThrow(
          UnauthorizedException,
        );
      });
    });
  });
});
