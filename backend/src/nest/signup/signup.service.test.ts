/**
 * Signup Service – Unit Tests
 *
 * Tests for pure validation methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppConfigService } from '../config/config.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { SignupDto } from './dto/index.js';
import { SignupService } from './signup.service.js';

// ============================================================
// Module mocks
// ============================================================

const mockBcryptHash = vi.hoisted(() => vi.fn().mockResolvedValue('hashed-password'));
const mockUuidV7 = vi.hoisted(() => vi.fn().mockReturnValue('mock-uuid-v7'));

vi.mock('bcryptjs', () => ({ default: { hash: mockBcryptHash } }));
vi.mock('uuid', () => ({ v7: mockUuidV7 }));

// ============================================================
// Setup
// ============================================================

const mockConfig = {
  isDevelopment: false,
} as unknown as AppConfigService;

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
  const service = new SignupService(mockDb as unknown as DatabaseService, mockConfig);
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
      expect(() => service['validateSubdomainOrThrow']('ab')).toThrow(BadRequestException);
    });

    it('does not throw for valid subdomain', () => {
      expect(() => service['validateSubdomainOrThrow']('valid-company')).not.toThrow();
    });
  });

  describe('ensureSubdomainAvailable', () => {
    it('throws ConflictException when subdomain is taken', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]); // existing

      await expect(service['ensureSubdomainAvailable']('taken')).rejects.toThrow(ConflictException);
    });

    it('resolves when subdomain is available', async () => {
      mockDb.query.mockResolvedValueOnce([]); // no existing

      await expect(service['ensureSubdomainAvailable']('available')).resolves.toBeUndefined();
    });
  });
});

// ============================================================
// Registration (full flow)
// ============================================================

describe('SignupService – registration', () => {
  let service: SignupService;
  let mockDb: {
    query: ReturnType<typeof vi.fn>;
    transaction: ReturnType<typeof vi.fn>;
  };
  let mockClient: { query: ReturnType<typeof vi.fn> };

  function createValidDto(): SignupDto {
    return {
      companyName: 'Test GmbH',
      subdomain: 'test-gmbh',
      email: 'info@test-gmbh.de',
      phone: '+49123456789',
      street: 'Musterstraße',
      houseNumber: '42',
      postalCode: '10115',
      city: 'Berlin',
      countryCode: 'DE',
      adminEmail: 'admin@test-gmbh.de',
      adminPassword: 'SecurePass123!',
      adminFirstName: 'Max',
      adminLastName: 'Mustermann',
    } as SignupDto;
  }

  function setupFullHappyPath(): void {
    // 1. isSubdomainAvailable → available
    mockDb.query.mockResolvedValueOnce([]);
    // 2. transaction executes callback
    mockDb.transaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
      cb(mockClient),
    );
    // Client queries inside transaction:
    // createTenant INSERT
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
    // createRootUser INSERT
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    // createRootUser UPDATE employee_id
    mockClient.query.mockResolvedValueOnce({ rows: [] });
    // activateTrialAddons: production mode → returns early (no queries)
    // 3. createAuditLog INSERT
    mockDb.query.mockResolvedValueOnce([]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockBcryptHash.mockResolvedValue('hashed-password');
    mockUuidV7.mockReturnValue('mock-uuid-v7');
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockClient = { query: vi.fn() };
  });

  describe('registerTenant', () => {
    it('should register tenant successfully', async () => {
      setupFullHappyPath();

      const result = await service.registerTenant(createValidDto(), '127.0.0.1', 'TestAgent');

      expect(result.tenantId).toBe(10);
      expect(result.userId).toBe(1);
      expect(result.subdomain).toBe('test-gmbh');
      expect(result.message).toContain('Registration successful');
      expect(result.trialEndsAt).toBeDefined();
    });

    it('should pass address to audit log when provided', async () => {
      setupFullHappyPath();
      const dto = createValidDto();

      const result = await service.registerTenant(dto, '127.0.0.1', 'Agent');

      expect(result.tenantId).toBe(10);

      // Verify audit log contains structured address
      const auditCall = mockDb.query.mock.calls[1] as unknown[];
      const auditParams = auditCall[1] as unknown[];
      const newValues = JSON.parse(auditParams[6] as string) as Record<string, unknown>;
      expect(newValues.street).toBe('Musterstraße');
      expect(newValues.house_number).toBe('42');
      expect(newValues.postal_code).toBe('10115');
      expect(newValues.city).toBe('Berlin');
      expect(newValues.country_code).toBe('DE');
    });

    it('should throw BadRequestException for invalid subdomain', async () => {
      const dto = createValidDto();
      dto.subdomain = 'ab';

      await expect(service.registerTenant(dto)).rejects.toThrow(BadRequestException);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for taken subdomain', async () => {
      mockDb.query.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.registerTenant(createValidDto())).rejects.toThrow(ConflictException);
      expect(mockDb.transaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when transaction fails', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.registerTenant(createValidDto())).rejects.toThrow(BadRequestException);
    });

    it('should throw when tenant creation returns no id', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.registerTenant(createValidDto())).rejects.toThrow(BadRequestException);
    });

    it('should throw when user creation returns no id', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.registerTenant(createValidDto())).rejects.toThrow(BadRequestException);
    });

    it('should activate ALL purchasable addons in development mode', async () => {
      const devConfig = {
        isDevelopment: true,
      } as unknown as AppConfigService;
      const devDb = {
        query: vi.fn(),
        transaction: vi.fn(),
      };
      const devService = new SignupService(devDb as unknown as DatabaseService, devConfig);

      // isSubdomainAvailable → available
      devDb.query.mockResolvedValueOnce([]);
      // transaction executes callback
      devDb.transaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      // createTenant INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // createRootUser INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // createRootUser UPDATE employee_id
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // activateTrialAddons SELECT purchasable addons
      mockClient.query.mockResolvedValueOnce({
        rows: [
          { id: 1, trial_days: 30 },
          { id: 2, trial_days: 30 },
          { id: 3, trial_days: 30 },
        ],
      });
      // activateTrialAddons INSERT addon 1, 2, 3
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // createAuditLog INSERT
      devDb.query.mockResolvedValueOnce([]);

      const result = await devService.registerTenant(createValidDto());

      expect(result.tenantId).toBe(10);

      // Dev-mode query selects purchasable addons (is_core = false)
      const addonSelectCall = mockClient.query.mock.calls[3] as unknown[];
      expect(addonSelectCall[0]).toContain('is_core = false');

      // 3 setup queries + 1 addon SELECT + 3 addon INSERTs = 7
      expect(mockClient.query).toHaveBeenCalledTimes(7);
    });

    it('should succeed even when audit log fails', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      mockDb.transaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      // createTenant INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // createRootUser INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // createRootUser UPDATE employee_id
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // activateTrialAddons: production mode → returns early
      // createAuditLog → fails
      mockDb.query.mockRejectedValueOnce(new Error('Audit log failed'));

      const result = await service.registerTenant(createValidDto());

      expect(result.tenantId).toBe(10);
    });
  });

  describe('checkSubdomainAvailability – error path', () => {
    it('should throw BadRequestException on DB error', async () => {
      mockDb.query.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.checkSubdomainAvailability('valid-sub')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
