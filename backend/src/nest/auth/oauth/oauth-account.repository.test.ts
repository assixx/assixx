/**
 * OAuthAccountRepository — unit tests.
 *
 * Scope (plan §3):
 *   - findLinkedByProviderSub() uses system pool (pre-auth, no CLS tenant) + is_active filter
 *   - createLink() runs on the passed-in PoolClient (inside caller's transaction)
 *   - updateLastLogin() uses queryAsTenant with explicit tenantId (post-match, pre-JWT)
 *
 * We assert both behaviour (correct rows returned) AND SQL shape (is_active,
 * provider cast, tenant-scope) — the pool-selection rules are security-critical
 * per ADR-019; regressions here cause silent cross-tenant leaks.
 */
import { IS_ACTIVE } from '@assixx/shared/constants';
import type { PoolClient } from 'pg';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../../database/database.service.js';
import { OAuthAccountRepository, type OAuthAccountRow } from './oauth-account.repository.js';
import type { OAuthUserInfo } from './oauth.types.js';

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TENANT_ID = 42;
const USER_ID = 7;

function createMockDb(): {
  systemQueryOne: ReturnType<typeof vi.fn>;
  queryAsTenant: ReturnType<typeof vi.fn>;
} {
  return {
    systemQueryOne: vi.fn(),
    queryAsTenant: vi.fn().mockResolvedValue([]),
  };
}

