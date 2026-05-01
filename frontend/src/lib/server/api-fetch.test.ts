/**
 * Unit tests for the shared server-side API fetch utility.
 *
 * Tests extractResponseData (pure function) and apiFetch (mocked fetch).
 * This module is used by 46+ page.server.ts files — bugs here are catastrophic.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  API_BASE,
  apiFetch,
  apiFetchPaginated,
  apiFetchWithPermission,
  extractResponseData,
} from './api-fetch';

// ─── extractResponseData ────────────────────────────────────────────────────

describe('extractResponseData', () => {
  describe('when response has success + data', () => {
    it('should extract data from { success: true, data: T }', () => {
      const result = extractResponseData({ success: true, data: [1, 2, 3] });
      expect(result).toEqual([1, 2, 3]);
    });

    it('should return null when success is true but data is undefined', () => {
      const result = extractResponseData({ success: true });
      expect(result).toBeNull();
    });

    it('should not extract data when success is false', () => {
      const json = { success: false, data: 'should-not-extract' };
      const result = extractResponseData(json);
      // Falls through to data check
      expect(result).toBe('should-not-extract');
    });
  });

  describe('when response has data without success', () => {
    it('should extract data from { data: T }', () => {
      const result = extractResponseData({ data: { id: 1, name: 'test' } });
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should handle data being an empty array', () => {
      const result = extractResponseData({ data: [] });
      expect(result).toEqual([]);
    });

    it('should handle data being 0 (falsy but defined)', () => {
      const result = extractResponseData({ data: 0 });
      expect(result).toBe(0);
    });

    it('should handle data being empty string (falsy but defined)', () => {
      const result = extractResponseData({ data: '' });
      expect(result).toBe('');
    });
  });

  describe('when response is raw (no envelope)', () => {
    it('should return the raw object as T', () => {
      const raw = { id: 1, name: 'direct' };
      const result = extractResponseData(raw as never);
      expect(result).toEqual({ id: 1, name: 'direct' });
    });

    it('should return raw array', () => {
      const raw = [1, 2, 3];
      const result = extractResponseData(raw as never);
      expect(result).toEqual([1, 2, 3]);
    });
  });

  describe('edge cases', () => {
    it('should handle null data in success response', () => {
      const result = extractResponseData({ success: true, data: null });
      expect(result).toBeNull();
    });

    it('should handle empty object', () => {
      const result = extractResponseData({});
      expect(result).toEqual({});
    });
  });
});

// ─── API_BASE ───────────────────────────────────────────────────────────────

describe('API_BASE', () => {
  it('should default to localhost:3000/api/v2', () => {
    expect(API_BASE).toBe('http://localhost:3000/api/v2');
  });
});

// ─── apiFetch ───────────────────────────────────────────────────────────────

/** Helper: creates a mock Response with a non-async json() resolver */
function mockResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  };
}

const TOKEN = 'test-token-123';
let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
});

describe('apiFetch – request construction', () => {
  it('should call fetch with correct URL and headers', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true, data: [] }));

    await apiFetch('/users', TOKEN, mockFetch as typeof fetch);

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/users`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  });
});

describe('apiFetch – success responses', () => {
  it('should return extracted data on success', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true, data: [{ id: 1 }] }));

    const result = await apiFetch<{ id: number }[]>('/items', TOKEN, mockFetch as typeof fetch);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('should handle raw array response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([1, 2, 3]));

    const result = await apiFetch<number[]>('/raw', TOKEN, mockFetch as typeof fetch);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should handle { data: T } without success field', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ data: { count: 42 } }));

    const result = await apiFetch<{ count: number }>('/stats', TOKEN, mockFetch as typeof fetch);
    expect(result).toEqual({ count: 42 });
  });
});

describe('apiFetch – error handling', () => {
  it('should return null on HTTP error', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 500));

    const result = await apiFetch('/broken', TOKEN, mockFetch as typeof fetch);
    expect(result).toBeNull();
  });

  it('should return null on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await apiFetch('/offline', TOKEN, mockFetch as typeof fetch);
    expect(result).toBeNull();
  });

  it('should return null on JSON parse error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    const result = await apiFetch('/bad-json', TOKEN, mockFetch as typeof fetch);
    expect(result).toBeNull();
  });
});

// ─── apiFetchWithPermission ─────────────────────────────────────────────────

describe('apiFetchWithPermission – request construction', () => {
  it('should call fetch with correct URL and headers', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true, data: [] }));

    await apiFetchWithPermission('/kvp', TOKEN, mockFetch as typeof fetch);

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/kvp`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  });
});

