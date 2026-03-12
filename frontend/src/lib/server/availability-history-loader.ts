/**
 * Shared Availability History Loader
 * @module lib/server/availability-history-loader
 *
 * Generic server-side loader for availability history pages.
 * Used by manage-employees, manage-admins, manage-root, and manage-assets.
 */
import { redirect } from '@sveltejs/kit';

import { API_BASE } from '$lib/server/api-fetch';
import { createLogger } from '$lib/utils/logger';

// =============================================================================
// TYPES
// =============================================================================

interface AvailabilityHistoryConfig {
  loggerName: string;
  /** API path segment before '/uuid/': 'users' or 'assets' */
  apiPathSegment: string;
  /** Key for the entity object in the API response data */
  entityKey: string;
  /** German error message shown when API request fails */
  errorMessage: string;
}

interface LoadParams {
  cookies: { get: (name: string) => string | undefined };
  fetch: typeof globalThis.fetch;
  params: { uuid: string };
  url: URL;
}

/** Entity shape returned by user availability endpoints */
export interface UserAvailabilityEntity {
  id: number;
  uuid: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Entity shape returned by asset availability endpoints */
export interface AssetAvailabilityEntity {
  id: number;
  uuid: string;
  name: string;
}

/** Common fields shared by all availability entry types */
export interface AvailabilityEntryBase {
  id: number;
  status: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  notes: string | null;
  createdBy: number | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityHistoryResult<TEntity> {
  entity: TEntity | null;
  entries: AvailabilityEntryBase[];
  error: string | null;
  currentYear: string | null;
  currentMonth: string | null;
}

interface ApiResponse {
  success: boolean;
  data: Record<string, unknown> & { entries?: AvailabilityEntryBase[] };
}

// =============================================================================
// HELPERS
// =============================================================================

function buildApiUrl(
  apiPathSegment: string,
  uuid: string,
  year: string | null,
  month: string | null,
): string {
  const params = new URLSearchParams();
  if (year !== null && year !== '') params.set('year', year);
  if (month !== null && month !== '') params.set('month', month);
  const query = params.toString();
  return `${API_BASE}/${apiPathSegment}/uuid/${uuid}/availability/history${query !== '' ? `?${query}` : ''}`;
}

// =============================================================================
// LOADER
// =============================================================================

export async function loadAvailabilityHistory<TEntity>(
  config: AvailabilityHistoryConfig,
  { cookies, fetch, params, url }: LoadParams,
): Promise<AvailabilityHistoryResult<TEntity>> {
  const log = createLogger(config.loggerName);
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const { uuid } = params;
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');
  const apiUrl = buildApiUrl(config.apiPathSegment, uuid, year, month);

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error(
        { status: response.status },
        `Failed to fetch ${config.entityKey} availability history`,
      );
      return {
        entity: null,
        entries: [],
        error: config.errorMessage,
        currentYear: year,
        currentMonth: month,
      };
    }

    const json = (await response.json()) as ApiResponse;
    const entries = json.data.entries ?? [];
    log.info(
      { count: entries.length },
      `${config.entityKey} availability history loaded`,
    );

    return {
      entity: (json.data[config.entityKey] ?? null) as TEntity | null,
      entries,
      error: null,
      currentYear: year,
      currentMonth: month,
    };
  } catch (err: unknown) {
    log.error(
      { err },
      `Error fetching ${config.entityKey} availability history`,
    );
    return {
      entity: null,
      entries: [],
      error: 'Verbindungsfehler',
      currentYear: year,
      currentMonth: month,
    };
  }
}
