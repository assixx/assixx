/**
 * Zod Schema Validation Tests for StoreEscrowDto
 *
 * Tests the Zod schema used to validate escrow blob storage requests.
 * Covers: valid inputs, boundary values, invalid types, base64 validation.
 *
 * @see ADR-022 (E2E Key Escrow)
 */
import { describe, expect, it } from 'vitest';

import { StoreEscrowSchema } from './store-escrow.dto.js';

// =============================================================
// Helpers
// =============================================================

/** Generate a valid base64 string of exactly N bytes */
function base64OfBytes(n: number): string {
  const bytes = Buffer.alloc(n, 0xab);
  return bytes.toString('base64');
}

/** Valid payload matching ADR-022 defaults */
function validPayload() {
  return {
    encryptedBlob: base64OfBytes(48), // 32-byte key + 16-byte Poly1305 tag
    argon2Salt: base64OfBytes(32),
    xchachaNonce: base64OfBytes(24),
    argon2Params: {
      memory: 65536,
      iterations: 3,
      parallelism: 1,
    },
  };
}

// =============================================================
// Tests
// =============================================================

describe('StoreEscrowSchema', () => {
  // -----------------------------------------------------------
  // Valid inputs
  // -----------------------------------------------------------

  describe('valid inputs', () => {
    it('should accept a valid payload with default Argon2 params', () => {
      const result = StoreEscrowSchema.safeParse(validPayload());
      expect(result.success).toBe(true);
    });

    it('should accept minimum valid Argon2 params', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 16384, iterations: 1, parallelism: 1 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept maximum valid Argon2 params', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 1048576, iterations: 100, parallelism: 16 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // encryptedBlob validation
  // -----------------------------------------------------------

  describe('encryptedBlob', () => {
    it('should reject empty string', () => {
      const payload = { ...validPayload(), encryptedBlob: '' };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject too short string', () => {
      const payload = { ...validPayload(), encryptedBlob: 'short' };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject string exceeding max length', () => {
      const payload = { ...validPayload(), encryptedBlob: 'A'.repeat(501) };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should trim whitespace', () => {
      const blob = base64OfBytes(48);
      const payload = { ...validPayload(), encryptedBlob: `  ${blob}  ` };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(true);
      expect(
        (result as { success: true; data: { encryptedBlob: string } }).data
          .encryptedBlob,
      ).toBe(blob);
    });
  });

  // -----------------------------------------------------------
  // argon2Salt validation
  // -----------------------------------------------------------

  describe('argon2Salt', () => {
    it('should reject non-32-byte base64 value', () => {
      const payload = { ...validPayload(), argon2Salt: base64OfBytes(16) };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid base64', () => {
      const payload = {
        ...validPayload(),
        argon2Salt: '!!!not-valid-base64!!!-pad-to-forty',
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should accept exactly 32-byte base64', () => {
      const payload = { ...validPayload(), argon2Salt: base64OfBytes(32) };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // xchachaNonce validation
  // -----------------------------------------------------------

  describe('xchachaNonce', () => {
    it('should reject non-24-byte base64 value', () => {
      const payload = { ...validPayload(), xchachaNonce: base64OfBytes(16) };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should accept exactly 24-byte base64', () => {
      const payload = { ...validPayload(), xchachaNonce: base64OfBytes(24) };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });
  });

  // -----------------------------------------------------------
  // argon2Params validation
  // -----------------------------------------------------------

  describe('argon2Params', () => {
    it('should reject memory below 16384', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 1000, iterations: 3, parallelism: 1 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject memory above 1048576', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 2000000, iterations: 3, parallelism: 1 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject iterations below 1', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 65536, iterations: 0, parallelism: 1 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject iterations above 100', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 65536, iterations: 101, parallelism: 1 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject parallelism below 1', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 65536, iterations: 3, parallelism: 0 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject parallelism above 16', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 65536, iterations: 3, parallelism: 17 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer values', () => {
      const payload = {
        ...validPayload(),
        argon2Params: { memory: 65536.5, iterations: 3, parallelism: 1 },
      };
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing argon2Params', () => {
      const { argon2Params: _, ...payload } = validPayload();
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  // -----------------------------------------------------------
  // Missing fields
  // -----------------------------------------------------------

  describe('missing fields', () => {
    it('should reject missing encryptedBlob', () => {
      const { encryptedBlob: _, ...payload } = validPayload();
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing argon2Salt', () => {
      const { argon2Salt: _, ...payload } = validPayload();
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing xchachaNonce', () => {
      const { xchachaNonce: _, ...payload } = validPayload();
      const result = StoreEscrowSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