describe('apiFetchWithPermission – 403 detection', () => {
  it('should return permissionDenied: true on 403', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 403));

    const result = await apiFetchWithPermission('/kvp', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual({ data: null, permissionDenied: true });
  });

  it('should NOT flag permissionDenied on 401', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 401));

    const result = await apiFetchWithPermission('/kvp', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual({ data: null, permissionDenied: false });
  });

  it('should NOT flag permissionDenied on 404', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 404));

    const result = await apiFetchWithPermission(
      '/kvp/nonexistent',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result).toEqual({ data: null, permissionDenied: false });
  });

  it('should NOT flag permissionDenied on 500', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 500));

    const result = await apiFetchWithPermission('/kvp', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual({ data: null, permissionDenied: false });
  });
});

describe('apiFetchWithPermission – success responses', () => {
  it('should return extracted data from { success: true, data: T }', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true, data: [{ id: 1 }] }));

    const result = await apiFetchWithPermission<{ id: number }[]>(
      '/items',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result).toEqual({
      data: [{ id: 1 }],
      permissionDenied: false,
    });
  });

  it('should handle { data: T } without success field', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ data: { count: 42 } }));

    const result = await apiFetchWithPermission<{ count: number }>(
      '/stats',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result).toEqual({
      data: { count: 42 },
      permissionDenied: false,
    });
  });

  it('should handle raw array response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse([1, 2, 3]));

    const result = await apiFetchWithPermission<number[]>('/raw', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual({ data: [1, 2, 3], permissionDenied: false });
  });

  it('should return data: null for empty success response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true, data: null }));

    const result = await apiFetchWithPermission('/empty', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual({ data: null, permissionDenied: false });
  });
});

describe('apiFetchWithPermission – error handling', () => {
  it('should return permissionDenied: false on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await apiFetchWithPermission('/offline', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual({ data: null, permissionDenied: false });
  });

  it('should return permissionDenied: false on JSON parse error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    const result = await apiFetchWithPermission('/bad-json', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual({ data: null, permissionDenied: false });
  });
});

// ─── apiFetchPaginated ──────────────────────────────────────────────────────

/** Canonical ADR-007 paginated envelope used by most success-path tests. */
const PAGINATED_BODY = {
  success: true,
  data: [{ id: 1 }, { id: 2 }],
  meta: {
    pagination: { page: 2, limit: 25, total: 100, totalPages: 4 },
  },
  timestamp: '2026-05-02T00:00:00.000Z',
};

/**
 * Shape returned by every error path in `apiFetchPaginated`. Matches
 * `EMPTY_PAGINATION` in api-fetch.ts (page=1, limit=10, total/totalPages=0,
 * hasNext/hasPrev=false). Centralised here so a refactor of the empty
 * defaults is caught by every error-path test at once.
 */
const EMPTY_RESULT = {
  data: [],
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  },
};

