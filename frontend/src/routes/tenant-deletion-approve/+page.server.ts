/**
 * Tenant Deletion Approve - Server-Side Data Loading
 * @module tenant-deletion-approve/+page.server
 *
 * SSR: Loads deletion status and validates queueId. Only root users can access.
 * Note: This is a standalone page (no app layout).
 */
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ cookies, fetch, url }) => {
  const startTime = performance.now();

  // 1. Auth check
  const token = cookies.get('accessToken');
  if (!token) {
    redirect(302, '/login');
  }

  // 2. Get queueId from URL
  const queueIdParam = url.searchParams.get('queueId');
  if (!queueIdParam) {
    return {
      queueData: null,
      queueId: null,
      error: 'Keine Queue-ID in der URL gefunden',
    };
  }

  const queueId = Number.parseInt(queueIdParam, 10);
  if (Number.isNaN(queueId)) {
    return {
      queueData: null,
      queueId: null,
      error: 'Ungültige Queue-ID',
    };
  }

  // 3. Load deletion status
  try {
    const response = await fetch(`${API_BASE}/root/tenant/deletion-status`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    // 404 means no deletion found
    if (response.status === 404) {
      return {
        queueData: null,
        queueId,
        error: 'Keine Löschanfrage gefunden',
      };
    }

    if (!response.ok) {
      console.error(`[SSR] API error ${response.status} for /root/tenant/deletion-status`);
      return {
        queueData: null,
        queueId,
        error: 'Fehler beim Laden der Löschanfrage',
      };
    }

    const json = (await response.json()) as ApiResponse<DeletionStatusData> | DeletionStatusData;

    // Handle different response formats
    let statusData: DeletionStatusData | null = null;
    if ('queueId' in json) {
      statusData = json;
    } else if (json.data && 'queueId' in json.data) {
      statusData = json.data;
    }

    if (!statusData) {
      return {
        queueData: null,
        queueId,
        error: 'Keine Löschanfrage gefunden',
      };
    }

    // Verify queue ID matches
    if (statusData.queueId !== queueId) {
      return {
        queueData: null,
        queueId,
        error: 'Queue-ID stimmt nicht überein',
      };
    }

    // Check if user can approve
    if (!statusData.canApprove) {
      return {
        queueData: null,
        queueId,
        error: 'Sie können diese Löschanfrage nicht genehmigen (Zwei-Personen-Prinzip)',
      };
    }

    const duration = (performance.now() - startTime).toFixed(1);
    console.info(`[SSR] tenant-deletion-approve loaded in ${duration}ms`);

    return {
      queueData: statusData,
      queueId,
      error: null,
    };
  } catch (error) {
    console.error(`[SSR] Fetch error for /root/tenant/deletion-status:`, error);
    return {
      queueData: null,
      queueId,
      error: 'Fehler beim Laden der Löschanfrage',
    };
  }
};
