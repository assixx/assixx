import type { FastifyRequest } from 'fastify';
import { describe, expect, it } from 'vitest';

import {
  buildAuditChanges,
  buildUserName,
  determineAction,
  extractDetailedErrorMessage,
  extractIpAddress,
  extractLoginEmail,
  extractNameFromData,
  extractResourceId,
  extractResourceName,
  extractResourceType,
  extractResourceUuid,
  getPathBasedAction,
  isAuthEndpoint,
  isCurrentUserEndpoint,
  sanitizeData,
  shouldExclude,
  shouldSkipGetRequest,
  singularize,
} from './audit.helpers.js';

// =============================================================
// Mock Factory
// =============================================================

function createMockRequest(
  overrides?: Partial<{
    url: string;
    body: unknown;
    query: unknown;
    params: Record<string, string>;
    headers: Record<string, string | string[]>;
    ip: string;
  }>,
): FastifyRequest {
  return {
    url: '/api/v2/users',
    body: null,
    query: {},
    params: {},
    headers: {},
    ip: '192.168.1.1',
    ...overrides,
  } as unknown as FastifyRequest;
}

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

  it('should redact camelCase keys via toLowerCase matching', () => {
    // "accessToken".toLowerCase() = "accesstoken" → matches "accesstoken" in SENSITIVE_FIELDS
    const result = sanitizeData({ accessToken: 'token123' });

    expect(result?.['accessToken']).toBe('[REDACTED]');
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

  it('should return null for UUID in URL (not a numeric ID)', () => {
    expect(
      extractResourceId(
        '/api/v2/tpm/plans/019c9088-c3da-751f-ad4f-06ef7c086342',
        undefined,
      ),
    ).toBeNull();
  });

  it('should strip query string before parsing', () => {
    expect(extractResourceId('/api/v2/users/42?tab=profile', undefined)).toBe(
      42,
    );
  });
});

// =============================================================
// extractResourceUuid
// =============================================================

