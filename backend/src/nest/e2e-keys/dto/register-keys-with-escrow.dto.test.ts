/**
 * Zod Schema Validation Tests for RegisterKeysWithEscrowDto
 *
 * Both fields (`publicKey` and `escrow`) are load-bearing for the
 * atomicity guarantee — partial input would defeat the purpose of the
 * combined endpoint. The underlying `RegisterKeysSchema` and
 * `StoreEscrowSchema` have their own coverage; these tests focus on the
 * composition: both fields required, escrow shape preserved.
 *
 * @see ADR-022 (E2E Key Escrow)
 */
import { describe, expect, it } from 'vitest';

import { RegisterKeysWithEscrowSchema } from './register-keys-with-escrow.dto.js';

function base64OfBytes(n: number): string {
  return Buffer.alloc(n, 0xab).toString('base64');
}

function validPayload(): {
  publicKey: string;
  escrow: {
    encryptedBlob: string;
    argon2Salt: string;
    xchachaNonce: string;
    argon2Params: { memory: number; iterations: number; parallelism: number };
  };
} {
  return {
    publicKey: base64OfBytes(32),
    escrow: {
      encryptedBlob: base64OfBytes(48),
      argon2Salt: base64OfBytes(32),
      xchachaNonce: base64OfBytes(24),
      argon2Params: { memory: 65536, iterations: 3, parallelism: 1 },
    },
  };
}

describe('RegisterKeysWithEscrowSchema', () => {
  it('accepts a valid combined payload', () => {
    const result = RegisterKeysWithEscrowSchema.safeParse(validPayload());
    expect(result.success).toBe(true);
  });

  it('rejects missing publicKey (atomicity invariant: both required)', () => {
    const { publicKey: _, ...payload } = validPayload();
    const result = RegisterKeysWithEscrowSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects missing escrow (atomicity invariant: both required)', () => {
    const { escrow: _, ...payload } = validPayload();
    const result = RegisterKeysWithEscrowSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects malformed publicKey (delegates to RegisterKeysSchema)', () => {
    const payload = { ...validPayload(), publicKey: 'too-short' };
    const result = RegisterKeysWithEscrowSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects malformed escrow.argon2Salt (delegates to StoreEscrowSchema)', () => {
    const base = validPayload();
    const payload = {
      ...base,
      escrow: { ...base.escrow, argon2Salt: base64OfBytes(16) },
    };
    const result = RegisterKeysWithEscrowSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('rejects partial escrow object (e.g., missing xchachaNonce)', () => {
    const base = validPayload();
    const { xchachaNonce: _, ...escrowPartial } = base.escrow;
    const payload = { ...base, escrow: escrowPartial };
    const result = RegisterKeysWithEscrowSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});
