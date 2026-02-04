import { describe, expect, it } from 'vitest';

import {
  buildUserName,
  extractResourceId,
  extractResourceType,
  getPathBasedAction,
  sanitizeData,
  shouldExclude,
  singularize,
} from './audit.helpers.js';

// =============================================================
// sanitizeData
// =============================================================

describe('sanitizeData', () => {
  it('should pass through normal fields', () => {
    const result = sanitizeData({ name: 'John', email: 'john@test.de' });

    expect(result).toEqual({ name: 'John', email: 'john@test.de' });
  });

  it('should redact password field', () => {
    const result = sanitizeData({ name: 'John', password: 'secret123' });

    expect(result).toEqual({ name: 'John', password: '[REDACTED]' });
  });

  it('should redact token field', () => {
    const result = sanitizeData({ token: 'abc123', userId: 1 });

    expect(result).toEqual({ token: '[REDACTED]', userId: 1 });
  });

  it('should redact ALL-CAPS keys via toLowerCase matching', () => {
    // "PASSWORD".toLowerCase() = "password" → matches "password" in SENSITIVE_FIELDS
    const result = sanitizeData({ PASSWORD: 'secret', SSN: '123-45-6789' });

    expect(result?.['PASSWORD']).toBe('[REDACTED]');
    expect(result?.['SSN']).toBe('[REDACTED]');
  });

  it('should NOT redact camelCase keys that only exist as camelCase in SENSITIVE_FIELDS', () => {
    // "accessToken".toLowerCase() = "accesstoken" but SENSITIVE_FIELDS has "accessToken" not "accesstoken"
    // This is a known limitation: Array.includes is case-sensitive, so camelCase entries
    // in SENSITIVE_FIELDS only match their exact casing, not the lowercased key.
    const result = sanitizeData({ accessToken: 'token123' });

    expect(result?.['accessToken']).toBe('token123');
  });

  it('should recursively sanitize nested objects', () => {
    const result = sanitizeData({
      user: { name: 'John', password: 'secret' },
    });

    expect(result).toEqual({
      user: { name: 'John', password: '[REDACTED]' },
    });
  });

  it('should return null for null input', () => {
    expect(sanitizeData(null)).toBeNull();
  });

  it('should return null for undefined input', () => {
    expect(sanitizeData(undefined)).toBeNull();
  });

  it('should return null for empty object', () => {
    expect(sanitizeData({})).toBeNull();
  });
});

// =============================================================
// extractResourceType
// =============================================================

describe('extractResourceType', () => {
  it('should extract and singularize resource from URL', () => {
    expect(extractResourceType('/api/v2/users/123')).toBe('user');
  });

  it('should handle URL without ID', () => {
    expect(extractResourceType('/api/v2/departments')).toBe('department');
  });

  it('should handle nested resource with mapping', () => {
    expect(extractResourceType('/api/v2/shifts/plan/2')).toBe('shift-plan');
  });

  it('should strip query string', () => {
    expect(extractResourceType('/api/v2/users?page=1')).toBe('user');
  });

  it('should return "root" for base path', () => {
    expect(extractResourceType('/api/v2/')).toBe('root');
  });
});

// =============================================================
// extractResourceId
// =============================================================

describe('extractResourceId', () => {
  it('should extract ID from params', () => {
    expect(extractResourceId('/api/v2/users/42', { id: '42' })).toBe(42);
  });

  it('should extract ID from URL when no params', () => {
    expect(extractResourceId('/api/v2/users/42', undefined)).toBe(42);
  });

  it('should return null when no numeric segment', () => {
    expect(extractResourceId('/api/v2/users', undefined)).toBeNull();
  });

  it('should return null for non-numeric param ID', () => {
    expect(extractResourceId('/api/v2/users/abc', { id: 'abc' })).toBeNull();
  });

  it('should strip query string before parsing', () => {
    expect(extractResourceId('/api/v2/users/42?tab=profile', undefined)).toBe(
      42,
    );
  });
});

// =============================================================
// singularize
// =============================================================

describe('singularize', () => {
  it('should remove trailing s', () => {
    expect(singularize('users')).toBe('user');
    expect(singularize('departments')).toBe('department');
  });

  it('should handle special case: entries → entry', () => {
    expect(singularize('entries')).toBe('entry');
  });

  it('should handle special case: categories → category', () => {
    expect(singularize('categories')).toBe('category');
  });

  it('should handle special case: activities → activity', () => {
    expect(singularize('activities')).toBe('activity');
  });

  it('should handle special case: companies → company', () => {
    expect(singularize('companies')).toBe('company');
  });

  it('should return word as-is when already singular', () => {
    expect(singularize('user')).toBe('user');
  });

  it('should lowercase the input', () => {
    expect(singularize('Users')).toBe('user');
  });
});

// =============================================================
// shouldExclude
// =============================================================

describe('shouldExclude', () => {
  it('should exclude /health endpoint', () => {
    expect(shouldExclude('/health')).toBe(true);
  });

  it('should exclude static asset paths', () => {
    expect(shouldExclude('/static/app.js')).toBe(true);
  });

  it('should exclude chat paths (GDPR)', () => {
    expect(shouldExclude('/chat/messages')).toBe(true);
    expect(shouldExclude('/api/v2/chat/rooms')).toBe(true);
  });

  it('should exclude reference data endpoints', () => {
    expect(shouldExclude('/api/v2/departments')).toBe(true);
  });

  it('should exclude page init endpoints', () => {
    expect(shouldExclude('/api/v2/users/me')).toBe(true);
  });

  it('should NOT exclude normal API paths', () => {
    expect(shouldExclude('/api/v2/kvp/suggestions')).toBe(false);
  });

  it('should strip query string before matching', () => {
    expect(shouldExclude('/health?check=1')).toBe(true);
  });
});

// =============================================================
// getPathBasedAction
// =============================================================

describe('getPathBasedAction', () => {
  it('should return "login" for auth/login path', () => {
    expect(getPathBasedAction('/api/v2/auth/login')).toBe('login');
  });

  it('should return "logout" for auth/logout path', () => {
    expect(getPathBasedAction('/api/v2/auth/logout')).toBe('logout');
  });

  it('should return "refresh" for auth/refresh path', () => {
    expect(getPathBasedAction('/api/v2/auth/refresh')).toBe('refresh');
  });

  it('should return "switch" for role-switch path', () => {
    expect(getPathBasedAction('/api/v2/role-switch')).toBe('switch');
  });

  it('should return null for normal paths', () => {
    expect(getPathBasedAction('/api/v2/users')).toBeNull();
  });
});

// =============================================================
// buildUserName
// =============================================================

describe('buildUserName', () => {
  it('should combine first and last name', () => {
    const user = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@test.de',
    } as Parameters<typeof buildUserName>[0];

    expect(buildUserName(user)).toBe('John Doe');
  });

  it('should return first name only when no last name', () => {
    const user = {
      firstName: 'John',
      email: 'john@test.de',
    } as Parameters<typeof buildUserName>[0];

    expect(buildUserName(user)).toBe('John');
  });

  it('should fallback to email when no names', () => {
    const user = { email: 'john@test.de' } as Parameters<
      typeof buildUserName
    >[0];

    expect(buildUserName(user)).toBe('john@test.de');
  });
});