describe('extractResourceUuid', () => {
  it('should extract UUID from params', () => {
    expect(
      extractResourceUuid(
        '/api/v2/tpm/plans/019c9088-c3da-751f-ad4f-06ef7c086342',
        {
          uuid: '019c9088-c3da-751f-ad4f-06ef7c086342',
        },
      ),
    ).toBe('019c9088-c3da-751f-ad4f-06ef7c086342');
  });

  it('should extract UUID from URL when no params', () => {
    expect(
      extractResourceUuid(
        '/api/v2/tpm/plans/019c9088-c3da-751f-ad4f-06ef7c086342',
        undefined,
      ),
    ).toBe('019c9088-c3da-751f-ad4f-06ef7c086342');
  });

  it('should extract UUID from id param', () => {
    expect(
      extractResourceUuid(
        '/api/v2/tpm/plans/019c9088-c3da-751f-ad4f-06ef7c086342',
        {
          id: '019c9088-c3da-751f-ad4f-06ef7c086342',
        },
      ),
    ).toBe('019c9088-c3da-751f-ad4f-06ef7c086342');
  });

  it('should return null when no UUID present', () => {
    expect(extractResourceUuid('/api/v2/users/42', { id: '42' })).toBeNull();
  });

  it('should return null for empty path', () => {
    expect(extractResourceUuid('/api/v2/users', undefined)).toBeNull();
  });

  it('should strip query string', () => {
    expect(
      extractResourceUuid(
        '/api/v2/tpm/plans/019c9088-c3da-751f-ad4f-06ef7c086342?tab=board',
        undefined,
      ),
    ).toBe('019c9088-c3da-751f-ad4f-06ef7c086342');
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

  it('should exclude TPM config reference data', () => {
    expect(shouldExclude('/api/v2/tpm/config/colors')).toBe(true);
    expect(shouldExclude('/api/v2/tpm/config/interval-colors')).toBe(true);
    expect(shouldExclude('/api/v2/tpm/locations')).toBe(true);
  });

  it('should exclude page init endpoints', () => {
    expect(shouldExclude('/api/v2/users/me')).toBe(true);
  });

  it('should exclude E2E key init endpoints', () => {
    expect(shouldExclude('/api/v2/e2e/keys/me')).toBe(true);
    expect(shouldExclude('/api/v2/e2e/escrow')).toBe(true);
  });

  it('should exclude SSE connection-ticket', () => {
    expect(shouldExclude('/api/v2/auth/connection-ticket')).toBe(true);
  });

  it('should exclude theme toggle', () => {
    expect(shouldExclude('/api/v2/settings/user/theme')).toBe(true);
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

// =============================================================
// determineAction
// =============================================================

describe('determineAction', () => {
  it('should return path-based action for auth/login', () => {
    const req = createMockRequest({ url: '/api/v2/auth/login' });

    expect(determineAction('POST', '/api/v2/auth/login', req)).toBe('login');
  });

  it('should return "create" for POST', () => {
    const req = createMockRequest();

    expect(determineAction('POST', '/api/v2/users', req)).toBe('create');
  });

  it('should return "update" for PUT', () => {
    const req = createMockRequest();

    expect(determineAction('PUT', '/api/v2/users/42', req)).toBe('update');
  });

  it('should return "update" for PATCH', () => {
    const req = createMockRequest();

    expect(determineAction('PATCH', '/api/v2/users/42', req)).toBe('update');
  });

  it('should return "delete" for DELETE', () => {
    const req = createMockRequest();

    expect(determineAction('DELETE', '/api/v2/users/42', req)).toBe('delete');
  });

  it('should return "export" for GET with /export', () => {
    const req = createMockRequest({ url: '/api/v2/users/export' });

    expect(determineAction('GET', '/api/v2/users/export', req)).toBe('export');
  });

  it('should return "view" for GET current-user endpoint', () => {
    const req = createMockRequest({ url: '/api/v2/users/me', params: {} });

    expect(determineAction('GET', '/api/v2/users/me', req)).toBe('view');
  });

  it('should return "view" for GET with numeric ID', () => {
    const req = createMockRequest({
      url: '/api/v2/users/42',
      params: { id: '42' },
    });

    expect(determineAction('GET', '/api/v2/users/42', req)).toBe('view');
  });

  it('should return "list" for GET without ID', () => {
    const req = createMockRequest({ url: '/api/v2/kvp/suggestions' });

    expect(determineAction('GET', '/api/v2/kvp/suggestions', req)).toBe('list');
  });

  it('should return "view" for HEAD with ID', () => {
    const req = createMockRequest({
      url: '/api/v2/users/42',
      params: { id: '42' },
    });

    expect(determineAction('HEAD', '/api/v2/users/42', req)).toBe('view');
  });

  it('should return "view" for unknown method', () => {
    const req = createMockRequest();

    expect(determineAction('TRACE', '/api/v2/users', req)).toBe('view');
  });
});

// =============================================================
// isCurrentUserEndpoint
// =============================================================

describe('isCurrentUserEndpoint', () => {
  it('should return true for /users/me', () => {
    expect(isCurrentUserEndpoint('/api/v2/users/me')).toBe(true);
  });

  it('should return true for /auth/me', () => {
    expect(isCurrentUserEndpoint('/api/v2/auth/me')).toBe(true);
  });

  it('should return true for /me (case-insensitive)', () => {
    expect(isCurrentUserEndpoint('/Me')).toBe(true);
  });

  it('should return false for normal paths', () => {
    expect(isCurrentUserEndpoint('/api/v2/users/42')).toBe(false);
  });
});

// =============================================================
// isAuthEndpoint
// =============================================================

describe('isAuthEndpoint', () => {
  it('should return true for /auth/login', () => {
    expect(isAuthEndpoint('/api/v2/auth/login')).toBe(true);
  });

  it('should return true for /auth/logout', () => {
    expect(isAuthEndpoint('/api/v2/auth/logout')).toBe(true);
  });

  it('should return true for /auth/refresh', () => {
    expect(isAuthEndpoint('/api/v2/auth/refresh')).toBe(true);
  });

  it('should return false for normal paths', () => {
    expect(isAuthEndpoint('/api/v2/users')).toBe(false);
  });
});

// =============================================================
// shouldSkipGetRequest
// =============================================================

describe('shouldSkipGetRequest', () => {
  it('should skip /stats endpoints', () => {
    expect(shouldSkipGetRequest('/api/v2/users/stats')).toBe(true);
  });

  it('should skip /count endpoints', () => {
    expect(shouldSkipGetRequest('/api/v2/notifications/count')).toBe(true);
  });

  it('should skip /search endpoints', () => {
    expect(shouldSkipGetRequest('/api/v2/users/search')).toBe(true);
  });

  it('should skip -count catch-all endpoints', () => {
    expect(shouldSkipGetRequest('/api/v2/notifications/unread-count')).toBe(
      true,
    );
  });

  it('should skip sub-resource data endpoints', () => {
    expect(shouldSkipGetRequest('/api/v2/tpm/plans/uuid/board')).toBe(true);
    expect(shouldSkipGetRequest('/api/v2/tpm/plans/uuid/time-estimates')).toBe(
      true,
    );
    expect(shouldSkipGetRequest('/api/v2/tpm/plans/interval-matrix')).toBe(
      true,
    );
    expect(shouldSkipGetRequest('/api/v2/tpm/plans/schedule-projection')).toBe(
      true,
    );
    expect(
      shouldSkipGetRequest('/api/v2/tpm/executions/eligible-participants'),
    ).toBe(true);
  });

  it('should not skip normal endpoints', () => {
    expect(shouldSkipGetRequest('/api/v2/kvp/42')).toBe(false);
  });

  it('should not skip /export (security-critical)', () => {
    expect(shouldSkipGetRequest('/api/v2/users/export')).toBe(false);
  });
});

// =============================================================
// buildAuditChanges
// =============================================================

describe('buildAuditChanges', () => {
  const httpMeta = {
    endpoint: '/api/v2/users',
    method: 'POST',
    status: 201,
    duration_ms: 42,
  };

  it('should include _http metadata for all actions', () => {
    const req = createMockRequest();

    const result = buildAuditChanges('login', req, httpMeta);

    expect(result._http).toEqual(httpMeta);
  });

  it('should add sanitized body for create action', () => {
    const req = createMockRequest({ body: { name: 'Test', password: 'sec' } });

    const result = buildAuditChanges('create', req, httpMeta);

    expect(result.created).toEqual({ name: 'Test', password: '[REDACTED]' });
  });

  it('should skip created field when body is null', () => {
    const req = createMockRequest({ body: null });

    const result = buildAuditChanges('create', req, httpMeta);

    expect(result.created).toBeUndefined();
  });

  it('should add previous and updated for update action', () => {
    const req = createMockRequest({ body: { name: 'New Name' } });
    const preMutation = { name: 'Old Name' };

    const result = buildAuditChanges('update', req, httpMeta, preMutation);

    expect(result.previous).toEqual({ name: 'Old Name' });
    expect(result.updated).toEqual({ name: 'New Name' });
  });

  it('should handle update without preMutationData', () => {
    const req = createMockRequest({ body: { name: 'New' } });

    const result = buildAuditChanges('update', req, httpMeta, null);

    expect(result.previous).toBeUndefined();
    expect(result.updated).toEqual({ name: 'New' });
  });

  it('should add deleted data for delete action', () => {
    const req = createMockRequest();
    const preMutation = { id: 42, name: 'Deleted User' };

    const result = buildAuditChanges('delete', req, httpMeta, preMutation);

    expect(result.deleted).toEqual({ id: 42, name: 'Deleted User' });
  });

  it('should handle delete without preMutationData', () => {
    const req = createMockRequest();

    const result = buildAuditChanges('delete', req, httpMeta, null);

    expect(result.deleted).toBeUndefined();
  });

  it('should add query params for list action', () => {
    const req = createMockRequest({ query: { page: '1', limit: '20' } });

    const result = buildAuditChanges('list', req, httpMeta);

    expect(result.query).toEqual({ page: '1', limit: '20' });
  });

  it('should skip query for list when empty', () => {
    const req = createMockRequest({ query: {} });

    const result = buildAuditChanges('list', req, httpMeta);

    expect(result.query).toBeUndefined();
  });

  it('should add resource_id for view action', () => {
    const req = createMockRequest({
      url: '/api/v2/users/42',
      params: { id: '42' },
    });

    const result = buildAuditChanges('view', req, httpMeta);

    expect(result.resource_id).toBe(42);
  });

  it('should add UUID as resource_id for view action with UUID URL', () => {
    const req = createMockRequest({
      url: '/api/v2/tpm/plans/019c9088-c3da-751f-ad4f-06ef7c086342',
      params: { uuid: '019c9088-c3da-751f-ad4f-06ef7c086342' },
    });

    const result = buildAuditChanges('view', req, httpMeta);

    expect(result.resource_id).toBe('019c9088-c3da-751f-ad4f-06ef7c086342');
  });
});

// =============================================================
// extractResourceName
// =============================================================

describe('extractResourceName', () => {
  it('should extract name field from body', () => {
    const req = createMockRequest({ body: { name: 'Test Department' } });

    expect(extractResourceName(req)).toBe('Test Department');
  });

  it('should try title field', () => {
    const req = createMockRequest({ body: { title: 'My Survey' } });

    expect(extractResourceName(req)).toBe('My Survey');
  });

  it('should try email field', () => {
    const req = createMockRequest({ body: { email: 'user@test.de' } });

    expect(extractResourceName(req)).toBe('user@test.de');
  });

  it('should return null for null body', () => {
    const req = createMockRequest({ body: null });

    expect(extractResourceName(req)).toBeNull();
  });

  it('should return null when no name fields present', () => {
    const req = createMockRequest({ body: { status: 'active' } });

    expect(extractResourceName(req)).toBeNull();
  });

  it('should truncate to 255 chars', () => {
    const longName = 'A'.repeat(300);
    const req = createMockRequest({ body: { name: longName } });

    expect(extractResourceName(req)?.length).toBe(255);
  });

  it('should skip empty string values', () => {
    const req = createMockRequest({ body: { name: '', title: 'Fallback' } });

    expect(extractResourceName(req)).toBe('Fallback');
  });
});

// =============================================================
// extractNameFromData
// =============================================================

describe('extractNameFromData', () => {
  it('should use mapped nameField for known resource type', () => {
    expect(extractNameFromData({ username: 'john_doe' }, 'user')).toBe(
      'john_doe',
    );
  });

  it('should use title for blackboard resource', () => {
    expect(
      extractNameFromData({ title: 'Wichtige Mitteilung' }, 'blackboard'),
    ).toBe('Wichtige Mitteilung');
  });

  it('should fall back to common name fields', () => {
    // user type maps to 'username', but if username is missing, try 'name'
    expect(extractNameFromData({ name: 'Fallback Name' }, 'user')).toBe(
      'Fallback Name',
    );
  });

  it('should return null for unknown resource type', () => {
    expect(extractNameFromData({ name: 'Test' }, 'unknown-type')).toBeNull();
  });

  it('should return null when mapped field is empty string', () => {
    expect(extractNameFromData({ username: '' }, 'user')).toBeNull();
  });

  it('should truncate to 255 chars', () => {
    const longName = 'B'.repeat(300);

    expect(extractNameFromData({ username: longName }, 'user')?.length).toBe(
      255,
    );
  });
});

// =============================================================
// extractLoginEmail
// =============================================================

describe('extractLoginEmail', () => {
  it('should extract email from request body', () => {
    const req = createMockRequest({ body: { email: 'admin@test.de' } });

    expect(extractLoginEmail(req)).toBe('admin@test.de');
  });

  it('should return null when no email in body', () => {
    const req = createMockRequest({ body: { username: 'admin' } });

    expect(extractLoginEmail(req)).toBeNull();
  });

  it('should return null for null body', () => {
    const req = createMockRequest({ body: null });

    expect(extractLoginEmail(req)).toBeNull();
  });

  it('should return null for empty email string', () => {
    const req = createMockRequest({ body: { email: '' } });

    expect(extractLoginEmail(req)).toBeNull();
  });
});

// =============================================================
// extractIpAddress
// =============================================================

describe('extractIpAddress', () => {
  it('should use X-Forwarded-For header', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': '10.0.0.1' },
    });

    expect(extractIpAddress(req)).toBe('10.0.0.1');
  });

  it('should take first IP from comma-separated list', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': '10.0.0.1, 172.16.0.1, 192.168.1.1' },
    });

    expect(extractIpAddress(req)).toBe('10.0.0.1');
  });

  it('should fall back to request.ip when no header', () => {
    const req = createMockRequest({ ip: '127.0.0.1' });

    expect(extractIpAddress(req)).toBe('127.0.0.1');
  });

  it('should fall back to request.ip for empty header', () => {
    const req = createMockRequest({
      headers: { 'x-forwarded-for': '' },
      ip: '192.168.1.1',
    });

    expect(extractIpAddress(req)).toBe('192.168.1.1');
  });
});

