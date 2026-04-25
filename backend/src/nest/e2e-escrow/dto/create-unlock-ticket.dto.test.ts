/**
 * Zod Schema Validation Tests for CreateEscrowUnlockTicketDto
 *
 * Two ticket variants (discriminated by optional bootstrap fields):
 *   1. **Unlock**: `{ wrappingKey }` only — escrow already exists.
 *   2. **Bootstrap**: `{ wrappingKey, argon2Salt, argon2Params }` — first
 *      escrow, ADR-022 §"New-user scenario" (resolved 2026-04-25).
 *
 * Cross-field refine guarantees `argon2Salt + argon2Params` are set together
 * or both omitted — a half-bootstrap payload is rejected.
 *
 * @see ADR-022 (E2E Key Escrow)
 * @see ADR-018 (Testing Strategy — Tier 1 unit tests)
 */
import { describe, expect, it } from 'vitest';

import { CreateEscrowUnlockTicketSchema } from './create-unlock-ticket.dto.js';

// =============================================================
// Helpers
// =============================================================

/** Generate a valid base64 string of exactly N bytes. */
function base64OfBytes(n: number): string {
  return Buffer.alloc(n, 0xab).toString('base64');
}

/** Valid 32-byte base64 wrapping key (44 chars with padding). */
const VALID_WRAPPING_KEY = base64OfBytes(32);

/** Valid 32-byte base64 Argon2 salt. */
const VALID_SALT = base64OfBytes(32);

/** Default Argon2id params (matches Worker default). */
const VALID_PARAMS = { memory: 65536, iterations: 3, parallelism: 1 };

// =============================================================
// Tests
// =============================================================

describe('CreateEscrowUnlockTicketSchema', () => {
  // -----------------------------------------------------------
  // Variant 1: Unlock (escrow exists, no bootstrap fields)
  // -----------------------------------------------------------

  describe('unlock variant (no bootstrap fields)', () => {
    it('should accept payload with only wrappingKey', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
      });
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // Variant 2: Bootstrap (no escrow yet, salt + params present)
  // -----------------------------------------------------------

  describe('bootstrap variant (all fields present)', () => {
    it('should accept payload with wrappingKey + salt + params', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: VALID_PARAMS,
      });
      expect(result.success).toBe(true);
    });

    it('should accept boundary minimum Argon2 params', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 16384, iterations: 1, parallelism: 1 },
      });
      expect(result.success).toBe(true);
    });

    it('should accept boundary maximum Argon2 params', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 1048576, iterations: 100, parallelism: 16 },
      });
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // Cross-field refine: argon2Salt + argon2Params both-or-neither
  // -----------------------------------------------------------

  describe('cross-field refine (both-or-neither)', () => {
    it('should reject argon2Salt without argon2Params', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
      });
      expect(result.success).toBe(false);
    });

    it('should reject argon2Params without argon2Salt', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Params: VALID_PARAMS,
      });
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // wrappingKey validation
  // -----------------------------------------------------------

  describe('wrappingKey', () => {
    it('should reject missing wrappingKey', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty string', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({ wrappingKey: '' });
      expect(result.success).toBe(false);
    });

    it('should reject too short for 32 bytes', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: base64OfBytes(16),
      });
      expect(result.success).toBe(false);
    });

    it('should reject too long for 32 bytes', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: base64OfBytes(64),
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid base64 with correct length', () => {
      // 44 chars but contains chars outside base64 alphabet — refine catches.
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: '!!!not-valid-base64-but-44-characters-long!!',
      });
      expect(result.success).toBe(false);
    });

    it('should accept exactly 32-byte base64', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
      });
      expect(result.success).toBe(true);
    });

    it('should trim whitespace before validation', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: `  ${VALID_WRAPPING_KEY}  `,
      });
      expect(result.success).toBe(true);
      // Type assertion (not conditional) — we just asserted success above.
      // Keeps the parsed value check unconditional for vitest/no-conditional-expect.
      expect((result as { success: true; data: { wrappingKey: string } }).data.wrappingKey).toBe(
        VALID_WRAPPING_KEY,
      );
    });
  });

  // -----------------------------------------------------------
  // argon2Salt validation (only triggers when present)
  // -----------------------------------------------------------

  describe('argon2Salt (when present)', () => {
    it('should reject non-32-byte base64', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: base64OfBytes(16),
        argon2Params: VALID_PARAMS,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid base64', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: '!!!not-valid-base64-but-44-characters-long!!',
        argon2Params: VALID_PARAMS,
      });
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // argon2Params validation (only triggers when present)
  // -----------------------------------------------------------

  describe('argon2Params (when present)', () => {
    it('should reject memory below 16384', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 1000, iterations: 3, parallelism: 1 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject memory above 1048576', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 2_000_000, iterations: 3, parallelism: 1 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject iterations below 1', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 65536, iterations: 0, parallelism: 1 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject iterations above 100', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 65536, iterations: 101, parallelism: 1 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject parallelism below 1', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 65536, iterations: 3, parallelism: 0 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject parallelism above 16', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 65536, iterations: 3, parallelism: 17 },
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer memory', () => {
      const result = CreateEscrowUnlockTicketSchema.safeParse({
        wrappingKey: VALID_WRAPPING_KEY,
        argon2Salt: VALID_SALT,
        argon2Params: { memory: 65536.5, iterations: 3, parallelism: 1 },
      });
      expect(result.success).toBe(false);
    });
  });
});
