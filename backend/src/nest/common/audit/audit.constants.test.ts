import { describe, expect, it } from 'vitest';

import {
  CURRENT_USER_ENDPOINTS,
  CURRENT_USER_THROTTLE_MS,
  EXCLUDED_PATHS,
  EXCLUDED_PREFIXES,
  LIST_ACTION_THROTTLE_MS,
  PAGE_INIT_ENDPOINTS,
  REFERENCE_DATA_ENDPOINTS,
  RESOURCE_TABLE_MAP,
  SENSITIVE_FIELDS,
  SKIPPED_GET_SUFFIXES,
} from './audit.constants.js';

describe('SENSITIVE_FIELDS', () => {
  it('should contain password-related fields', () => {
    expect(SENSITIVE_FIELDS).toContain('password');
    expect(SENSITIVE_FIELDS).toContain('currentpassword');
    expect(SENSITIVE_FIELDS).toContain('newpassword');
    expect(SENSITIVE_FIELDS).toContain('confirmpassword');
    expect(SENSITIVE_FIELDS).toContain('passwordhash');
    expect(SENSITIVE_FIELDS).toContain('password_hash');
  });

  it('should contain token-related fields', () => {
    expect(SENSITIVE_FIELDS).toContain('token');
    expect(SENSITIVE_FIELDS).toContain('accesstoken');
    expect(SENSITIVE_FIELDS).toContain('refreshtoken');
    expect(SENSITIVE_FIELDS).toContain('secret');
    expect(SENSITIVE_FIELDS).toContain('apikey');
    expect(SENSITIVE_FIELDS).toContain('privatekey');
  });

  it('should contain PII/GDPR fields', () => {
    expect(SENSITIVE_FIELDS).toContain('ssn');
    expect(SENSITIVE_FIELDS).toContain('creditcard');
    expect(SENSITIVE_FIELDS).toContain('cvv');
    expect(SENSITIVE_FIELDS).toContain('pin');
  });

  it('should have all entries in lowercase for sanitizeData() comparison', () => {
    for (const field of SENSITIVE_FIELDS) {
      expect(field).toBe(field.toLowerCase());
    }
  });

  it('should not be empty', () => {
    expect(SENSITIVE_FIELDS.length).toBeGreaterThan(0);
  });
});

describe('RESOURCE_TABLE_MAP', () => {
  it('should map user to users table', () => {
    expect(RESOURCE_TABLE_MAP['user']).toEqual({
      table: 'users',
      nameField: 'username',
    });
  });

  it('should map all expected resource types', () => {
    const expectedKeys = [
      'user',
      'department',
      'team',
      'area',
      'asset',
      'blackboard',
      'calendar',
      'document',
      'kvp',
      'survey',
      'notification',
      'shift',
      'shift-plan',
      'addon',
      'setting',
      'role',
      'admin-permission',
      'tenant',
    ];
    for (const key of expectedKeys) {
      expect(RESOURCE_TABLE_MAP[key]).toBeDefined();
      expect(typeof RESOURCE_TABLE_MAP[key].table).toBe('string');
      expect(typeof RESOURCE_TABLE_MAP[key].nameField).toBe('string');
    }
  });

  it('should have unique table names', () => {
    const tables = Object.values(RESOURCE_TABLE_MAP).map((v) => v.table);
    const uniqueTables = new Set(tables);
    expect(uniqueTables.size).toBe(tables.length);
  });
});

describe('EXCLUDED_PATHS', () => {
  it('should contain health check paths', () => {
    expect(EXCLUDED_PATHS).toContain('/health');
    expect(EXCLUDED_PATHS).toContain('/api/v2/health');
  });

  it('should contain metrics paths', () => {
    expect(EXCLUDED_PATHS).toContain('/metrics');
    expect(EXCLUDED_PATHS).toContain('/api/v2/metrics');
  });

  it('should contain favicon', () => {
    expect(EXCLUDED_PATHS).toContain('/favicon.ico');
  });

  it('should exclude SSE connection-ticket noise', () => {
    expect(EXCLUDED_PATHS).toContain('/auth/connection-ticket');
    expect(EXCLUDED_PATHS).toContain('/api/v2/auth/connection-ticket');
  });

  it('should exclude cosmetic theme toggle', () => {
    expect(EXCLUDED_PATHS).toContain('/settings/user/theme');
    expect(EXCLUDED_PATHS).toContain('/api/v2/settings/user/theme');
  });
});

