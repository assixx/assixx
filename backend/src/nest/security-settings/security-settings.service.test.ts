/**
 * SecuritySettingsService — Unit Tests
 *
 * Covers the two public methods that manage the tenant-wide
 * "allow user password change" policy:
 *
 * - `getUserPasswordChangePolicy` — reads `tenant_settings`, falls back to
 *   `false` when the row is missing (secure-by-default).
 * - `setUserPasswordChangePolicy` — UPSERTS the row inside a
 *   `tenantTransaction` and writes a `root_logs` audit entry.
 *
 * WHY mock the `tenantTransaction` seam (per ADR-018 Phase 5 pattern +
 * domains.service.test.ts reference): replacing the transaction with a
 * passthrough that invokes the callback against a `mockClient.query` spy
 * lets us assert the exact SQL shape + parameter order that the production
 * code emits, without a running Postgres.
 *
 * What is NOT covered here (Tier 2 / integration):
 * - `@Roles('root')` enforcement on the controller — lives in the API test
 * - Actual RLS isolation on `tenant_settings` — DB-level behavior
 *
 * @see ADR-018 Testing Strategy (Phase 5: service tests with mocked DB)
 * @see ADR-045 Permission Stack — Layer-1 gate
 */
import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service.js';
import {
  ALLOW_USER_PASSWORD_CHANGE_KEY,
  SECURITY_SETTINGS_CATEGORY,
} from './security-settings.constants.js';
import { SecuritySettingsService } from './security-settings.service.js';

// ============================================================
// Setup — service + mocks, reset per test
// ============================================================

interface MockClient {
  query: ReturnType<typeof vi.fn>;
}

interface MockDb {
  queryAsTenant: ReturnType<typeof vi.fn>;
  tenantTransaction: ReturnType<typeof vi.fn>;
}

interface Setup {
  service: SecuritySettingsService;
  mockDb: MockDb;
  mockClient: MockClient;
}

/**
 * Fresh service + mocks per test. `tenantTransaction` is wired as a
 * passthrough so the callback runs against the shared `mockClient.query`
 * spy — matches the domains.service.test.ts reference.
 */
function setup(): Setup {
  const mockClient: MockClient = { query: vi.fn() };
  const mockDb: MockDb = {
    queryAsTenant: vi.fn(),
    tenantTransaction: vi
      .fn()
      .mockImplementation(async (cb: (c: MockClient) => Promise<unknown>) => cb(mockClient)),
  };

  const service = new SecuritySettingsService(mockDb as unknown as DatabaseService);
  return { service, mockDb, mockClient };
}

const TENANT_ID = 42;
const USER_ID = 7;

// ============================================================
// getUserPasswordChangePolicy
// ============================================================

describe('SecuritySettingsService.getUserPasswordChangePolicy', () => {
  it('returns false (default) when no row exists', async () => {
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([]);

    const result = await service.getUserPasswordChangePolicy(TENANT_ID);

    expect(result).toBe(false);
    expect(mockDb.queryAsTenant).toHaveBeenCalledWith(
      expect.stringContaining('SELECT setting_value FROM tenant_settings'),
      [TENANT_ID, ALLOW_USER_PASSWORD_CHANGE_KEY],
      TENANT_ID,
    );
  });

  it('returns true when row has setting_value "true"', async () => {
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([{ setting_value: 'true' }]);

    const result = await service.getUserPasswordChangePolicy(TENANT_ID);

    expect(result).toBe(true);
  });

  it('returns true when row has legacy setting_value "1"', async () => {
    // Accepting '1' keeps the service resilient against rows written by
    // older code paths or manual DB edits — documented in the service
    // comment.
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([{ setting_value: '1' }]);

    const result = await service.getUserPasswordChangePolicy(TENANT_ID);

    expect(result).toBe(true);
  });

  it('returns false when row has setting_value "false"', async () => {
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([{ setting_value: 'false' }]);

    const result = await service.getUserPasswordChangePolicy(TENANT_ID);

    expect(result).toBe(false);
  });

  it('returns false when setting_value is null (fail-closed)', async () => {
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([{ setting_value: null }]);

    const result = await service.getUserPasswordChangePolicy(TENANT_ID);

    expect(result).toBe(false);
  });

  it('returns false when setting_value is any other string (fail-closed)', async () => {
    // Any non-canonical value falls to the "false" branch — matches the
    // secure-by-default principle. Prevents an accidental '' or 'maybe'
    // from leaking as truthy.
    const { service, mockDb } = setup();
    mockDb.queryAsTenant.mockResolvedValueOnce([{ setting_value: 'yes' }]);

    const result = await service.getUserPasswordChangePolicy(TENANT_ID);

    expect(result).toBe(false);
  });
});

