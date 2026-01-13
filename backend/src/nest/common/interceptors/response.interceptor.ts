/**
 * Response Interceptor
 *
 * Transforms controller responses into standardized API format.
 * Wraps data in success: true, data: ... structure.
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Standard API success response structure
 */
interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * Paginated response structure
 */
interface PaginatedData<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, SuccessResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data: T) => {
        // Skip wrapping for raw responses (strings, Buffers)
        // This allows endpoints like /metrics to return plain text
        if (typeof data === 'string' || Buffer.isBuffer(data)) {
          return data as unknown as SuccessResponse<T>;
        }

        // Skip wrapping ONLY for explicitly non-JSON Content-Types
        // Note: When contentType is not set (undefined) or empty, we assume JSON and wrap
        const response = context.switchToHttp().getResponse<FastifyReply>();
        const rawContentType = response.getHeader('content-type');
        // getHeader returns string | number | string[] | undefined
        // We only care about string values for Content-Type
        const contentType = typeof rawContentType === 'string' ? rawContentType : '';
        if (contentType !== '' && !contentType.includes('application/json')) {
          return data as unknown as SuccessResponse<T>;
        }

        // If data is already wrapped, don't wrap again
        if (this.isAlreadyWrapped(data)) {
          return data as unknown as SuccessResponse<T>;
        }

        // Check for pagination metadata
        if (this.isPaginatedResponse(data)) {
          return {
            success: true as const,
            data: data.items as unknown as T,
            meta: { pagination: data.pagination },
            timestamp: new Date().toISOString(),
          } as unknown as SuccessResponse<T>;
        }

        return {
          success: true as const,
          data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }

  private isAlreadyWrapped(data: unknown): boolean {
    return (
      data !== null &&
      typeof data === 'object' &&
      'success' in data &&
      typeof (data as { success: unknown }).success === 'boolean'
    );
  }

  private isPaginatedResponse(data: unknown): data is PaginatedData<unknown> {
    if (data === null || typeof data !== 'object' || !('pagination' in data)) {
      return false;
    }
    // Support 'items', 'entries', and 'data' as array property names
    const dataObj = data as Record<string, unknown>;
    const hasItems = 'items' in dataObj && Array.isArray(dataObj['items']);
    const hasEntries = 'entries' in dataObj && Array.isArray(dataObj['entries']);
    const hasData = 'data' in dataObj && Array.isArray(dataObj['data']);
    // Normalize all array properties to 'items' for consistent handling
    if (hasEntries && !hasItems) {
      dataObj['items'] = dataObj['entries'];
    }
    if (hasData && !hasItems) {
      dataObj['items'] = dataObj['data'];
    }
    return hasItems || hasEntries || hasData;
  }
}
