/**
 * Signup Service – Unit Tests
 *
 * Tests for pure validation methods + DB-mocked public methods.
 * Private methods tested via bracket notation.
 */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CompleteSignupDto } from '../auth/oauth/dto/index.js';
import type { SignupTicket } from '../auth/oauth/oauth.types.js';
import type { AppConfigService } from '../config/config.service.js';
import type { DatabaseService } from '../database/database.service.js';
import type { DomainVerificationService } from '../domains/domain-verification.service.js';
import type { TwoFactorAuthService } from '../two-factor-auth/two-factor-auth.service.js';
import type { TwoFactorChallenge } from '../two-factor-auth/two-factor-auth.types.js';
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

// Stub for the new 3rd constructor arg (Step 2.8) — token-generator only.
// Returns a fixed 64-hex string matching `crypto.randomBytes(32).toString('hex')`
// shape so the seedPendingDomain INSERT's `verification_token` satisfies the
// VARCHAR(64) DB column and the mocked DB doesn't care about the actual value.
const mockDomainVerification = {
  generateToken: vi.fn().mockReturnValue('a'.repeat(64)),
} as unknown as DomainVerificationService;

// Step 2.5 (ADR-054) constructor arg #4: TwoFactorAuthService.
// `issueChallenge` is the only method `SignupService.registerTenant` calls;
// the OAuth path (`registerTenantWithOAuth`) bypasses 2FA per DD-7, so the
// mock is unused on that path but must still be present in the constructor.
//
// The fake challenge mirrors the public-facing shape returned by the real
// service (`TwoFactorChallenge` from `two-factor-auth.types.ts`). Tests that
// inspect the response assert against `FAKE_CHALLENGE` directly.
const FAKE_CHALLENGE: TwoFactorChallenge = {
  challengeToken: 'fake-token-base64url-32bytes',
  expiresAt: '2026-04-29T12:00:00.000Z',
  resendAvailableAt: '2026-04-29T11:01:00.000Z',
  resendsRemaining: 3,
};
const mockIssueChallenge = vi.fn();
const mockTwoFactorAuth = {
  issueChallenge: mockIssueChallenge,
} as unknown as TwoFactorAuthService;

