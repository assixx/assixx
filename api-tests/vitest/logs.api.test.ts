/**
 * Logs API Integration Tests
 *
 * Migrated from Bruno CLI: api-tests/logs/*.bru
 * Runs against REAL backend (Docker must be running).
 *
 * All 6 export requests are made in a single top-level beforeAll
 * with delays between each to avoid aggressive rate limiting on /logs/export.
 * Describe blocks contain only synchronous assertions against stored responses.
 *
 * @see vitest.config.api.ts
 */

import {
  BASE_URL,
  authOnly,
  flushThrottleKeys,
  loginBrunotest,
  type AuthState,
  type JsonBody,
} from './helpers.js';

// ─── Pre-fetched responses (populated in top-level beforeAll) ──────────────

interface StoredResponse {
  status: number;
  contentType: string;
  disposition: string;
  body?: JsonBody;
  text?: string;
}

const jsonExport: StoredResponse = { status: 0, contentType: '', disposition: '' };
const csvExport: StoredResponse = { status: 0, contentType: '', disposition: '' };
const txtExport: StoredResponse = { status: 0, contentType: '', disposition: '' };
const validationErr: StoredResponse = { status: 0, contentType: '', disposition: '' };
const dateRangeErr: StoredResponse = { status: 0, contentType: '', disposition: '' };
const auditTrail: StoredResponse = { status: 0, contentType: '', disposition: '' };

let auth: AuthState;

/**
 * Make all 6 export requests sequentially, flushing throttle keys between each.
 * ExportThrottle allows only 1 request per minute (see ADR-001).
 * Auth tokens are cached in-process, not in Redis -- flush is safe.
 */
beforeAll(async () => {
  auth = await loginBrunotest();
  const headers = authOnly(auth.authToken);

  const storeJson = async (url: string, target: StoredResponse): Promise<void> => {
    flushThrottleKeys();
    const res = await fetch(url, { headers });
    target.status = res.status;
    target.contentType = res.headers.get('content-type') ?? '';
    target.disposition = res.headers.get('content-disposition') ?? '';
    target.body = (await res.json()) as JsonBody;
  };

  const storeText = async (url: string, target: StoredResponse): Promise<void> => {
    flushThrottleKeys();
    const res = await fetch(url, { headers });
    target.status = res.status;
    target.contentType = res.headers.get('content-type') ?? '';
    target.disposition = res.headers.get('content-disposition') ?? '';
    target.text = await res.text();
  };

  // 1: JSON export
  await storeJson(
    `${BASE_URL}/logs/export?format=json&dateFrom=2026-01-01&dateTo=2026-01-31&source=all`,
    jsonExport,
  );

  // 2: CSV export
  await storeText(
    `${BASE_URL}/logs/export?format=csv&dateFrom=2026-01-01&dateTo=2026-01-31&source=all`,
    csvExport,
  );

  // 3: TXT export
  await storeText(
    `${BASE_URL}/logs/export?format=txt&dateFrom=2026-01-01&dateTo=2026-01-31&source=all`,
    txtExport,
  );

  // 4: Validation error (missing dateFrom)
  await storeJson(
    `${BASE_URL}/logs/export?format=json`,
    validationErr,
  );

  // 5: Date range too large
  await storeJson(
    `${BASE_URL}/logs/export?format=json&dateFrom=2024-01-01&dateTo=2026-01-31&source=all`,
    dateRangeErr,
  );

  // 6: Audit trail only
  await storeJson(
    `${BASE_URL}/logs/export?format=json&dateFrom=2026-01-01&dateTo=2026-01-31&source=audit_trail`,
    auditTrail,
  );
});

// ---- seq: 1 -- Export Logs (JSON) --------------------------------------------

