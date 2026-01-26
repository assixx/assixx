/**
 * Availability History - Server-Side Data Loading
 * @module manage-employees/availability/[uuid]/+page.server
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('AvailabilityHistory');
const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface AvailabilityEntry {
  id: number;
  employeeId: number;
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
  employee?: { id: number; uuid: string; firstName: string; lastName: string; email: string };
  entries?: AvailabilityEntry[];
}

interface ApiResponse {
  success: boolean;
  data: ApiResponseData;
}

/** Build API URL with optional year/month filters */
function buildApiUrl(uuid: string, year: string | null, month: string | null): string {
  const params = new URLSearchParams();
  if (year !== null && year !== '') params.set('year', year);
  if (month !== null && month !== '') params.set('month', month);
  const query = params.toString();
  return `${API_BASE}/users/uuid/${uuid}/availability/history${query !== '' ? `?${query}` : ''}`;
}

/** Create error response object */
function errorResponse(error: string, year: string | null, month: string | null) {
  return { employee: null, entries: [], error, currentYear: year, currentMonth: month };
}

/** Map entry to plain serializable object */
function serializeEntry(e: AvailabilityEntry) {
  return {
    id: e.id,
    employeeId: e.employeeId,
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
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      log.error({ status: response.status }, 'Failed to fetch availability history');
      return errorResponse('Fehler beim Laden der Verfügbarkeitshistorie', year, month);
    }

    const json = (await response.json()) as ApiResponse;
    const { data } = json;
    log.info({ count: data.entries?.length ?? 0 }, 'Availability history loaded');

    return {
      employee: data.employee ?? null,
      entries: (data.entries ?? []).map(serializeEntry),
      error: null,
      currentYear: year,
      currentMonth: month,
    };
  } catch (err) {
    log.error({ err }, 'Error fetching availability history');
    return errorResponse('Verbindungsfehler', year, month);
  }
};
