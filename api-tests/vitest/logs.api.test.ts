/**
 * Logs API Integration Tests
 *
 * Migrated from Bruno CLI: api-tests/logs/*.bru
 * Runs against REAL backend (Docker must be running).
 *
 * Rate-limit friendly: each describe block makes ONE request in beforeAll,
 * then all it() blocks assert against the stored response.
 * Total: 6 HTTP requests (matches the 6 Bruno .bru files).
 *
 * @see vitest.config.api.ts
 */

import {
  BASE_URL,
  authOnly,
  fetchWithRetry,
  loginBrunotest,
  type AuthState,
  type JsonBody,
} from './helpers.js';

let auth: AuthState;

beforeAll(async () => {
  auth = await loginBrunotest();
});

// ---- seq: 1 -- Export Logs (JSON) --------------------------------------------

describe('Logs: Export JSON', () => {
  let res: Response;
  let body: JsonBody;
  let disposition: string;

  beforeAll(async () => {
    res = await fetchWithRetry(
      `${BASE_URL}/logs/export?format=json&dateFrom=2026-01-01&dateTo=2026-01-31&source=all`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
    disposition = res.headers.get('content-disposition') ?? '';
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return JSON content-type', () => {
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('should have Content-Disposition header for download', () => {
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('.json');
  });

  it('should return valid JSON array', () => {
    expect(Array.isArray(body)).toBe(true);
  });

  it('if entries exist, should have correct structure', () => {
    if (Array.isArray(body) && body.length > 0) {
      const entry = body[0] as JsonBody;
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: structure check only when entries exist
      expect(entry).toHaveProperty('id');
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: structure check only when entries exist
      expect(entry).toHaveProperty('timestamp');
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: structure check only when entries exist
      expect(entry).toHaveProperty('tenantId');
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: structure check only when entries exist
      expect(entry).toHaveProperty('userId');
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: structure check only when entries exist
      expect(entry).toHaveProperty('action');
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: structure check only when entries exist
      expect(entry).toHaveProperty('source');
      // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: structure check only when entries exist
      expect(['audit_trail', 'root_logs']).toContain(entry.source);
    }
  });
});

// ---- seq: 2 -- Export Logs (CSV) ---------------------------------------------

describe('Logs: Export CSV', () => {
  let res: Response;
  let text: string;
  let disposition: string;

  beforeAll(async () => {
    res = await fetchWithRetry(
      `${BASE_URL}/logs/export?format=csv&dateFrom=2026-01-01&dateTo=2026-01-31&source=all`,
      { headers: authOnly(auth.authToken) },
    );
    text = await res.text();
    disposition = res.headers.get('content-disposition') ?? '';
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return CSV content-type', () => {
    expect(res.headers.get('content-type')).toContain('text/csv');
  });

  it('should have Content-Disposition header for download', () => {
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('.csv');
  });

  it('should have CSV header row', () => {
    const firstLine = text.split('\n')[0];

    expect(firstLine).toContain('ID');
    expect(firstLine).toContain('Timestamp');
    expect(firstLine).toContain('Source');
    expect(firstLine).toContain('Action');
  });
});

// ---- seq: 3 -- Export Logs (TXT) ---------------------------------------------

describe('Logs: Export TXT', () => {
  let res: Response;
  let text: string;
  let disposition: string;

  beforeAll(async () => {
    res = await fetchWithRetry(
      `${BASE_URL}/logs/export?format=txt&dateFrom=2026-01-01&dateTo=2026-01-31&source=all`,
      { headers: authOnly(auth.authToken) },
    );
    text = await res.text();
    disposition = res.headers.get('content-disposition') ?? '';
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
  });

  it('should return TXT content-type', () => {
    expect(res.headers.get('content-type')).toContain('text/plain');
  });

  it('should have Content-Disposition header for download', () => {
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('.txt');
  });

  it('should have ASSIXX AUDIT LOG EXPORT header', () => {
    expect(text).toContain('ASSIXX AUDIT LOG EXPORT');
  });

  it('should have END OF EXPORT footer', () => {
    expect(text).toContain('END OF EXPORT');
  });

  it('should have separator lines', () => {
    expect(text).toContain('================');
  });
});

// ---- seq: 4 -- Export Logs (Validation Errors) -------------------------------

describe('Logs: Export Validation Errors', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetchWithRetry(
      `${BASE_URL}/logs/export?format=json`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 400 Bad Request when dateFrom is missing', () => {
    expect(res.status).toBe(400);
  });

  it('should have error message about missing date', () => {
    // Zod validation error format
    expect(body.success).toBe(false);
  });
});

// ---- seq: 5 -- Export Logs (Date Range Too Large) ----------------------------

describe('Logs: Export Date Range Too Large', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetchWithRetry(
      `${BASE_URL}/logs/export?format=json&dateFrom=2024-01-01&dateTo=2026-01-31&source=all`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 400 Bad Request for date range > 365 days', () => {
    expect(res.status).toBe(400);
  });

  it('should return success false', () => {
    expect(body.success).toBe(false);
  });

  it('should have DATE_RANGE_TOO_LARGE error code', () => {
    expect(body.error.code).toBe('DATE_RANGE_TOO_LARGE');
  });

  it('should have descriptive error message', () => {
    expect(body.error.message).toContain('365');
  });
});

// ---- seq: 6 -- Export Audit Trail Only ---------------------------------------

describe('Logs: Export Audit Trail Only', () => {
  let res: Response;
  let body: JsonBody;

  beforeAll(async () => {
    res = await fetchWithRetry(
      `${BASE_URL}/logs/export?format=json&dateFrom=2026-01-01&dateTo=2026-01-31&source=audit_trail`,
      { headers: authOnly(auth.authToken) },
    );
    body = (await res.json()) as JsonBody;
  });

  it('should return 200 OK', () => {
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('should return valid JSON array', () => {
    expect(Array.isArray(body)).toBe(true);
  });

  it('if entries exist, all should be from audit_trail source', () => {
    if (Array.isArray(body) && body.length > 0) {
      for (const entry of body) {
        // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: source check only when entries exist
        expect((entry as JsonBody).source).toBe('audit_trail');
      }
    }
  });
});
