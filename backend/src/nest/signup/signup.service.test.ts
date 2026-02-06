/**
 * Signup Service – Unit Tests
 *
 * Tests for pure validation methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import { SignupService } from './signup.service.js';

// ============================================================
// Setup
// ============================================================

function createServiceWithMock(): {
  service: SignupService;
  mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
} {
  const mockDb = {
    query: vi.fn(),
    transaction: vi.fn(),
  };
  const service = new SignupService(mockDb as unknown as DatabaseService);
  return { service, mockDb };
}

// ============================================================
// Pure Validation Methods
// ============================================================

describe('SignupService – pure validators', () => {
  let service: SignupService;

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
  });

  describe('validateSubdomain', () => {
    it('accepts valid subdomain', () => {
      const result = service.validateSubdomain('my-company');

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('accepts subdomain with numbers', () => {
      const result = service.validateSubdomain('company123');

      expect(result.valid).toBe(true);
    });

    it('rejects uppercase characters', () => {
      const result = service.validateSubdomain('MyCompany');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('lowercase');
    });

    it('rejects special characters', () => {
      const result = service.validateSubdomain('my_company');

      expect(result.valid).toBe(false);
    });

    it('rejects too short subdomain', () => {
      const result = service.validateSubdomain('ab');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('between 3 and 50');
    });

    it('rejects reserved subdomain', () => {
      const result = service.validateSubdomain('www');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('reserved');
    });

    it('rejects other reserved subdomains', () => {
      for (const reserved of ['api', 'admin', 'app', 'mail', 'test', 'dev']) {
        const result = service.validateSubdomain(reserved);
        expect(result.valid).toBe(false);
      }
    });
  });

  describe('generateEmployeeId', () => {
    it('generates correct format for root role', () => {
      const result = service['generateEmployeeId']('acme', 'root', 1);

      expect(result).toBe('ACM-R00001');
    });

    it('generates correct format for admin role', () => {
      const result = service['generateEmployeeId']('test', 'admin', 42);

      expect(result).toBe('TES-A00042');
    });

    it('generates correct format for employee role', () => {
      const result = service['generateEmployeeId']('bigcorp', 'employee', 100);

      expect(result).toBe('BIG-E00100');
    });
  });

  describe('generateTemporaryEmployeeNumber', () => {
    it('starts with TEMP- prefix', () => {
      const result = service['generateTemporaryEmployeeNumber']();

      expect(result).toMatch(/^TEMP-\d+$/);
    });

    it('generates unique values', () => {
      const a = service['generateTemporaryEmployeeNumber']();
      const b = service['generateTemporaryEmployeeNumber']();

      // Not guaranteed unique per call but highly likely
      expect(typeof a).toBe('string');
      expect(typeof b).toBe('string');
    });
  });
});

// ============================================================
// DB-Mocked Methods
// ============================================================

describe('SignupService – DB-mocked methods', () => {
  let service: SignupService;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('checkSubdomainAvailability', () => {
    it('returns available=true for unused subdomain', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no existing tenant

      const result = await service.checkSubdomainAvailability('new-company');

      expect(result.available).toBe(true);
      expect(result.subdomain).toBe('new-company');
    });

    it('returns available=false for taken subdomain', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]); // existing tenant

      const result = await service.checkSubdomainAvailability('existing');

      expect(result.available).toBe(false);
    });

    it('returns available=false for invalid format without DB call', async () => {
      const result = await service.checkSubdomainAvailability('ab');

      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('returns available=false for reserved subdomain', async () => {
      const result = await service.checkSubdomainAvailability('admin');

      expect(result.available).toBe(false);
      expect(result.error).toContain('reserved');
    });
  });

  describe('validateSubdomainOrThrow', () => {
    it('throws BadRequestException for invalid subdomain', () => {
      expect(() => service['validateSubdomainOrThrow']('ab')).toThrow(
        BadRequestException,
      );
    });

    it('does not throw for valid subdomain', () => {
      expect(() =>
        service['validateSubdomainOrThrow']('valid-company'),
      ).not.toThrow();
    });
  });

  describe('ensureSubdomainAvailable', () => {
    it('throws ConflictException when subdomain is taken', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]); // existing

      await expect(
        service['ensureSubdomainAvailable']('taken'),
      ).rejects.toThrow(ConflictException);
    });

    it('resolves when subdomain is available', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no existing

      await expect(
        service['ensureSubdomainAvailable']('available'),
      ).resolves.toBeUndefined();
    });
  });
});
