import { describe, expect, it } from 'vitest';

import { UpdateCompanySchema } from './company.dto.js';

// =============================================================
// Helper
// =============================================================

function parse(data: Record<string, unknown>): {
  success: boolean;
  data?: Record<string, unknown>;
} {
  return UpdateCompanySchema.safeParse(data) as {
    success: boolean;
    data?: Record<string, unknown>;
  };
}

// =============================================================
// UpdateCompanySchema
// =============================================================

describe('UpdateCompanySchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(parse({}).success).toBe(true);
  });

  it('accepts all fields provided', () => {
    const result = parse({
      street: 'Musterstraße',
      houseNumber: '42a',
      postalCode: '10115',
      city: 'Berlin',
      countryCode: 'DE',
    });
    expect(result.success).toBe(true);
  });

  // ── Street ──────────────────────────────────────────────

  describe('street', () => {
    it('accepts valid street with umlauts', () => {
      expect(parse({ street: 'Königstraße' }).success).toBe(true);
    });

    it('trims whitespace', () => {
      const result = parse({ street: '  Hauptstraße  ' });
      expect(result.success).toBe(true);
      expect(result.data?.street).toBe('Hauptstraße');
    });

    it('rejects empty string', () => {
      expect(parse({ street: '' }).success).toBe(false);
    });

    it('rejects invalid characters', () => {
      expect(parse({ street: 'Street@#!' }).success).toBe(false);
    });

    it('rejects string exceeding 255 chars', () => {
      expect(parse({ street: 'A'.repeat(256) }).success).toBe(false);
    });
  });

  // ── HouseNumber ─────────────────────────────────────────

  describe('houseNumber', () => {
    it('accepts number with letter suffix', () => {
      expect(parse({ houseNumber: '42a' }).success).toBe(true);
    });

    it('accepts number with slash', () => {
      expect(parse({ houseNumber: '5/3' }).success).toBe(true);
    });

    it('trims whitespace', () => {
      const result = parse({ houseNumber: ' 12 ' });
      expect(result.success).toBe(true);
      expect(result.data?.houseNumber).toBe('12');
    });

    it('rejects empty string', () => {
      expect(parse({ houseNumber: '' }).success).toBe(false);
    });

    it('rejects invalid characters', () => {
      expect(parse({ houseNumber: '42#' }).success).toBe(false);
    });

    it('rejects string exceeding 20 chars', () => {
      expect(parse({ houseNumber: '1'.repeat(21) }).success).toBe(false);
    });
  });

  // ── PostalCode ──────────────────────────────────────────

  describe('postalCode', () => {
    it('accepts German PLZ', () => {
      expect(parse({ postalCode: '10115' }).success).toBe(true);
    });

    it('accepts UK format', () => {
      expect(parse({ postalCode: 'SW1A 1AA' }).success).toBe(true);
    });

    it('trims whitespace', () => {
      const result = parse({ postalCode: ' 20095 ' });
      expect(result.success).toBe(true);
      expect(result.data?.postalCode).toBe('20095');
    });

    it('rejects too short (< 3)', () => {
      expect(parse({ postalCode: '12' }).success).toBe(false);
    });

    it('rejects too long (> 20)', () => {
      expect(parse({ postalCode: '1'.repeat(21) }).success).toBe(false);
    });

    it('rejects invalid characters', () => {
      expect(parse({ postalCode: '101!5' }).success).toBe(false);
    });
  });

  // ── City ────────────────────────────────────────────────

  describe('city', () => {
    it('accepts city with umlauts', () => {
      expect(parse({ city: 'München' }).success).toBe(true);
    });

    it('accepts city with hyphen', () => {
      expect(parse({ city: 'Frankfurt-Höchst' }).success).toBe(true);
    });

    it('trims whitespace', () => {
      const result = parse({ city: ' Berlin ' });
      expect(result.success).toBe(true);
      expect(result.data?.city).toBe('Berlin');
    });

    it('rejects empty string', () => {
      expect(parse({ city: '' }).success).toBe(false);
    });

    it('rejects invalid characters', () => {
      expect(parse({ city: 'Berlin@123' }).success).toBe(false);
    });

    it('rejects string exceeding 100 chars', () => {
      expect(parse({ city: 'A'.repeat(101) }).success).toBe(false);
    });
  });

  // ── CountryCode ─────────────────────────────────────────

  describe('countryCode', () => {
    it('accepts valid 2-letter code', () => {
      expect(parse({ countryCode: 'DE' }).success).toBe(true);
    });

    it('transforms to uppercase', () => {
      const result = parse({ countryCode: 'DE' });
      expect(result.success).toBe(true);
      expect(result.data?.countryCode).toBe('DE');
    });

    it('rejects single character', () => {
      expect(parse({ countryCode: 'D' }).success).toBe(false);
    });

    it('rejects three characters', () => {
      expect(parse({ countryCode: 'DEU' }).success).toBe(false);
    });

    it('rejects lowercase letters', () => {
      expect(parse({ countryCode: 'de' }).success).toBe(false);
    });

    it('rejects numbers', () => {
      expect(parse({ countryCode: '12' }).success).toBe(false);
    });
  });
});