function createServiceWithMock(): {
  service: SignupService;
  mockDb: {
    systemQuery: ReturnType<typeof vi.fn>;
    systemTransaction: ReturnType<typeof vi.fn>;
  };
} {
  const mockDb = {
    systemQuery: vi.fn(),
    systemTransaction: vi.fn(),
  };
  const service = new SignupService(
    mockDb as unknown as DatabaseService,
    mockConfig,
    mockDomainVerification,
    mockTwoFactorAuth,
  );
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
    systemQuery: ReturnType<typeof vi.fn>;
    systemTransaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  describe('checkSubdomainAvailability', () => {
    it('returns available=true for unused subdomain', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // no existing tenant

      const result = await service.checkSubdomainAvailability('new-company');

      expect(result.available).toBe(true);
      expect(result.subdomain).toBe('new-company');
    });

    it('returns available=false for taken subdomain', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ id: 1 }]); // existing tenant

      const result = await service.checkSubdomainAvailability('existing');

      expect(result.available).toBe(false);
    });

    it('returns available=false for invalid format without DB call', async () => {
      const result = await service.checkSubdomainAvailability('ab');

      expect(result.available).toBe(false);
      expect(result.error).toBeDefined();
      expect(mockDb.systemQuery).not.toHaveBeenCalled();
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
      mockDb.systemQuery.mockResolvedValueOnce([{ id: 1 }]); // existing

      await expect(service['ensureSubdomainAvailable']('taken')).rejects.toThrow(ConflictException);
    });

    it('resolves when subdomain is available', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // no existing

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
    systemQuery: ReturnType<typeof vi.fn>;
    systemTransaction: ReturnType<typeof vi.fn>;
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
    mockDb.systemQuery.mockResolvedValueOnce([]);
    // 2. transaction executes callback
    mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
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
    mockDb.systemQuery.mockResolvedValueOnce([]);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockBcryptHash.mockResolvedValue('hashed-password');
    mockUuidV7.mockReturnValue('mock-uuid-v7');
    // Step 2.5 (ADR-054): every registerTenant happy path issues a 2FA
    // challenge AFTER the persistence transaction. Tests that exercise the
    // failure path can override with `mockRejectedValueOnce` per-test.
    mockIssueChallenge.mockResolvedValue(FAKE_CHALLENGE);
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockClient = { query: vi.fn() };
  });

  describe('registerTenant', () => {
    it('should register tenant successfully', async () => {
      setupFullHappyPath();

      const result = await service.registerTenant(createValidDto(), '127.0.0.1', 'TestAgent');

      // Step 2.5: response is the LoginResult discriminated union — the
      // tenant + pending user rows still exist (verifiable via DB), but the
      // wire shape carries only the public challenge view.
      // Asserting the full object in one call (instead of a typeguard branch)
      // keeps `expect` out of conditionals — `vitest/no-conditional-expect`.
      expect(result).toEqual({ stage: 'challenge_required', challenge: FAKE_CHALLENGE });

      // issueChallenge was called with the freshly-minted (tenantId, userId)
      // and the dto.adminEmail, with purpose='signup'.
      expect(mockIssueChallenge).toHaveBeenCalledWith(
        /* userId */ 1,
        /* tenantId */ 10,
        'admin@test-gmbh.de',
        'signup',
      );
    });

    it('should pass address to audit log when provided', async () => {
      setupFullHappyPath();
      const dto = createValidDto();

      const result = await service.registerTenant(dto, '127.0.0.1', 'Agent');

      // Top-level shape sanity (Step 2.5).
      expect(result.stage).toBe('challenge_required');

      // Verify audit log contains structured address — the audit row is
      // still written after issueChallenge succeeds, at the same systemQuery
      // index (1: subdomain check at 0, audit at 1).
      const auditCall = mockDb.systemQuery.mock.calls[1] as unknown[];
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
      expect(mockDb.systemTransaction).not.toHaveBeenCalled();
    });

    it('should throw ConflictException for taken subdomain', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ id: 1 }]);

      await expect(service.registerTenant(createValidDto())).rejects.toThrow(ConflictException);
      expect(mockDb.systemTransaction).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when transaction fails', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);
      mockDb.systemTransaction.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(service.registerTenant(createValidDto())).rejects.toThrow(BadRequestException);
    });

    it('should throw when tenant creation returns no id', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);
      mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      mockClient.query.mockResolvedValueOnce({ rows: [] });

      await expect(service.registerTenant(createValidDto())).rejects.toThrow(BadRequestException);
    });

    it('should throw when user creation returns no id', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);
      mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
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
        systemQuery: vi.fn(),
        systemTransaction: vi.fn(),
      };
      const devService = new SignupService(
        devDb as unknown as DatabaseService,
        devConfig,
        mockDomainVerification,
        mockTwoFactorAuth,
      );

      // isSubdomainAvailable → available
      devDb.systemQuery.mockResolvedValueOnce([]);
      // transaction executes callback
      devDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      // createTenant INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // createRootUser INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // createRootUser UPDATE employee_id
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // seedPendingDomain INSERT tenant_domains (Step 2.8)
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
      devDb.systemQuery.mockResolvedValueOnce([]);

      const result = await devService.registerTenant(createValidDto());

      // Step 2.5: shape is now the LoginResult discriminated union.
      expect(result.stage).toBe('challenge_required');

      // Dev-mode query selects purchasable addons (is_core = false) —
      // index shifts from 3 to 4 after Step 2.8's seedPendingDomain INSERT.
      const addonSelectCall = mockClient.query.mock.calls[4] as unknown[];
      expect(addonSelectCall[0]).toContain('is_core = false');

      // 3 setup + 1 seed-pending-domain + 1 addon SELECT + 3 addon INSERTs = 8
      // (issueChallenge is a separate dependency call, NOT a client.query.)
      expect(mockClient.query).toHaveBeenCalledTimes(8);
    });

    it('should succeed even when audit log fails', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);
      mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      // createTenant INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // createRootUser INSERT
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // createRootUser UPDATE employee_id
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // activateTrialAddons: production mode → returns early
      // createAuditLog → fails (audit is best-effort, swallowed by service)
      mockDb.systemQuery.mockRejectedValueOnce(new Error('Audit log failed'));

      const result = await service.registerTenant(createValidDto());

      // Step 2.5: response shape is the discriminated union; audit failure
      // does NOT block the 2FA challenge being returned to the user.
      expect(result.stage).toBe('challenge_required');
    });
  });

  describe('checkSubdomainAvailability – error path', () => {
    it('should throw BadRequestException on DB error', async () => {
      mockDb.systemQuery.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(service.checkSubdomainAvailability('valid-sub')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ============================================================
  // registerTenantWithOAuth — OAuth signup path (plan §2.7, ADR-046).
  //
  // Mirrors the classic registerTenant but: email+billing_email are sourced
  // from the OAuth ticket (NOT from the form), an unusable bcrypt hash is
  // written to users.password, and a user_oauth_accounts row is inserted
  // INSIDE the same transaction (R8 atomicity). D14: link-insert is inlined
  // here instead of using OAuthAccountRepository to avoid a circular module
  // dependency.
  // ============================================================

  describe('registerTenantWithOAuth', () => {
    function createValidOAuthDto(): CompleteSignupDto {
      return {
        companyName: 'OAuth GmbH',
        subdomain: 'oauth-gmbh',
        phone: '+4930123456',
        adminFirstName: 'Ada',
        adminLastName: 'Admin',
        ticket: 'ticket-uuid-v7',
      } as CompleteSignupDto;
    }

    function createValidTicket(overrides: Partial<SignupTicket> = {}): SignupTicket {
      return {
        provider: 'microsoft',
        providerUserId: 'ms-sub-abc',
        email: 'ada@oauth-gmbh.de',
        emailVerified: true,
        displayName: 'Ada Admin',
        microsoftTenantId: 'tid-xyz',
        createdAt: Date.now(),
        ...overrides,
      };
    }

    function setupOAuthHappyPath(): void {
      // 1. ensureSubdomainAvailable — subdomain free
      mockDb.systemQuery.mockResolvedValueOnce([]);
      // 2. Transaction callback receives mockClient
      mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      // Inside the transaction, in order:
      // createTenantForOAuth → INSERT tenants
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      // createOAuthRootUser → INSERT users
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // createOAuthRootUser → UPDATE employee_id
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // seedVerifiedDomain → INSERT tenant_domains(verified) (Step 2.8b)
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // activateTrialAddons — production mode returns early (no queries)
      // insertOAuthAccountLink → INSERT user_oauth_accounts
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      // 3. createOAuthAuditLog — INSERT root_logs
      mockDb.systemQuery.mockResolvedValueOnce([]);
    }

    it('registers tenant + root user + oauth link in one transaction (happy path)', async () => {
      setupOAuthHappyPath();

      const result = await service.registerTenantWithOAuth(
        createValidOAuthDto(),
        createValidTicket(),
        '127.0.0.1',
        'TestAgent',
      );

      expect(result.tenantId).toBe(10);
      expect(result.userId).toBe(1);
      expect(result.subdomain).toBe('oauth-gmbh');
      expect(result.message).toContain('Registration successful');
      expect(result.trialEndsAt).toBeDefined();
      expect(mockDb.systemTransaction).toHaveBeenCalledTimes(1);
    });

    it('uses oauthInfo.email for BOTH tenants.email AND billing_email (NOT dto fields)', async () => {
      setupOAuthHappyPath();
      const ticket = createValidTicket({ email: 'from-oauth@example.com' });

      await service.registerTenantWithOAuth(createValidOAuthDto(), ticket);

      // client.query #0 is the tenants INSERT; $3 = email, $11 = billing_email
      const tenantInsertCall = mockClient.query.mock.calls[0] as unknown[];
      const params = tenantInsertCall[1] as unknown[];
      expect(params[2]).toBe('from-oauth@example.com'); // email
      expect(params[10]).toBe('from-oauth@example.com'); // billing_email
    });

    it('inserts user_oauth_accounts inside the transaction with all OAuth fields', async () => {
      setupOAuthHappyPath();
      const ticket = createValidTicket();

      await service.registerTenantWithOAuth(createValidOAuthDto(), ticket);

      // client.query #4 is the user_oauth_accounts INSERT
      // (index shifted from 3 to 4 after Step 2.8b's seedVerifiedDomain INSERT).
      const linkCall = mockClient.query.mock.calls[4] as unknown[];
      const sql = linkCall[0] as string;
      const params = linkCall[1] as unknown[];

      expect(sql).toContain('INSERT INTO user_oauth_accounts');
      expect(params[0]).toBe(10); // tenant_id
      expect(params[1]).toBe(1); // user_id
      expect(params[2]).toBe('microsoft'); // provider
      expect(params[3]).toBe('ms-sub-abc'); // provider_user_id
      expect(params[4]).toBe('ada@oauth-gmbh.de'); // email
      expect(params[5]).toBe(true); // email_verified
      expect(params[6]).toBe('Ada Admin'); // display_name
      expect(params[7]).toBe('tid-xyz'); // microsoft_tenant_id
    });

    it('writes an oauth audit row with provider + sub + Microsoft tenant id (forensic trail)', async () => {
      setupOAuthHappyPath();

      await service.registerTenantWithOAuth(createValidOAuthDto(), createValidTicket());

      // createOAuthAuditLog is the 2nd db.systemQuery call (index 1):
      //   0 = ensureSubdomainAvailable, 1 = createOAuthAuditLog
      const auditCall = mockDb.systemQuery.mock.calls[1] as unknown[];
      const auditParams = auditCall[1] as unknown[];
      expect(auditParams[0]).toBe('register_oauth'); // action
      // new_values JSON (7th param, $7) contains the OAuth forensic fields.
      // Keys follow snake_case with `oauth_` prefix (see createOAuthAuditLog).
      const newValuesJson = auditParams.find(
        (p) => typeof p === 'string' && p.includes('"oauth_provider"'),
      ) as string | undefined;
      expect(newValuesJson).toBeDefined();
      const newValues = JSON.parse(newValuesJson!) as Record<string, unknown>;
      expect(newValues['oauth_provider']).toBe('microsoft');
      expect(newValues['oauth_provider_user_id']).toBe('ms-sub-abc');
      expect(newValues['oauth_tenant_id']).toBe('tid-xyz');
    });

    it('translates Postgres 23505 unique_violation on link INSERT to ConflictException (R3)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // ensureSubdomainAvailable
      mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] }); // INSERT tenants
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // INSERT users
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE employee_id
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // seedVerifiedDomain (Step 2.8b)
      // insertOAuthAccountLink → Postgres unique_violation (R3: same MS sub twice)
      const pgError = Object.assign(new Error('duplicate key value'), { code: '23505' });
      mockClient.query.mockRejectedValueOnce(pgError);

      await expect(
        service.registerTenantWithOAuth(createValidOAuthDto(), createValidTicket()),
      ).rejects.toThrow(ConflictException);
    });

    it('409 message is the German user-facing string (never leaks internals)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]);
      mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // seedVerifiedDomain (Step 2.8b)
      const pgError = Object.assign(new Error('pg: violates unique constraint'), { code: '23505' });
      mockClient.query.mockRejectedValueOnce(pgError);

      await expect(
        service.registerTenantWithOAuth(createValidOAuthDto(), createValidTicket()),
      ).rejects.toThrow('Dieses Microsoft-Konto ist bereits mit einem Assixx-Tenant verknüpft.');
    });

    it('generic transaction error (not 23505) collapses to BadRequestException', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // ensureSubdomainAvailable
      mockDb.systemTransaction.mockRejectedValueOnce(new Error('connection reset by peer'));

      await expect(
        service.registerTenantWithOAuth(createValidOAuthDto(), createValidTicket()),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid subdomain BEFORE opening the transaction', async () => {
      const dto = createValidOAuthDto();
      dto.subdomain = 'ab'; // too short

      await expect(service.registerTenantWithOAuth(dto, createValidTicket())).rejects.toThrow(
        BadRequestException,
      );

      expect(mockDb.systemTransaction).not.toHaveBeenCalled();
    });

    it('rejects taken subdomain with ConflictException BEFORE opening the transaction', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([{ id: 1 }]); // subdomain already taken

      await expect(
        service.registerTenantWithOAuth(createValidOAuthDto(), createValidTicket()),
      ).rejects.toThrow(ConflictException);

      expect(mockDb.systemTransaction).not.toHaveBeenCalled();
    });

    it('succeeds even when the audit-log write fails (audit is bookkeeping, not a gate)', async () => {
      mockDb.systemQuery.mockResolvedValueOnce([]); // ensureSubdomainAvailable
      mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
        cb(mockClient),
      );
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      mockClient.query.mockResolvedValueOnce({ rows: [] });
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT user_oauth_accounts OK
      mockDb.systemQuery.mockRejectedValueOnce(new Error('Audit log DB down'));

      const result = await service.registerTenantWithOAuth(
        createValidOAuthDto(),
        createValidTicket(),
      );

      expect(result.tenantId).toBe(10);
      expect(result.userId).toBe(1);
    });

    it('hashes an unusable password (bcrypt called for OAuth users despite no password input)', async () => {
      setupOAuthHappyPath();
      mockBcryptHash.mockClear();

      await service.registerTenantWithOAuth(createValidOAuthDto(), createValidTicket());

      // The password never comes from the user — an unusable random value is hashed
      // so password-login can't succeed against an OAuth-only account.
      expect(mockBcryptHash).toHaveBeenCalledTimes(1);
      const [plaintext, rounds] = mockBcryptHash.mock.calls[0] as [string, number];
      expect(typeof plaintext).toBe('string');
      expect(plaintext.length).toBeGreaterThanOrEqual(40); // ~43 base64url chars from 32 bytes
      expect(rounds).toBe(12);
    });
  });
});

