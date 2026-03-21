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

        // Check for pagination metadata
        if (this.isPaginatedResponse(data)) {
          const dataObj = data as Record<string, unknown>;
          return {
            success: true as const,
            data: this.extractPaginatedItems(dataObj) as unknown as T,
            meta: { pagination: dataObj['pagination'] },
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

  /** Check if response has pagination metadata */
  private isPaginatedResponse(data: unknown): boolean {
    if (data === null || typeof data !== 'object' || !('pagination' in data)) {
      return false;
    }
    const dataObj = data as Record<string, unknown>;
    return (
      ('items' in dataObj && Array.isArray(dataObj['items'])) ||
      ('entries' in dataObj && Array.isArray(dataObj['entries'])) ||
      ('data' in dataObj && Array.isArray(dataObj['data']))
    );
  }

  /** Extract items array from paginated response (supports items, entries, data) */
  private extractPaginatedItems(data: Record<string, unknown>): unknown[] {
    if ('items' in data && Array.isArray(data['items'])) return data['items'] as unknown[];
    if ('entries' in data && Array.isArray(data['entries'])) return data['entries'] as unknown[];
    if ('data' in data && Array.isArray(data['data'])) return data['data'] as unknown[];
    return [];
  }
}
