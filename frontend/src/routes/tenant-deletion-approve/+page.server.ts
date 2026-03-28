/**
 * Tenant Deletion Approve - Server-Side Data Loading
 * @module tenant-deletion-approve/+page.server
 *
 * SSR: Loads deletion status and validates queueId. Only root users can access.
 * Note: This is a standalone page (no app layout).
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('TenantDeletionApprove');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface DeletionStatusData {
  queueId: number;
  tenantId: number;
  status: string;
  requestedBy: number;
  requestedByName?: string;
  canApprove: boolean;
}

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

interface LoadResult {
  queueData: DeletionStatusData | null;
  queueId: number | null;
  error: string | null;
}

/** Creates an error result with consistent structure */
function errorResult(queueId: number | null, error: string): LoadResult {
  return { queueData: null, queueId, error };
}

type ParseResult = { success: true; queueId: number } | { success: false; error: string };

/** Parses and validates the queueId from URL search params */
function parseQueueId(url: URL): ParseResult {
  const queueIdParam = url.searchParams.get('queueId');
  if (queueIdParam === null) {
    return { success: false, error: 'Keine Queue-ID in der URL gefunden' };
  }

  const queueId = Number.parseInt(queueIdParam, 10);
  if (Number.isNaN(queueId)) {
    return { success: false, error: 'Ungültige Queue-ID' };
  }

  return { success: true, queueId };
}

/** Extracts DeletionStatusData from various API response formats */
function extractStatusData(
  json: ApiResponse<DeletionStatusData> | DeletionStatusData,
): DeletionStatusData | null {
  if ('queueId' in json) {
    return json;
  }
  if (json.data !== undefined && 'queueId' in json.data) {
    return json.data;
  }
  return null;
}

/** Validates the status data against business rules */
function validateStatusData(
  statusData: DeletionStatusData,
  expectedQueueId: number,
): string | null {
  if (statusData.queueId !== expectedQueueId) {
    return 'Queue-ID stimmt nicht überein';
  }
  if (!statusData.canApprove) {
    return 'Sie können diese Löschanfrage nicht genehmigen (Zwei-Personen-Prinzip)';
  }
  return null;
}

/** Fetches deletion status from API */
async function fetchDeletionStatus(
  fetchFn: typeof fetch,
  token: string,
  queueId: number,
): Promise<LoadResult> {
  const response = await fetchFn(`${API_BASE}/root/tenant/deletion-status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 404) {
    return errorResult(queueId, 'Keine Löschanfrage gefunden');
  }

  if (!response.ok) {
    log.error({ status: response.status, endpoint: '/root/tenant/deletion-status' }, 'API error');
    return errorResult(queueId, 'Fehler beim Laden der Löschanfrage');
  }

  const json = (await response.json()) as ApiResponse<DeletionStatusData> | DeletionStatusData;
  const statusData = extractStatusData(json);

  if (statusData === null) {
    return errorResult(queueId, 'Keine Löschanfrage gefunden');
  }

  const validationError = validateStatusData(statusData, queueId);
  if (validationError !== null) {
    return errorResult(queueId, validationError);
  }

  return { queueData: statusData, queueId, error: null };
}

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined) {
    redirect(302, '/login');
  }

  const parseResult = parseQueueId(url);
  if (!parseResult.success) {
    return errorResult(null, parseResult.error);
  }

  const { queueId } = parseResult;

  try {
    return await fetchDeletionStatus(fetch, token, queueId);
  } catch (err: unknown) {
    log.error({ err, endpoint: '/root/tenant/deletion-status' }, 'Fetch error');
    return errorResult(queueId, 'Fehler beim Laden der Löschanfrage');
  }
};