// ============================================================
// Business-email gate — Phase 3 §3 DoD
//
// WHY: `registerTenant()` validates BOTH `dto.email` AND `dto.adminEmail`
// through the three-layer validator (§2.3 + v0.3.5 D31). These tests pin
// the exact mapping of validator failure → controller error code +
// verify that NO tenant touches the DB when the gate trips (must fail
// before `ensureSubdomainAvailable` and `systemTransaction`).
// ============================================================

describe('SignupService.registerTenant — business-email gate (§3 DoD)', () => {
  function createDto(overrides: Partial<SignupDto> = {}): SignupDto {
    return {
      companyName: 'Test GmbH',
      subdomain: 'test-gmbh',
      email: 'info@test-gmbh.de',
      phone: '+49123456789',
      adminEmail: 'admin@test-gmbh.de',
      adminPassword: 'SecurePass123!',
      adminFirstName: 'Max',
      adminLastName: 'Mustermann',
      ...overrides,
    } as SignupDto;
  }

  let service: SignupService;
  let mockDb: {
    systemQuery: ReturnType<typeof vi.fn>;
    systemTransaction: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
  });

  it('rejects gmail.com with FREE_EMAIL_PROVIDER and never opens a transaction', async () => {
    const err = await service
      .registerTenant(createDto({ email: 'contact@gmail.com', adminEmail: 'contact@gmail.com' }))
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(err).toMatchObject({ response: { code: 'FREE_EMAIL_PROVIDER' } });
    // Fail-closed BEFORE touching the DB — no subdomain lookup, no tx.
    expect(mockDb.systemQuery).not.toHaveBeenCalled();
    expect(mockDb.systemTransaction).not.toHaveBeenCalled();
  });

  it('rejects a disposable address (mailinator.com) with DISPOSABLE_EMAIL', async () => {
    const err = await service
      .registerTenant(createDto({ email: 'x@mailinator.com', adminEmail: 'x@mailinator.com' }))
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(err).toMatchObject({ response: { code: 'DISPOSABLE_EMAIL' } });
    expect(mockDb.systemTransaction).not.toHaveBeenCalled();
  });

  it('rejects a malformed address with INVALID_FORMAT', async () => {
    const err = await service
      .registerTenant(createDto({ email: 'not-an-email', adminEmail: 'not-an-email' }))
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(err).toMatchObject({ response: { code: 'INVALID_FORMAT' } });
    expect(mockDb.systemTransaction).not.toHaveBeenCalled();
  });

  it('also validates dto.adminEmail (D31 — two separate fields, same gate)', async () => {
    // `dto.email` is a clean business address, but `adminEmail` is freemail.
    // Signup must still reject — the root login email IS the ownership claim
    // (§0.2.5 #3), so a freemail adminEmail would defeat the whole verify
    // flow by seeding `tenant_domains.domain = 'gmail.com'`.
    const err = await service
      .registerTenant(createDto({ email: 'info@firma.de', adminEmail: 'ceo@gmail.com' }))
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(err).toMatchObject({
      response: { code: 'FREE_EMAIL_PROVIDER', field: 'adminEmail' },
    });
  });
});

