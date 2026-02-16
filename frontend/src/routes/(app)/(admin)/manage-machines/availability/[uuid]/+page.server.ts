/**
 * Machine Availability History - Server-Side Data Loading
 * @module manage-machines/availability/[uuid]/+page.server
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('MachineAvailabilityHistory');
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface MachineAvailabilityEntry {
  id: number;
  machineId: number;
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

interface ApiResponseData {
  machine?: {
    id: number;
    uuid: string;
    name: string;
  };
  entries?: MachineAvailabilityEntry[];
}

interface ApiResponse {
  success: boolean;
  data: ApiResponseData;
}

/** Build API URL with optional year/month filters */
function buildApiUrl(
  uuid: string,
  year: string | null,
  month: string | null,
): string {
  const params = new URLSearchParams();
  if (year !== null && year !== '') params.set('year', year);
  if (month !== null && month !== '') params.set('month', month);
  const query = params.toString();
  return `${API_BASE}/machines/uuid/${uuid}/availability/history${query !== '' ? `?${query}` : ''}`;
}

/** Create error response object */
function errorResponse(
  error: string,
  year: string | null,
  month: string | null,
) {
  return {
    machine: null,
    entries: [],
    error,
    currentYear: year,
    currentMonth: month,
  };
}

/** Map entry to plain serializable object */
function serializeEntry(e: MachineAvailabilityEntry) {
  return {
    id: e.id,
    machineId: e.machineId,
    status: e.status,
    startDate: e.startDate,
    endDate: e.endDate,
    reason: e.reason,
    notes: e.notes,
    createdBy: e.createdBy,
    createdByName: e.createdByName,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

export const load: PageServerLoad = async ({ cookies, fetch, params, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') redirect(302, '/login');

  const { uuid } = params;
  const year = url.searchParams.get('year');
  const month = url.searchParams.get('month');

  try {
    const response = await fetch(buildApiUrl(uuid, year, month), {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      log.error(
        { status: response.status },
        'Failed to fetch machine availability history',
      );
      return errorResponse(
        'Fehler beim Laden der Maschinenverfügbarkeitshistorie',
        year,
        month,
      );
    }

    const json = (await response.json()) as ApiResponse;
    const { data } = json;
    log.info(
      { count: data.entries?.length ?? 0 },
      'Machine availability history loaded',
    );

    return {
      machine: data.machine ?? null,
      entries: (data.entries ?? []).map(serializeEntry),
      error: null,
      currentYear: year,
      currentMonth: month,
    };
  } catch (err) {
    log.error({ err }, 'Error fetching machine availability history');
    return errorResponse('Verbindungsfehler', year, month);
  }
};