describe('apiFetchPaginated – request construction', () => {
  it('should call fetch with correct URL and headers', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(PAGINATED_BODY));

    await apiFetchPaginated('/users?page=2', TOKEN, mockFetch as typeof fetch);

    expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/users?page=2`, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
  });
});

describe('apiFetchPaginated – success responses', () => {
  it('should preserve all meta.pagination fields and derive hasNext/hasPrev (mid page)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(PAGINATED_BODY));

    const result = await apiFetchPaginated<{ id: number }>(
      '/users?page=2&limit=25',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result).toEqual({
      data: [{ id: 1 }, { id: 2 }],
      pagination: {
        page: 2,
        limit: 25,
        total: 100,
        totalPages: 4,
        hasNext: true,
        hasPrev: true,
      },
    });
  });
});

describe('apiFetchPaginated – hasNext/hasPrev derivation', () => {
  it('should set hasPrev=false on first page', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        data: [{ id: 1 }],
        meta: { pagination: { page: 1, limit: 25, total: 100, totalPages: 4 } },
      }),
    );

    const result = await apiFetchPaginated<{ id: number }>(
      '/users',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result.pagination.hasPrev).toBe(false);
    expect(result.pagination.hasNext).toBe(true);
  });

  it('should set hasNext=false on last page', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        data: [{ id: 100 }],
        meta: { pagination: { page: 4, limit: 25, total: 100, totalPages: 4 } },
      }),
    );

    const result = await apiFetchPaginated<{ id: number }>(
      '/users?page=4',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(true);
  });

  it('should set both hasNext and hasPrev to false when only one page exists', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        data: [{ id: 1 }],
        meta: { pagination: { page: 1, limit: 25, total: 5, totalPages: 1 } },
      }),
    );

    const result = await apiFetchPaginated<{ id: number }>(
      '/users',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result.pagination.hasNext).toBe(false);
    expect(result.pagination.hasPrev).toBe(false);
  });
});

describe('apiFetchPaginated – empty result envelope', () => {
  it('should handle empty result envelope (total=0, totalPages=0)', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        data: [],
        meta: { pagination: { page: 1, limit: 25, total: 0, totalPages: 0 } },
      }),
    );

    const result = await apiFetchPaginated<{ id: number }>(
      '/users?search=nomatch',
      TOKEN,
      mockFetch as typeof fetch,
    );

    expect(result.data).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    });
  });
});

describe('apiFetchPaginated – HTTP error responses', () => {
  it('should return empty result on 400', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 400));

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  it('should return empty result on 401', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 401));

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  // 403 is the apiFetchWithPermission detection case — paginated callers that
  // need permission-aware UI compose apiFetchPaginated with apiFetchWithPermission
  // (or a future apiFetchPaginatedWithPermission). The paginated helper itself
  // returns the same empty-result structure regardless of which 4xx fired.
  it('should return empty result on 403 (apiFetchWithPermission compatibility)', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 403));

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  it('should return empty result on 500', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse(null, false, 500));

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });
});

describe('apiFetchPaginated – network/parse errors', () => {
  it('should return empty result on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  it('should return empty result on JSON parse error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.reject(new SyntaxError('Unexpected token')),
    });

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });
});

describe('apiFetchPaginated – malformed envelope: structural', () => {
  it('should return empty result when meta is missing entirely', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ success: true, data: [{ id: 1 }] }));

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  it('should return empty result when meta.pagination is missing', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({ success: true, data: [{ id: 1 }], meta: { timestamp: 'x' } }),
    );

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  it('should return empty result when data is not an array', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        data: { id: 1 },
        meta: { pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
      }),
    );

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  it('should return empty result when data is undefined', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        meta: { pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } },
      }),
    );

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });
});

describe('apiFetchPaginated – malformed envelope: field-level', () => {
  it('should return empty result when a pagination field has the wrong type', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        data: [{ id: 1 }],
        meta: { pagination: { page: '1', limit: 10, total: 1, totalPages: 1 } },
      }),
    );

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  it('should return empty result when a pagination field is missing', async () => {
    mockFetch.mockResolvedValueOnce(
      mockResponse({
        success: true,
        data: [{ id: 1 }],
        meta: { pagination: { page: 1, limit: 10, total: 1 } }, // totalPages omitted
      }),
    );

    const result = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });

  // Pre-Phase-3 dummy-users ships `{items, total, pageSize}` (masterplan §0.1).
  // This is the exact shape Phase 3.1 will fix; until then, our type-guards
  // must reject it cleanly with an empty result + warn log.
  it('should return empty result for pre-Phase-3 dummy-users shape', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ items: [{ id: 1 }], total: 50, pageSize: 20 }));

    const result = await apiFetchPaginated('/dummy-users', TOKEN, mockFetch as typeof fetch);

    expect(result).toEqual(EMPTY_RESULT);
  });
});

describe('apiFetchPaginated – invariants', () => {
  // Catches accidental refactor of `EMPTY_PAGINATION` / `emptyPaginatedResult`
  // into a shared-reference singleton: two consumers mutating the result
  // would corrupt each other.
  it('should return a fresh empty result per call (no shared reference)', async () => {
    mockFetch.mockResolvedValue(mockResponse(null, false, 500));

    const a = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);
    const b = await apiFetchPaginated('/x', TOKEN, mockFetch as typeof fetch);

    expect(a).not.toBe(b);
    expect(a.data).not.toBe(b.data);
    expect(a.pagination).not.toBe(b.pagination);
  });
});