describe('Logs: Export JSON', () => {
  it('should return 200 OK', () => {
    expect(jsonExport.status).toBe(200);
  });

  it('should return JSON content-type', () => {
    expect(jsonExport.contentType).toContain('application/json');
  });

  it('should have Content-Disposition header for download', () => {
    expect(jsonExport.disposition).toContain('attachment');
    expect(jsonExport.disposition).toContain('.json');
  });

  it('should return valid JSON array', () => {
    expect(Array.isArray(jsonExport.body)).toBe(true);
  });

  it('if entries exist, should have correct structure', () => {
    if (Array.isArray(jsonExport.body) && jsonExport.body.length > 0) {
      const entry = jsonExport.body[0] as JsonBody;
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
  it('should return 200 OK', () => {
    expect(csvExport.status).toBe(200);
  });

  it('should return CSV content-type', () => {
    expect(csvExport.contentType).toContain('text/csv');
  });

  it('should have Content-Disposition header for download', () => {
    expect(csvExport.disposition).toContain('attachment');
    expect(csvExport.disposition).toContain('.csv');
  });

  it('should have CSV header row', () => {
    const firstLine = (csvExport.text ?? '').split('\n')[0];

    expect(firstLine).toContain('ID');
    expect(firstLine).toContain('Timestamp');
    expect(firstLine).toContain('Source');
    expect(firstLine).toContain('Action');
  });
});

// ---- seq: 3 -- Export Logs (TXT) ---------------------------------------------

describe('Logs: Export TXT', () => {
  it('should return 200 OK', () => {
    expect(txtExport.status).toBe(200);
  });

  it('should return TXT content-type', () => {
    expect(txtExport.contentType).toContain('text/plain');
  });

  it('should have Content-Disposition header for download', () => {
    expect(txtExport.disposition).toContain('attachment');
    expect(txtExport.disposition).toContain('.txt');
  });

  it('should have ASSIXX AUDIT LOG EXPORT header', () => {
    expect(txtExport.text).toContain('ASSIXX AUDIT LOG EXPORT');
  });

  it('should have END OF EXPORT footer', () => {
    expect(txtExport.text).toContain('END OF EXPORT');
  });

  it('should have separator lines', () => {
    expect(txtExport.text).toContain('================');
  });
});

// ---- seq: 4 -- Export Logs (Validation Errors) -------------------------------

describe('Logs: Export Validation Errors', () => {
  it('should return 400 Bad Request when dateFrom is missing', () => {
    expect(validationErr.status).toBe(400);
  });

  it('should have error message about missing date', () => {
    // Zod validation error format
    expect(validationErr.body?.success).toBe(false);
  });
});

// ---- seq: 5 -- Export Logs (Date Range Too Large) ----------------------------

describe('Logs: Export Date Range Too Large', () => {
  it('should return 400 Bad Request for date range > 365 days', () => {
    expect(dateRangeErr.status).toBe(400);
  });

  it('should return success false', () => {
    expect(dateRangeErr.body?.success).toBe(false);
  });

  it('should have DATE_RANGE_TOO_LARGE error code', () => {
    expect(dateRangeErr.body?.error.code).toBe('DATE_RANGE_TOO_LARGE');
  });

  it('should have descriptive error message', () => {
    expect(dateRangeErr.body?.error.message).toContain('365');
  });
});

// ---- seq: 6 -- Export Audit Trail Only ---------------------------------------

describe('Logs: Export Audit Trail Only', () => {
  it('should return 200 OK', () => {
    expect(auditTrail.status).toBe(200);
    expect(auditTrail.contentType).toContain('application/json');
  });

  it('should return valid JSON array', () => {
    expect(Array.isArray(auditTrail.body)).toBe(true);
  });

  it('if entries exist, all should be from audit_trail source', () => {
    if (Array.isArray(auditTrail.body) && auditTrail.body.length > 0) {
      for (const entry of auditTrail.body) {
        // eslint-disable-next-line vitest/no-conditional-expect -- Integration test: source check only when entries exist
        expect((entry as JsonBody).source).toBe('audit_trail');
      }
    }
  });
});