// =============================================================
// extractDetailedErrorMessage
// =============================================================

describe('extractDetailedErrorMessage', () => {
  it('should return "Unknown error" for null', () => {
    expect(extractDetailedErrorMessage(null)).toBe('Unknown error');
  });

  it('should return "Unknown error" for undefined', () => {
    expect(extractDetailedErrorMessage(undefined)).toBe('Unknown error');
  });

  it('should return message from Error instance', () => {
    expect(extractDetailedErrorMessage(new Error('Something broke'))).toBe(
      'Something broke',
    );
  });

  it('should return string error as-is', () => {
    expect(extractDetailedErrorMessage('raw error')).toBe('raw error');
  });

  it('should extract message from HttpException-like object', () => {
    const httpError = {
      getResponse: () => ({ message: 'User not found' }),
    };

    expect(extractDetailedErrorMessage(httpError)).toBe('User not found');
  });

  it('should format Zod validation errors', () => {
    const httpError = {
      getResponse: () => ({
        code: 'VALIDATION_ERROR',
        details: [
          { field: 'email', message: 'Invalid email' },
          { field: 'password', message: 'Too short' },
        ],
      }),
    };

    expect(extractDetailedErrorMessage(httpError)).toBe(
      'email: Invalid email; password: Too short',
    );
  });

  it('should handle Zod error with missing field', () => {
    const httpError = {
      getResponse: () => ({
        code: 'VALIDATION_ERROR',
        details: [{ message: 'Required' }],
      }),
    };

    expect(extractDetailedErrorMessage(httpError)).toBe('Required');
  });

  it('should handle Zod error with empty details', () => {
    const httpError = {
      getResponse: () => ({
        code: 'VALIDATION_ERROR',
        details: [],
      }),
    };

    expect(extractDetailedErrorMessage(httpError)).toBe('Validation failed');
  });

  it('should handle array message (class-validator style)', () => {
    const httpError = {
      getResponse: () => ({
        message: ['Field A is required', 'Field B must be number'],
      }),
    };

    expect(extractDetailedErrorMessage(httpError)).toBe(
      'Field A is required; Field B must be number',
    );
  });

  it('should return "Request failed" for non-object response', () => {
    const httpError = {
      getResponse: () => 'plain string',
    };

    expect(extractDetailedErrorMessage(httpError)).toBe('Request failed');
  });

  it('should return "Request failed" for object without message', () => {
    const httpError = {
      getResponse: () => ({ status: 500 }),
    };

    expect(extractDetailedErrorMessage(httpError)).toBe('Request failed');
  });

  it('should return "Unknown error" for non-Error, non-string object', () => {
    expect(extractDetailedErrorMessage({ foo: 'bar' })).toBe('Unknown error');
  });
});