// ============================================================
// setUserPasswordChangePolicy
// ============================================================

describe('SecuritySettingsService.setUserPasswordChangePolicy', () => {
  it('INSERTs a new row when none exists + writes audit entry', async () => {
    const { service, mockDb, mockClient } = setup();
    // SELECT existing → empty → INSERT path
    mockClient.query
      .mockResolvedValueOnce({ rows: [] }) // SELECT id — no existing row
      .mockResolvedValueOnce({ rows: [] }) // INSERT tenant_settings
      .mockResolvedValueOnce({ rows: [] }); // INSERT root_logs audit

    await service.setUserPasswordChangePolicy(TENANT_ID, USER_ID, true, '10.0.0.1', 'curl/8');

    expect(mockDb.tenantTransaction).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenCalledTimes(3);

    // Call 1: SELECT
    expect(mockClient.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('SELECT id FROM tenant_settings'),
      [TENANT_ID, ALLOW_USER_PASSWORD_CHANGE_KEY],
    );
    // Call 2: INSERT tenant_settings
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('INSERT INTO tenant_settings'),
      [TENANT_ID, ALLOW_USER_PASSWORD_CHANGE_KEY, 'true', SECURITY_SETTINGS_CATEGORY],
    );
    // Call 3: INSERT root_logs — audit entry
    expect(mockClient.query).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('INSERT INTO root_logs'),
      expect.arrayContaining([
        'security_setting_updated',
        USER_ID,
        TENANT_ID,
        'security_setting',
        expect.stringContaining('"allowed":true'),
        '10.0.0.1',
        'curl/8',
      ]),
    );
  });

  it('UPDATEs when row exists + writes audit entry', async () => {
    const { service, mockClient } = setup();
    // SELECT existing → has row → UPDATE path
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ id: 99 }] }) // SELECT id — existing row
      .mockResolvedValueOnce({ rows: [] }) // UPDATE tenant_settings
      .mockResolvedValueOnce({ rows: [] }); // INSERT root_logs audit

    await service.setUserPasswordChangePolicy(TENANT_ID, USER_ID, false, undefined, undefined);

    expect(mockClient.query).toHaveBeenCalledTimes(3);
    // Call 2: UPDATE tenant_settings — note "false" serialized value
    expect(mockClient.query).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('UPDATE tenant_settings'),
      ['false', SECURITY_SETTINGS_CATEGORY, TENANT_ID, ALLOW_USER_PASSWORD_CHANGE_KEY],
    );
  });

  it('serializes boolean true as "true" string', async () => {
    const { service, mockClient } = setup();
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await service.setUserPasswordChangePolicy(TENANT_ID, USER_ID, true, undefined, undefined);

    // INSERT call — 3rd positional arg is serialized value
    const insertCall = mockClient.query.mock.calls[1];
    expect(insertCall[1][2]).toBe('true');
  });

  it('serializes boolean false as "false" string', async () => {
    const { service, mockClient } = setup();
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await service.setUserPasswordChangePolicy(TENANT_ID, USER_ID, false, undefined, undefined);

    const insertCall = mockClient.query.mock.calls[1];
    expect(insertCall[1][2]).toBe('false');
  });

  it('passes null for ip/userAgent when undefined', async () => {
    // Explicit null (not undefined) matters: the pg driver serializes
    // undefined to the string "undefined" for text columns, which would
    // pollute the audit trail. The service's `ipAddress ?? null` guard
    // prevents that — this test locks the contract.
    const { service, mockClient } = setup();
    mockClient.query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    await service.setUserPasswordChangePolicy(TENANT_ID, USER_ID, true, undefined, undefined);

    const auditCall = mockClient.query.mock.calls[2];
    const params = auditCall[1] as unknown[];
    // Positions 5 and 6 are ip_address and user_agent
    expect(params[5]).toBeNull();
    expect(params[6]).toBeNull();
  });
});
