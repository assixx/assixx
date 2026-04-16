/**
 * OAuthStateService — unit tests.
 *
 * Scope (plan §3):
 *   - create() stores payload with 600 s TTL and returns a UUIDv7 state
 *   - consume() GETDELs atomically, returns parsed payload on first call
 *   - consume() throws UnauthorizedException on unknown / expired / malformed /
 *     tampered payloads (single-use semantic + type-guard)
 *
 * The service is pure DI around an ioredis client. We mock ioredis via a
 * plain object with `set` and `getdel` spies — no Redis container needed.
 */
import { UnauthorizedException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthStateService } from './oauth-state.service.js';
import type { OAuthState } from './oauth.types.js';

// Mock uuidv7 so the state IDs returned by create() are deterministic in assertions.
vi.mock('uuid', () => ({
  v7: vi.fn(() => '019d9707-1896-74fd-821e-2a2d1bd41660'),
}));

const FIXED_UUID = '019d9707-1896-74fd-821e-2a2d1bd41660';
const STATE_TTL = 600;

function createMockRedis(): {
  set: ReturnType<typeof vi.fn>;
  getdel: ReturnType<typeof vi.fn>;
} {
  return {
    set: vi.fn().mockResolvedValue('OK'),
    getdel: vi.fn(),
  };
}

describe('OAuthStateService', () => {
  let service: OAuthStateService;
  let mockRedis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis = createMockRedis();
    service = new OAuthStateService(mockRedis as unknown as Redis);
  });

  // ─── create() ────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('returns the UUIDv7 produced by the uuid library', async () => {
      const state = await service.create('login', 'verifier-abc');
      expect(state).toBe(FIXED_UUID);
    });

    it('stores the payload at key `state:{uuid}` with 600-second TTL', async () => {
      await service.create('login', 'verifier-abc');
      expect(mockRedis.set).toHaveBeenCalledWith(
        `state:${FIXED_UUID}`,
        expect.any(String),
        'EX',
        STATE_TTL,
      );
    });

    it('serialises mode + codeVerifier + createdAt into the JSON payload', async () => {
      const before = Date.now();
      await service.create('signup', 'verifier-xyz');
      const after = Date.now();
      const storedJson = mockRedis.set.mock.calls[0]?.[1] as string;
      const payload = JSON.parse(storedJson) as OAuthState;

      expect(payload.mode).toBe('signup');
      expect(payload.codeVerifier).toBe('verifier-xyz');
      expect(payload.createdAt).toBeGreaterThanOrEqual(before);
      expect(payload.createdAt).toBeLessThanOrEqual(after);
    });

    it.each(['login', 'signup'] as const)(
      'accepts mode "%s" and round-trips it into the payload',
      async (mode) => {
        await service.create(mode, 'any-verifier');
        const payload = JSON.parse(mockRedis.set.mock.calls[0]?.[1] as string) as OAuthState;
        expect(payload.mode).toBe(mode);
      },
    );
  });

  // ─── consume() ───────────────────────────────────────────────────────────

  describe('consume()', () => {
    it('returns the parsed payload when Redis has it (first call)', async () => {
      const payload: OAuthState = {
        mode: 'login',
        codeVerifier: 'verifier-abc',
        createdAt: 1700000000000,
      };
      mockRedis.getdel.mockResolvedValueOnce(JSON.stringify(payload));

      const result = await service.consume(FIXED_UUID);

      expect(result).toEqual(payload);
      expect(mockRedis.getdel).toHaveBeenCalledWith(`state:${FIXED_UUID}`);
    });

    it('throws UnauthorizedException when the key is unknown or already expired (null)', async () => {
      mockRedis.getdel.mockResolvedValueOnce(null);
      await expect(service.consume(FIXED_UUID)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on second consume — GETDEL returned null (single-use R2)', async () => {
      const payload: OAuthState = {
        mode: 'login',
        codeVerifier: 'verifier-abc',
        createdAt: 1700000000000,
      };
      mockRedis.getdel.mockResolvedValueOnce(JSON.stringify(payload)).mockResolvedValueOnce(null);

      await service.consume(FIXED_UUID);
      await expect(service.consume(FIXED_UUID)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on malformed JSON payload', async () => {
      mockRedis.getdel.mockResolvedValueOnce('{not valid json');
      await expect(service.consume(FIXED_UUID)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on type-mismatched payload (tampered shape)', async () => {
      mockRedis.getdel.mockResolvedValueOnce(JSON.stringify({ mode: 'invalid', foo: 1 }));
      await expect(service.consume(FIXED_UUID)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException on payload with wrong field types', async () => {
      mockRedis.getdel.mockResolvedValueOnce(
        JSON.stringify({ mode: 'login', codeVerifier: 123, createdAt: 'not-a-number' }),
      );
      await expect(service.consume(FIXED_UUID)).rejects.toThrow(UnauthorizedException);
    });
  });
});
