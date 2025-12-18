/**
 * Response Interceptor
 *
 * Transforms controller responses into standardized API format.
 * Wraps data in success: true, data: ... structure.
 */
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
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
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<SuccessResponse<T>> {
    return next.handle().pipe(
      map((data: T) => {
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
    // Support both 'items' and 'entries' as array property names
    const dataObj = data as Record<string, unknown>;
    const hasItems = 'items' in dataObj && Array.isArray(dataObj['items']);
    const hasEntries = 'entries' in dataObj && Array.isArray(dataObj['entries']);
    // If entries found, normalize to items for consistent handling
    if (hasEntries && !hasItems) {
      dataObj['items'] = dataObj['entries'];
    }
    return hasItems || hasEntries;
  }
}
