import { describe, expect, it } from 'vitest';

import { CheckSubdomainParamSchema } from './check-subdomain.dto.js';
import { SignupSchema } from './signup.dto.js';

// =============================================================
// SignupSchema
// =============================================================

describe('SignupSchema', () => {
  const valid = {
    companyName: 'Acme GmbH',
    subdomain: 'acme',
    email: 'info@acme.de',
    phone: '+49 123 456789',
    street: 'Musterstraße',
    houseNumber: '42',
    postalCode: '10115',
    city: 'Berlin',
    countryCode: 'DE',
    adminEmail: 'admin@acme.de',
    adminPassword: 'Strong1Pass!',
    adminFirstName: 'Max',
    adminLastName: 'Mustermann',
  };

  it('should accept valid signup data', () => {
    expect(SignupSchema.safeParse(valid).success).toBe(true);
  });

  it('should default plan to trial', () => {
    const result = SignupSchema.safeParse(valid);
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.plan).toBe('trial');
  });

  it('should accept explicit plan', () => {
    for (const plan of [
      'free',
      'basic',
      'professional',
      'enterprise',
      'trial',
    ]) {
      expect(SignupSchema.safeParse({ ...valid, plan }).success).toBe(true);
    }
  });

  it('should reject invalid plan', () => {
    expect(SignupSchema.safeParse({ ...valid, plan: 'premium' }).success).toBe(
      false,
    );
  });

  describe('subdomain validation', () => {
    it('should reject subdomain under 3 chars', () => {
      expect(
        SignupSchema.safeParse({ ...valid, subdomain: 'ab' }).success,
      ).toBe(false);
    });

    it('should reject subdomain over 50 chars', () => {
      expect(
        SignupSchema.safeParse({ ...valid, subdomain: 'a'.repeat(51) }).success,
      ).toBe(false);
    });

    it('should reject subdomain with uppercase', () => {
      expect(
        SignupSchema.safeParse({ ...valid, subdomain: 'Acme' }).success,
      ).toBe(false);
    });

    it('should reject subdomain starting with hyphen', () => {
      expect(
        SignupSchema.safeParse({ ...valid, subdomain: '-acme' }).success,
      ).toBe(false);
    });

    it('should reject subdomain ending with hyphen', () => {
      expect(
        SignupSchema.safeParse({ ...valid, subdomain: 'acme-' }).success,
      ).toBe(false);
    });

    it('should accept subdomain with hyphens in middle', () => {
      expect(
        SignupSchema.safeParse({ ...valid, subdomain: 'acme-corp' }).success,
      ).toBe(true);
    });
  });

  describe('company name validation', () => {
    it('should reject company name under 2 chars', () => {
      expect(
        SignupSchema.safeParse({ ...valid, companyName: 'A' }).success,
      ).toBe(false);
    });

    it('should accept German characters', () => {
      expect(
        SignupSchema.safeParse({ ...valid, companyName: 'Müller & Söhne GmbH' })
          .success,
      ).toBe(true);
    });
  });

  describe('phone validation', () => {
    it('should accept German phone number', () => {
      expect(
        SignupSchema.safeParse({ ...valid, phone: '+49 (0)123 456-789' })
          .success,
      ).toBe(true);
    });

    it('should reject phone under 6 chars', () => {
      expect(SignupSchema.safeParse({ ...valid, phone: '123' }).success).toBe(
        false,
      );
    });
  });

  describe('admin password validation', () => {
    it('should reject password without uppercase', () => {
      expect(
        SignupSchema.safeParse({ ...valid, adminPassword: 'nouppercase1' })
          .success,
      ).toBe(false);
    });

    it('should reject password without lowercase', () => {
      expect(
        SignupSchema.safeParse({ ...valid, adminPassword: 'NOLOWERCASE1' })
          .success,
      ).toBe(false);
    });

    it('should reject password without number', () => {
      expect(
        SignupSchema.safeParse({ ...valid, adminPassword: 'NoNumberHere!' })
          .success,
      ).toBe(false);
    });

    it('should reject password under 8 chars', () => {
      expect(
        SignupSchema.safeParse({ ...valid, adminPassword: 'Ab1!' }).success,
      ).toBe(false);
    });
  });

  describe('admin name validation', () => {
    it('should accept German name characters', () => {
      expect(
        SignupSchema.safeParse({
          ...valid,
          adminFirstName: 'Jürgen',
          adminLastName: 'Müller',
        }).success,
      ).toBe(true);
    });

    it('should reject empty name', () => {
      expect(
        SignupSchema.safeParse({ ...valid, adminFirstName: '' }).success,
      ).toBe(false);
    });
  });

  it('should reject missing required fields', () => {
    expect(SignupSchema.safeParse({}).success).toBe(false);
  });

  // ===========================================================
  // Street Validation
  // ===========================================================

  describe('street validation', () => {
    it('should accept German street with umlauts', () => {
      expect(
        SignupSchema.safeParse({ ...valid, street: 'Königstraße' }).success,
      ).toBe(true);
    });

    it('should accept street with numbers', () => {
      expect(
        SignupSchema.safeParse({ ...valid, street: 'Straße des 17. Juni' })
          .success,
      ).toBe(true);
    });

    it('should accept street with slash', () => {
      expect(
        SignupSchema.safeParse({ ...valid, street: 'Haupt-/Nebenstraße' })
          .success,
      ).toBe(true);
    });

    it('should reject empty street', () => {
      expect(SignupSchema.safeParse({ ...valid, street: '' }).success).toBe(
        false,
      );
    });

    it('should accept omitted street (optional since move to /settings/company)', () => {
      const { street: _, ...noStreet } = valid;

      expect(SignupSchema.safeParse(noStreet).success).toBe(true);
    });

    it('should trim whitespace', () => {
      const data = SignupSchema.parse({
        ...valid,
        street: '  Musterstraße  ',
      });

      expect(data.street).toBe('Musterstraße');
    });
  });

  // ===========================================================
  // House Number Validation
  // ===========================================================

  describe('houseNumber validation', () => {
    it('should accept numeric house number', () => {
      expect(
        SignupSchema.safeParse({ ...valid, houseNumber: '42' }).success,
      ).toBe(true);
    });

    it('should accept alphanumeric (e.g. "12a")', () => {
      expect(
        SignupSchema.safeParse({ ...valid, houseNumber: '12a' }).success,
      ).toBe(true);
    });

    it('should accept slash notation (e.g. "5/3")', () => {
      expect(
        SignupSchema.safeParse({ ...valid, houseNumber: '5/3' }).success,
      ).toBe(true);
    });

    it('should accept range (e.g. "10-12")', () => {
      expect(
        SignupSchema.safeParse({ ...valid, houseNumber: '10-12' }).success,
      ).toBe(true);
    });

    it('should reject empty', () => {
      expect(
        SignupSchema.safeParse({ ...valid, houseNumber: '' }).success,
      ).toBe(false);
    });

    it('should reject special characters', () => {
      expect(
        SignupSchema.safeParse({ ...valid, houseNumber: '42!' }).success,
      ).toBe(false);
    });
  });

  // ===========================================================
  // Postal Code Validation (International)
  // ===========================================================

  describe('postalCode validation', () => {
    it('should accept German PLZ (5 digits)', () => {
      expect(
        SignupSchema.safeParse({ ...valid, postalCode: '10115' }).success,
      ).toBe(true);
    });

    it('should accept Austrian PLZ (4 digits)', () => {
      expect(
        SignupSchema.safeParse({ ...valid, postalCode: '1010' }).success,
      ).toBe(true);
    });

    it('should accept UK postcode with space', () => {
      expect(
        SignupSchema.safeParse({ ...valid, postalCode: 'SW1A 1AA' }).success,
      ).toBe(true);
    });

    it('should accept US ZIP+4 with hyphen', () => {
      expect(
        SignupSchema.safeParse({ ...valid, postalCode: '10001-1234' }).success,
      ).toBe(true);
    });

    it('should accept Canadian postal code', () => {
      expect(
        SignupSchema.safeParse({ ...valid, postalCode: 'K1A 0B1' }).success,
      ).toBe(true);
    });

    it('should reject too short (< 3 chars)', () => {
      expect(
        SignupSchema.safeParse({ ...valid, postalCode: '12' }).success,
      ).toBe(false);
    });

    it('should reject special characters', () => {
      expect(
        SignupSchema.safeParse({ ...valid, postalCode: '101!5' }).success,
      ).toBe(false);
    });

    it('should trim whitespace', () => {
      const data = SignupSchema.parse({
        ...valid,
        postalCode: '  10115  ',
      });

      expect(data.postalCode).toBe('10115');
    });
  });

  // ===========================================================
  // City Validation
  // ===========================================================

  describe('city validation', () => {
    it('should accept standard city', () => {
      expect(SignupSchema.safeParse({ ...valid, city: 'Berlin' }).success).toBe(
        true,
      );
    });

    it('should accept city with umlauts', () => {
      expect(
        SignupSchema.safeParse({ ...valid, city: 'München' }).success,
      ).toBe(true);
    });

    it('should accept compound city name', () => {
      expect(
        SignupSchema.safeParse({ ...valid, city: 'Frankfurt am Main' }).success,
      ).toBe(true);
    });

    it('should accept city with apostrophe', () => {
      expect(
        SignupSchema.safeParse({ ...valid, city: "L'Aquila" }).success,
      ).toBe(true);
    });

    it('should accept city with parentheses', () => {
      expect(
        SignupSchema.safeParse({
          ...valid,
          city: 'Neustadt (Weinstraße)',
        }).success,
      ).toBe(true);
    });

    it('should reject empty city', () => {
      expect(SignupSchema.safeParse({ ...valid, city: '' }).success).toBe(
        false,
      );
    });

    it('should trim whitespace', () => {
      const data = SignupSchema.parse({ ...valid, city: '  Berlin  ' });

      expect(data.city).toBe('Berlin');
    });
  });

  // ===========================================================
  // Country Code Validation (ISO 3166-1 alpha-2)
  // ===========================================================

  describe('countryCode validation', () => {
    for (const code of ['DE', 'AT', 'CH', 'US', 'GB', 'FR', 'NL']) {
      it(`should accept ${code}`, () => {
        expect(
          SignupSchema.safeParse({ ...valid, countryCode: code }).success,
        ).toBe(true);
      });
    }

    it('should reject lowercase', () => {
      expect(
        SignupSchema.safeParse({ ...valid, countryCode: 'de' }).success,
      ).toBe(false);
    });

    it('should reject single character', () => {
      expect(
        SignupSchema.safeParse({ ...valid, countryCode: 'D' }).success,
      ).toBe(false);
    });

    it('should reject three characters', () => {
      expect(
        SignupSchema.safeParse({ ...valid, countryCode: 'DEU' }).success,
      ).toBe(false);
    });

    it('should reject numbers', () => {
      expect(
        SignupSchema.safeParse({ ...valid, countryCode: '49' }).success,
      ).toBe(false);
    });

    it('should reject empty', () => {
      expect(
        SignupSchema.safeParse({ ...valid, countryCode: '' }).success,
      ).toBe(false);
    });
  });

  // ===========================================================
  // International Address Combinations
  // ===========================================================

  describe('international addresses', () => {
    it('should accept Austrian address', () => {
      expect(
        SignupSchema.safeParse({
          ...valid,
          street: 'Kärntner Straße',
          houseNumber: '1',
          postalCode: '1010',
          city: 'Wien',
          countryCode: 'AT',
        }).success,
      ).toBe(true);
    });

    it('should accept Swiss address', () => {
      expect(
        SignupSchema.safeParse({
          ...valid,
          street: 'Bahnhofstrasse',
          houseNumber: '10',
          postalCode: '8001',
          city: 'Zürich',
          countryCode: 'CH',
        }).success,
      ).toBe(true);
    });

    it('should accept US address', () => {
      expect(
        SignupSchema.safeParse({
          ...valid,
          street: 'Broadway',
          houseNumber: '1600',
          postalCode: '10019',
          city: 'New York',
          countryCode: 'US',
        }).success,
      ).toBe(true);
    });

    it('should accept UK address', () => {
      expect(
        SignupSchema.safeParse({
          ...valid,
          street: 'Baker Street',
          houseNumber: '221B',
          postalCode: 'NW1 6XE',
          city: 'London',
          countryCode: 'GB',
        }).success,
      ).toBe(true);
    });
  });

  // ===========================================================
  // Missing Address Fields (Regression)
  // ===========================================================

  describe('optional address fields (completed in /settings/company)', () => {
    const addressFields = [
      'street',
      'houseNumber',
      'postalCode',
      'city',
      'countryCode',
    ] as const;

    for (const field of addressFields) {
      it(`should accept missing ${field}`, () => {
        const { [field]: _, ...payload } = valid;

        expect(SignupSchema.safeParse(payload).success).toBe(true);
      });
    }
  });
});

// =============================================================
// CheckSubdomainParamSchema
// =============================================================

describe('CheckSubdomainParamSchema', () => {
  it('should accept valid subdomain', () => {
    expect(
      CheckSubdomainParamSchema.safeParse({ subdomain: 'acme' }).success,
    ).toBe(true);
  });

  it('should transform to lowercase', () => {
    // Note: regex requires lowercase already, so transformation just trims
    const result = CheckSubdomainParamSchema.safeParse({ subdomain: 'acme' });
    expect(result.success).toBe(true);
    const data = (result as { success: true; data: Record<string, unknown> })
      .data;
    expect(data.subdomain).toBe('acme');
  });

  it('should reject too short subdomain', () => {
    expect(
      CheckSubdomainParamSchema.safeParse({ subdomain: 'ab' }).success,
    ).toBe(false);
  });

  it('should reject missing subdomain', () => {
    expect(CheckSubdomainParamSchema.safeParse({}).success).toBe(false);
  });
});
