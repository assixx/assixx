/**
 * Tests for ResponseInterceptor
 *
 * Phase 14C — Infrastructure tests
 * Tests success response wrapping, pass-through for raw data,
 * content-type handling, and pagination extraction.
 */
import { type Observable, of } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ResponseInterceptor } from './response.interceptor.js';

/** Create a mock ExecutionContext with configurable content-type header */
function createMockContext(contentType?: string): {
  switchToHttp: () => {
    getResponse: () => {
      getHeader: (name: string) => string | undefined;
    };
  };
  getHandler: () => ReturnType<typeof vi.fn>;
  getClass: () => ReturnType<typeof vi.fn>;
} {
  return {
    switchToHttp: () => ({
      getResponse: () => ({
        getHeader: (_name: string) => contentType,
      }),
    }),
    getHandler: () => vi.fn(),
    getClass: () => vi.fn(),
  };
}

/** Create a mock CallHandler that emits the given data */
function createMockCallHandler<T>(data: T): {
  handle: () => Observable<T>;
} {
  const observable = of(data);
  return { handle: () => observable };
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();

  describe('success wrapping', () => {
    it('should wrap object data in success envelope', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({ id: 1, name: 'Test' });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: { id: 1, name: 'Test' },
      });
    });

    it('should include ISO timestamp', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({ ok: true });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      const response = result as { timestamp: string };
      expect(response.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should wrap array data', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler([1, 2, 3]);

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: [1, 2, 3],
      });
    });

    it('should wrap null data', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler(null);

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: null,
      });
    });

    it('should wrap number data', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler(42);

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: 42,
      });
    });

    it('should wrap boolean data', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler(true);

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: true,
      });
    });
  });

  describe('pass-through for raw responses', () => {
    it('should pass through string data without wrapping', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler('plain text response');

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toBe('plain text response');
    });

    it('should pass through Buffer data without wrapping', async () => {
      const context = createMockContext();
      const buffer = Buffer.from('binary data');
      const handler = createMockCallHandler(buffer);

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toBe(buffer);
    });
  });

  describe('content-type handling', () => {
    it('should pass through when content-type is text/plain', async () => {
      const context = createMockContext('text/plain');
      const handler = createMockCallHandler({ metrics: 'data' });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toEqual({ metrics: 'data' });
    });

    it('should pass through when content-type is text/csv', async () => {
      const context = createMockContext('text/csv');
      const handler = createMockCallHandler({ csv: 'content' });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toEqual({ csv: 'content' });
    });

    it('should wrap when content-type is application/json', async () => {
      const context = createMockContext('application/json');
      const handler = createMockCallHandler({ wrapped: true });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: { wrapped: true },
      });
    });

    it('should wrap when content-type is application/json; charset=utf-8', async () => {
      const context = createMockContext('application/json; charset=utf-8');
      const handler = createMockCallHandler({ wrapped: true });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: { wrapped: true },
      });
    });

    it('should wrap when content-type is undefined (assume JSON)', async () => {
      const context = createMockContext(undefined);
      const handler = createMockCallHandler({ data: 'json' });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      expect(result).toMatchObject({
        success: true,
        data: { data: 'json' },
      });
    });

    it('should wrap when content-type header returns number', async () => {
      // getHeader can return string | number | string[] | undefined
      const context = {
        switchToHttp: () => ({
          getResponse: () => ({
            getHeader: () => 42, // edge case: number type
          }),
        }),
        getHandler: () => vi.fn(),
        getClass: () => vi.fn(),
      };
      const handler = createMockCallHandler({ id: 1 });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      // Number is not a string, so contentType becomes '', which is treated as JSON → wrap
      expect(result).toMatchObject({
        success: true,
        data: { id: 1 },
      });
    });
  });

  describe('pagination handling', () => {
    it('should extract items from paginated response', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({
        items: [{ id: 1 }, { id: 2 }],
        pagination: { page: 1, total: 2 },
      });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      const response = result as unknown as {
        success: true;
        data: unknown[];
        meta: { pagination: unknown };
      };
      expect(response.success).toBe(true);
      expect(response.data).toEqual([{ id: 1 }, { id: 2 }]);
      expect(response.meta.pagination).toEqual({ page: 1, total: 2 });
    });

    it('should extract entries from paginated response', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({
        entries: [{ name: 'A' }],
        pagination: { offset: 0 },
      });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      const response = result as { data: unknown[] };
      expect(response.data).toEqual([{ name: 'A' }]);
    });

    it('should extract data array from paginated response', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({
        data: [10, 20, 30],
        pagination: { cursor: 'abc' },
      });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      const response = result as { data: unknown[] };
      expect(response.data).toEqual([10, 20, 30]);
    });

    it('should prioritize items over entries and data', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({
        items: ['first'],
        entries: ['second'],
        data: ['third'],
        pagination: { total: 1 },
      });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      const response = result as { data: unknown[] };
      expect(response.data).toEqual(['first']);
    });

    it('should return empty array when pagination exists but no known array key', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({
        results: ['unknown-key'],
        pagination: { total: 1 },
      });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      // has pagination but no items/entries/data array → not treated as paginated
      // isPaginatedResponse returns false → normal wrapping
      const response = result as { success: true; data: unknown };
      expect(response.success).toBe(true);
      expect(response.data).toEqual({
        results: ['unknown-key'],
        pagination: { total: 1 },
      });
    });
  });

  describe('extractPaginatedItems (private)', () => {
    it('should return empty array when no items/entries/data key present', () => {
      const result = interceptor['extractPaginatedItems']({
        pagination: { total: 0 },
        results: ['unknown-key'],
      });

      expect(result).toEqual([]);
    });
  });

  describe('isPaginatedResponse edge cases', () => {
    it('should not treat response without pagination key as paginated', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({
        items: [1, 2, 3],
      });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      // No pagination key → standard wrapping
      const response = result as { success: true; data: { items: number[] } };
      expect(response.data).toEqual({ items: [1, 2, 3] });
    });

    it('should not treat non-array items as paginated', async () => {
      const context = createMockContext();
      const handler = createMockCallHandler({
        items: 'not-an-array',
        entries: 42,
        data: null,
        pagination: { total: 0 },
      });

      const result = await firstValueFrom(
        interceptor.intercept(context as never, handler as never),
      );

      // items/entries/data are not arrays → isPaginatedResponse returns false
      const response = result as { success: true; data: unknown };
      expect(response.success).toBe(true);
    });
  });
});