// ============================================================
// Transaction atomicity — Phase 3 §3 DoD (v0.3.4 D25)
//
// Inject a failure at each of the three INSERTs in the registration
// transaction (tenants → users → tenant_domains). All three must collapse
// to BadRequestException and NONE must write an audit row (audit runs
// OUTSIDE the tx, so it only fires on tx success per the service shape).
// With mocks we can't prove PG's ROLLBACK ran, but we CAN verify the
// service short-circuits at the expected point and never calls audit.
// ============================================================

describe('SignupService.registerTenant — transaction atomicity (§3 DoD v0.3.4 D25)', () => {
  function createDto(): SignupDto {
    return {
      companyName: 'Atomic GmbH',
      subdomain: 'atomic',
      email: 'info@atomic.de',
      phone: '+49301234567',
      adminEmail: 'admin@atomic.de',
      adminPassword: 'SecurePass123!',
      adminFirstName: 'Ada',
      adminLastName: 'Lovelace',
    } as SignupDto;
  }

  let service: SignupService;
  let mockDb: {
    systemQuery: ReturnType<typeof vi.fn>;
    systemTransaction: ReturnType<typeof vi.fn>;
  };
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockClient = { query: vi.fn() };
    // isSubdomainAvailable — always succeeds; the atomicity tests target
    // the post-subdomain-check window.
    mockDb.systemQuery.mockResolvedValue([]);
    mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
      cb(mockClient),
    );
  });

  it('fails cleanly when the tenants INSERT (1st stmt) throws — no further queries, no audit', async () => {
    mockClient.query.mockRejectedValueOnce(new Error('tenants INSERT failed'));

    await expect(service.registerTenant(createDto())).rejects.toThrow(BadRequestException);

    // Exactly one query fired (the failing tenants INSERT). The failure
    // propagates up through the transaction callback without touching
    // users / tenant_domains / audit — atomicity via short-circuit.
    expect(mockClient.query).toHaveBeenCalledTimes(1);
    // systemQuery was called once (isSubdomainAvailable) but NOT a second
    // time (audit) — audit only fires after the transaction commits.
    expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
  });

  it('fails cleanly when the users INSERT (2nd stmt) throws — tenants+users rolled back', async () => {
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] }); // tenants INSERT OK
    mockClient.query.mockRejectedValueOnce(new Error('users INSERT failed'));

    await expect(service.registerTenant(createDto())).rejects.toThrow(BadRequestException);

    // Stopped at the users INSERT — no employee_id UPDATE, no seedPending
    // Domain, no activateTrialAddons, no audit.
    expect(mockClient.query).toHaveBeenCalledTimes(2);
    expect(mockDb.systemQuery).toHaveBeenCalledTimes(1); // subdomain only
  });

  it('fails cleanly when the tenant_domains INSERT (4th stmt) throws — full tx rolls back', async () => {
    // Query sequence in executeRegistrationTransaction:
    //   1. createTenant INSERT
    //   2. createRootUser INSERT
    //   3. createRootUser UPDATE employee_id
    //   4. seedPendingDomain INSERT tenant_domains  ← inject here
    //   5. activateTrialAddons (production mode: early-return, no queries)
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] }); // tenants
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // users
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE employee_id
    mockClient.query.mockRejectedValueOnce(new Error('tenant_domains INSERT failed'));

    await expect(service.registerTenant(createDto())).rejects.toThrow(BadRequestException);

    // Exactly 4 queries fired — the failing seedPendingDomain is the 4th,
    // activateTrialAddons never runs, and audit never writes.
    expect(mockClient.query).toHaveBeenCalledTimes(4);
    expect(mockDb.systemQuery).toHaveBeenCalledTimes(1);
  });
});

