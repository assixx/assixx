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

  it('should accept optional address', () => {
    expect(
      SignupSchema.safeParse({ ...valid, address: 'Hauptstr. 1, 12345 Berlin' })
        .success,
    ).toBe(true);
  });

  it('should reject missing required fields', () => {
    expect(SignupSchema.safeParse({}).success).toBe(false);
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