describe('EXCLUDED_PREFIXES', () => {
  it('should contain static asset prefixes', () => {
    expect(EXCLUDED_PREFIXES).toContain('/static/');
    expect(EXCLUDED_PREFIXES).toContain('/assets/');
    expect(EXCLUDED_PREFIXES).toContain('/_app/');
  });

  it('should exclude chat for GDPR compliance', () => {
    expect(EXCLUDED_PREFIXES).toContain('/chat');
    expect(EXCLUDED_PREFIXES).toContain('/api/v2/chat');
  });
});

describe('SKIPPED_GET_SUFFIXES', () => {
  it('should contain data aggregation suffixes', () => {
    expect(SKIPPED_GET_SUFFIXES).toContain('/stats');
    expect(SKIPPED_GET_SUFFIXES).toContain('/count');
    expect(SKIPPED_GET_SUFFIXES).toContain('/search');
  });

  it('should NOT skip /export (security tracking)', () => {
    expect(SKIPPED_GET_SUFFIXES).not.toContain('/export');
  });

  it('should contain dashboard widget suffixes', () => {
    expect(SKIPPED_GET_SUFFIXES).toContain('/unread');
    expect(SKIPPED_GET_SUFFIXES).toContain('/upcoming');
    expect(SKIPPED_GET_SUFFIXES).toContain('/summary');
  });
});

describe('CURRENT_USER_ENDPOINTS', () => {
  it('should contain /users/me and /auth/me and /me', () => {
    expect(CURRENT_USER_ENDPOINTS).toContain('/users/me');
    expect(CURRENT_USER_ENDPOINTS).toContain('/auth/me');
    expect(CURRENT_USER_ENDPOINTS).toContain('/me');
  });
});

describe('REFERENCE_DATA_ENDPOINTS', () => {
  it('should contain reference endpoints with and without api prefix', () => {
    expect(REFERENCE_DATA_ENDPOINTS).toContain('/departments');
    expect(REFERENCE_DATA_ENDPOINTS).toContain('/api/v2/departments');
    expect(REFERENCE_DATA_ENDPOINTS).toContain('/areas');
    expect(REFERENCE_DATA_ENDPOINTS).toContain('/api/v2/areas');
  });
});

describe('PAGE_INIT_ENDPOINTS', () => {
  it('should contain auth/profile check endpoints', () => {
    expect(PAGE_INIT_ENDPOINTS).toContain('/api/v2/users/me');
    expect(PAGE_INIT_ENDPOINTS).toContain('/users/me');
  });

  it('should contain notification stats endpoints', () => {
    expect(PAGE_INIT_ENDPOINTS).toContain('/api/v2/notifications/stats/me');
    expect(PAGE_INIT_ENDPOINTS).toContain('/notifications/stats/me');
  });

  it('should contain addon check endpoints', () => {
    expect(PAGE_INIT_ENDPOINTS).toContain('/api/v2/addons/my-addons');
    expect(PAGE_INIT_ENDPOINTS).toContain('/addons/my-addons');
  });

  it('should contain E2E encryption key init endpoints', () => {
    expect(PAGE_INIT_ENDPOINTS).toContain('/api/v2/e2e/keys/me');
    expect(PAGE_INIT_ENDPOINTS).toContain('/e2e/keys/me');
    expect(PAGE_INIT_ENDPOINTS).toContain('/api/v2/e2e/escrow');
    expect(PAGE_INIT_ENDPOINTS).toContain('/e2e/escrow');
  });
});

describe('throttle constants', () => {
  it('LIST_ACTION_THROTTLE_MS should be 30 seconds', () => {
    expect(LIST_ACTION_THROTTLE_MS).toBe(30_000);
  });

  it('CURRENT_USER_THROTTLE_MS should be 30 seconds', () => {
    expect(CURRENT_USER_THROTTLE_MS).toBe(30_000);
  });
});
