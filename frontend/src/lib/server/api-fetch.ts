/**
 * Shared Server-Side API Fetch Utility
 * @module lib/server/api-fetch
 *
 * Single source of truth for SSR data fetching from the backend API.
 * Used by all +page.server.ts load functions.
 *
 * GET-only by design: SSR load functions never POST/PUT/DELETE.
 * Mutations happen client-side via the ApiClient.
 */
import { createLogger } from '$lib/utils/logger';

const log = createLogger('ServerApiFetch');

/** Backend API base URL for server-side fetching */
export const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

/** Server-side API response shape (intentionally simpler than client-side ApiResponseWrapper) */
export interface ServerApiResponse<T> {
  success?: boolean;
  data?: T;
}

/**
 * Extract data from API response envelope.
 * Handles three formats the backend may return:
 * 1. `{ success: true, data: T }`
 * 2. `{ data: T }`
 * 3. `T` (raw, unwrapped)
 */
export function extractResponseData<T>(json: ServerApiResponse<T>): T | null {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
}

/**
 * Authenticated GET fetch for server-side load functions.
 *
 * Uses SvelteKit's fetch (passed as parameter) for correct cookie/proxy handling.
 * Returns null on any error (network, HTTP status, parse failure).
 * All errors are logged with endpoint context.
 */
/** Result of a permission-aware API fetch */
export interface PermissionCheckResult<T> {
  data: T | null;
  permissionDenied: boolean;
}

/**
 * Authenticated GET fetch that distinguishes 403 from other errors.
 *
 * Use this for the PRIMARY addon-gated endpoint in a page's load function.
 * Returns `{ permissionDenied: true }` on 403, so the page can show
 * "Keine Berechtigung" instead of misleading "no data" empty states.
 */
export async function apiFetchWithPermission<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<PermissionCheckResult<T>> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 403) {
      log.debug({ endpoint }, 'Permission denied (403)');
      return { data: null, permissionDenied: true };
    }

    if (!response.ok) {
      if (response.status >= 500) {
        log.error({ status: response.status, endpoint }, 'API server error');
      } else if (response.status === 401) {
        log.debug({ status: response.status, endpoint }, 'API auth denied');
      } else {
        log.warn({ status: response.status, endpoint }, 'API client error');
      }
      return { data: null, permissionDenied: false };
    }

    const json = (await response.json()) as ServerApiResponse<T>;
    return { data: extractResponseData(json), permissionDenied: false };
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return { data: null, permissionDenied: false };
  }
}

export async function apiFetch<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<T | null> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status >= 500) {
        log.error({ status: response.status, endpoint }, 'API server error');
      } else if (response.status === 401 || response.status === 403) {
        log.debug({ status: response.status, endpoint }, 'API auth/permission denied');
      } else {
        log.warn({ status: response.status, endpoint }, 'API client error');
      }
      return null;
    }

    const json = (await response.json()) as ServerApiResponse<T>;
    return extractResponseData(json);
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

// ============================================================================
// Paginated fetch — Phase 2 of FEAT_SERVER_DRIVEN_PAGINATION_MASTERPLAN
// ============================================================================

/**
 * Pagination metadata for paginated list responses.
 *
 * Backend ships `{ page, limit, total, totalPages }` inside `meta.pagination`
 * (ADR-007 envelope). `hasNext` / `hasPrev` are derived FE-side because the
 * backend spec deliberately omits them (Phase-0 sign-off 2026-05-01,
 * masterplan changelog 1.0.0).
 *
 * @see docs/FEAT_SERVER_DRIVEN_PAGINATION_MASTERPLAN.md §2.1
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Result of `apiFetchPaginated` — records plus full pagination metadata. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}

/**
 * Internal shape of the ADR-007 paginated envelope as it arrives from the
 * backend. Fields are intentionally `unknown` / optional so the runtime guards
 * in `apiFetchPaginated` are necessary, not redundant — JSON types are never
 * trusted blindly.
 */
interface RawPagination {
  page?: unknown;
  limit?: unknown;
  total?: unknown;
  totalPages?: unknown;
}

interface PaginatedEnvelope<T> {
  success?: boolean;
  data?: T[];
  meta?: {
    pagination?: RawPagination;
  };
}

/**
 * Default pagination metadata returned on any failure path. Consumers can
 * render a stable "no results" UI without branching on success/error —
 * `pagination.total === 0` is the single signal.
 */
const EMPTY_PAGINATION: PaginationMeta = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 0,
  hasNext: false,
  hasPrev: false,
};

function emptyPaginatedResult<T>(): PaginatedResult<T> {
  // Spread the constant so each call returns a fresh object — prevents
  // accidental cross-consumer mutation of a shared reference.
  return { data: [], pagination: { ...EMPTY_PAGINATION } };
}

/**
 * Log an HTTP failure using the same status-band routing as the sibling
 * helpers above: 5xx → error, 401/403 → debug (auth flows hit these by
 * design), other 4xx → warn. Factored out only to keep `apiFetchPaginated`
 * under the sonarjs cognitive-complexity budget; no DRY consolidation
 * with the existing helpers (R7: additive change only).
 */
function logHttpFailure(status: number, endpoint: string): void {
  if (status >= 500) {
    log.error({ status, endpoint }, 'API server error');
  } else if (status === 401 || status === 403) {
    log.debug({ status, endpoint }, 'API auth/permission denied');
  } else {
    log.warn({ status, endpoint }, 'API client error');
  }
}

/** Type-guard: every pagination field is present and a finite number. */
function isCompletePagination(
  p: RawPagination,
): p is { page: number; limit: number; total: number; totalPages: number } {
  return (
    typeof p.page === 'number' &&
    typeof p.limit === 'number' &&
    typeof p.total === 'number' &&
    typeof p.totalPages === 'number'
  );
}

/**
 * Authenticated GET fetch for paginated list endpoints.
 *
 * Reads the ADR-007 paginated envelope (`{ data: T[], meta: { pagination } }`)
 * and returns:
 * - `data`: records on the requested page
 * - `pagination`: backend metadata (page/limit/total/totalPages) plus
 *   FE-derived `hasNext` / `hasPrev`
 *
 * Returns an empty result on any failure (network, HTTP non-2xx, missing
 * `meta.pagination`, malformed types). All errors are logged with endpoint
 * context. The empty-result contract mirrors `apiFetch`'s null-on-failure
 * behaviour but as a structured value, so consumers never need special-case
 * failure branches.
 *
 * @see docs/FEAT_SERVER_DRIVEN_PAGINATION_MASTERPLAN.md §2.1
 * @see docs/infrastructure/adr/ADR-007-api-response-standardization.md
 */
export async function apiFetchPaginated<T>(
  endpoint: string,
  token: string,
  fetchFn: typeof fetch,
): Promise<PaginatedResult<T>> {
  try {
    const response = await fetchFn(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      logHttpFailure(response.status, endpoint);
      return emptyPaginatedResult<T>();
    }

    const json = (await response.json()) as PaginatedEnvelope<T>;
    const data = json.data;
    const rawPagination = json.meta?.pagination;

    if (!Array.isArray(data) || rawPagination === undefined) {
      log.warn({ endpoint }, 'Paginated response missing data array or meta.pagination');
      return emptyPaginatedResult<T>();
    }

    if (!isCompletePagination(rawPagination)) {
      log.warn({ endpoint }, 'Paginated response has malformed meta.pagination');
      return emptyPaginatedResult<T>();
    }

    const { page, limit, total, totalPages } = rawPagination;
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return emptyPaginatedResult<T>();
  }
}
