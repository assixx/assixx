/**
 * Unit tests for the shared server-side API fetch utility.
 *
 * Tests extractResponseData (pure function) and apiFetch (mocked fetch).
 * This module is used by 46+ page.server.ts files — bugs here are catastrophic.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { API_BASE, apiFetch, apiFetchWithPermission, extractResponseData } from './api-fetch';

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