function createMockClient(): { query: ReturnType<typeof vi.fn> } {
  return { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
}

function createAccountRow(overrides?: Partial<OAuthAccountRow>): OAuthAccountRow {
  return {
    id: '019d9707-1896-74fd-821e-2a2d1bd41660',
    tenant_id: TENANT_ID,
    user_id: USER_ID,
    provider: 'microsoft',
    provider_user_id: 'ms-sub-abc',
    email: 'admin@tenant.de',
    email_verified: true,
    display_name: 'Admin Example',
    microsoft_tenant_id: '00000000-0000-0000-0000-000000000001',
    linked_at: new Date('2026-04-16T10:00:00Z'),
    last_login_at: null,
    is_active: IS_ACTIVE.ACTIVE,
    created_at: new Date('2026-04-16T10:00:00Z'),
    updated_at: new Date('2026-04-16T10:00:00Z'),
    ...overrides,
  };
}

function createOAuthUserInfo(overrides?: Partial<OAuthUserInfo>): OAuthUserInfo {
  return {
    providerUserId: 'ms-sub-abc',
    email: 'admin@tenant.de',
    emailVerified: true,
    displayName: 'Admin Example',
    microsoftTenantId: '00000000-0000-0000-0000-000000000001',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('OAuthAccountRepository', () => {
  let repo: OAuthAccountRepository;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    repo = new OAuthAccountRepository(mockDb as unknown as DatabaseService);
  });

  // ─── findLinkedByProviderSub() ──────────────────────────────────────────

  describe('findLinkedByProviderSub()', () => {
    it('returns the row when Redis hit — happy path', async () => {
      const row = createAccountRow();
      mockDb.systemQueryOne.mockResolvedValueOnce(row);

      const result = await repo.findLinkedByProviderSub('microsoft', 'ms-sub-abc');

      expect(result).toEqual(row);
    });

    it('returns null when no link exists for that (provider, sub)', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);
      const result = await repo.findLinkedByProviderSub('microsoft', 'unknown-sub');
      expect(result).toBeNull();
    });

    it('uses systemQueryOne (BYPASSRLS pool) — tenant unknown pre-match (ADR-019)', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);
      await repo.findLinkedByProviderSub('microsoft', 'ms-sub-abc');
      expect(mockDb.systemQueryOne).toHaveBeenCalledTimes(1);
    });

    it('SQL filters by `is_active = IS_ACTIVE.ACTIVE` (no soft-deleted rows)', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);
      await repo.findLinkedByProviderSub('microsoft', 'ms-sub-abc');
      const sql = mockDb.systemQueryOne.mock.calls[0]?.[0] as string;
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('SQL binds both provider (cast to oauth_provider) and provider_user_id', async () => {
      mockDb.systemQueryOne.mockResolvedValueOnce(null);
      await repo.findLinkedByProviderSub('microsoft', 'ms-sub-abc');
      const sql = mockDb.systemQueryOne.mock.calls[0]?.[0] as string;
      const params = mockDb.systemQueryOne.mock.calls[0]?.[1] as unknown[];
      expect(sql).toContain('provider = $1::oauth_provider');
      expect(sql).toContain('provider_user_id = $2');
      expect(params).toEqual(['microsoft', 'ms-sub-abc']);
    });
  });

  // ─── createLink() ────────────────────────────────────────────────────────

  describe('createLink()', () => {
    it('runs INSERT on the caller-provided PoolClient (inside parent txn)', async () => {
      const client = createMockClient();
      await repo.createLink(
        client as unknown as PoolClient,
        TENANT_ID,
        USER_ID,
        'microsoft',
        createOAuthUserInfo(),
      );
      expect(client.query).toHaveBeenCalledTimes(1);
      // DatabaseService wrappers MUST NOT be invoked — the parent transaction
      // already set app.tenant_id on this client (ADR-019).
      expect(mockDb.systemQueryOne).not.toHaveBeenCalled();
      expect(mockDb.queryAsTenant).not.toHaveBeenCalled();
    });

    it('INSERTs only the identity columns; leaves id / linked_at / timestamps to DB defaults', async () => {
      const client = createMockClient();
      await repo.createLink(
        client as unknown as PoolClient,
        TENANT_ID,
        USER_ID,
        'microsoft',
        createOAuthUserInfo(),
      );
      const sql = client.query.mock.calls[0]?.[0] as string;
      // Explicit columns
      expect(sql).toContain('tenant_id');
      expect(sql).toContain('provider_user_id');
      expect(sql).toContain('microsoft_tenant_id');
      // DB-defaulted columns MUST NOT appear in the INSERT column list
      expect(sql).not.toMatch(/INSERT INTO[\s\S]*\bid\b[\s\S]*VALUES/);
      expect(sql).not.toContain('linked_at');
      expect(sql).not.toContain('created_at');
      expect(sql).not.toContain('updated_at');
    });

    it('binds all OAuthUserInfo fields in parameter order', async () => {
      const client = createMockClient();
      const info = createOAuthUserInfo({
        providerUserId: 'sub-123',
        email: 'foo@bar.de',
        emailVerified: true,
        displayName: 'Max Müller',
        microsoftTenantId: 'tid-abc',
      });
      await repo.createLink(client as unknown as PoolClient, TENANT_ID, USER_ID, 'microsoft', info);
      const params = client.query.mock.calls[0]?.[1] as unknown[];
      expect(params).toEqual([
        TENANT_ID,
        USER_ID,
        'microsoft',
        'sub-123',
        'foo@bar.de',
        true,
        'Max Müller',
        'tid-abc',
      ]);
    });
  });

  // ─── updateLastLogin() ──────────────────────────────────────────────────

  describe('updateLastLogin()', () => {
    it('uses queryAsTenant with the explicit tenantId (post-match, pre-JWT)', async () => {
      await repo.updateLastLogin(TENANT_ID, USER_ID, 'microsoft');
      expect(mockDb.queryAsTenant).toHaveBeenCalledTimes(1);
      const tenantArg = mockDb.queryAsTenant.mock.calls[0]?.[2];
      expect(tenantArg).toBe(TENANT_ID);
    });

    it('SQL filters by user_id + provider + is_active = ACTIVE', async () => {
      await repo.updateLastLogin(TENANT_ID, USER_ID, 'microsoft');
      const sql = mockDb.queryAsTenant.mock.calls[0]?.[0] as string;
      expect(sql).toContain('user_id = $1');
      expect(sql).toContain('provider = $2::oauth_provider');
      expect(sql).toContain(`is_active = ${IS_ACTIVE.ACTIVE}`);
    });

    it('updates last_login_at AND updated_at to NOW()', async () => {
      await repo.updateLastLogin(TENANT_ID, USER_ID, 'microsoft');
      const sql = mockDb.queryAsTenant.mock.calls[0]?.[0] as string;
      expect(sql).toContain('last_login_at = NOW()');
      expect(sql).toContain('updated_at = NOW()');
    });
  });
});
