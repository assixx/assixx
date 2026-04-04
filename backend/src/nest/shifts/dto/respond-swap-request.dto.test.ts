/**
 * Unit tests for RespondSwapRequestSchema
 */
import { describe, expect, it } from 'vitest';

import { RespondSwapRequestSchema } from './respond-swap-request.dto.js';

describe('RespondSwapRequestSchema', () => {
  it('should accept valid accept response', () => {
    expect(RespondSwapRequestSchema.safeParse({ accept: true }).success).toBe(true);
  });

  it('should accept valid decline response with note', () => {
    const result = RespondSwapRequestSchema.safeParse({ accept: false, note: 'Keine Zeit' });
    expect(result.success).toBe(true);
  });

  it('should reject missing accept field', () => {
    expect(RespondSwapRequestSchema.safeParse({}).success).toBe(false);
  });

  it('should reject non-boolean accept', () => {
    expect(RespondSwapRequestSchema.safeParse({ accept: 'yes' }).success).toBe(false);
  });

  it('should reject note longer than 500 characters', () => {
    expect(
      RespondSwapRequestSchema.safeParse({ accept: false, note: 'N'.repeat(501) }).success,
    ).toBe(false);
  });

  it('should trim note whitespace', () => {
    const result = RespondSwapRequestSchema.parse({ accept: true, note: '  trimmed  ' });
    expect(result.note).toBe('trimmed');
  });

  it('should allow accept without note', () => {
    const result = RespondSwapRequestSchema.parse({ accept: true });
    expect(result.note).toBeUndefined();
  });
});
