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
      log.error({ status: response.status, endpoint }, 'API error');
      return null;
    }

    const json = (await response.json()) as ServerApiResponse<T>;
    return extractResponseData(json);
  } catch (err: unknown) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}