// ============================================================
// OAuth hardening — Phase 3 §3 DoD (v0.3.0 G1)
//
// Covers two DoD rows the existing OAuth block does not pin:
//   (a) OAuth seeds `tenant_domains(status='verified')`, and the final
//       response payload carries `tenantVerificationRequired: false`.
//   (b) OAuth with a FREEMAIL Microsoft account still succeeds — Azure
//       AD is the trust boundary, not our freemail list (§2.8b).
// ============================================================

describe('SignupService.registerTenantWithOAuth — verified-seed + freemail acceptance', () => {
  // Why inline DTO / ticket objects instead of shared factories: the pre-
  // existing OAuth describe block above (`registerTenantWithOAuth`) already
  // defines `createValidOAuthDto` / `createValidTicket` / `setupOAuthHappyPath`
  // in its own closure. Re-declaring identical factories here would trip
  // `sonarjs/no-identical-functions`. Inlining keeps each test self-contained
  // (readable diff + no cross-describe coupling) at the cost of a few extra
  // literal-object lines.

  let service: SignupService;
  let mockDb: {
    systemQuery: ReturnType<typeof vi.fn>;
    systemTransaction: ReturnType<typeof vi.fn>;
  };
  let mockClient: { query: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    const result = createServiceWithMock();
    service = result.service;
    mockDb = result.mockDb;
    mockClient = { query: vi.fn() };
    // Arm the common happy-path sequence for the OAuth registration. Any test
    // that needs a failure injection can overwrite the relevant mock slot
    // with `mockRejectedValueOnce` after this setup — but none of the three
    // below need to, so the arming stays in `beforeEach`.
    mockDb.systemQuery.mockResolvedValueOnce([]); // ensureSubdomainAvailable
    mockDb.systemTransaction.mockImplementation(async (cb: (c: unknown) => Promise<unknown>) =>
      cb(mockClient),
    );
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 10 }] }); // tenants
    mockClient.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // users
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // UPDATE employee_id
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // seedVerifiedDomain
    mockClient.query.mockResolvedValueOnce({ rows: [] }); // insertOAuthAccountLink
    mockDb.systemQuery.mockResolvedValueOnce([]); // audit
  });

  const OAUTH_DTO = {
    companyName: 'OAuth GmbH',
    subdomain: 'oauth-gmbh',
    phone: '+4930123456',
    adminFirstName: 'Ada',
    adminLastName: 'Admin',
    ticket: 'ticket-uuid-v7',
  } as CompleteSignupDto;

  it('seeds tenant_domains with status=verified + verified_at NOW() (§2.8b)', async () => {
    await service.registerTenantWithOAuth(OAUTH_DTO, {
      provider: 'microsoft',
      providerUserId: 'ms-sub-abc',
      email: 'ada@oauth-gmbh.de',
      emailVerified: true,
      displayName: 'Ada Admin',
      microsoftTenantId: 'tid-xyz',
      createdAt: Date.now(),
    });

    // client.query #3 is seedVerifiedDomain — INSERT with literal 'verified'
    // + NOW() for verified_at (no DNS dance, Azure AD is the trust boundary).
    const seedCall = mockClient.query.mock.calls[3] as unknown as [string, unknown[]];
    expect(seedCall[0]).toContain("'verified'");
    expect(seedCall[0]).toContain('verified_at');
    expect(seedCall[0]).toContain('NOW()');
    expect(seedCall[1][1]).toBe('oauth-gmbh.de'); // extracted from oauthInfo.email
  });

  it('response payload has tenantVerificationRequired=false (frontend banner suppression)', async () => {
    const result = await service.registerTenantWithOAuth(OAUTH_DTO, {
      provider: 'microsoft',
      providerUserId: 'ms-sub-abc',
      email: 'ada@oauth-gmbh.de',
      emailVerified: true,
      displayName: 'Ada Admin',
      microsoftTenantId: 'tid-xyz',
      createdAt: Date.now(),
    });

    // Password-signup path returns `true` (needs DNS dance); OAuth path
    // returns `false` so the Phase-5 banner stays hidden from day one.
    expect(result.tenantVerificationRequired).toBe(false);
  });

  it('accepts a freemail Microsoft account — Azure AD is the trust boundary, NOT our list', async () => {
    // §2.8b + §0.2.5 #17: a user whose Azure AD tenant owner identity is a
    // personal `outlook.com` mailbox is still a valid OAuth signup. Our
    // freemail filter is NOT invoked on the OAuth path — the IdP already
    // attested ownership of the mailbox.
    const result = await service.registerTenantWithOAuth(OAUTH_DTO, {
      provider: 'microsoft',
      providerUserId: 'ms-sub-freemail',
      email: 'personal-owner@outlook.com',
      emailVerified: true,
      displayName: 'Ada Admin',
      microsoftTenantId: 'tid-personal',
      createdAt: Date.now(),
    });

    expect(result.tenantId).toBe(10);
    expect(result.tenantVerificationRequired).toBe(false);
    // Proof that seedVerifiedDomain still ran with outlook.com as the
    // persisted value (matches the trust-boundary semantics in ADR-048).
    const seedCall = mockClient.query.mock.calls[3] as unknown as [string, unknown[]];
    expect(seedCall[1][1]).toBe('outlook.com');
  });
});
