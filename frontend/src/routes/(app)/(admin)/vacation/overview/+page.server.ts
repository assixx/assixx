/**
 * Vacation Overview — Server-Side Data Loading
 * @module vacation/overview/+page.server
 *
 * SSR: Loads machines, blackouts, and staffing rules.
 * Teams are loaded client-side after machine selection (cascade).
 * Admin/root only (enforced by (admin) layout guard).
 */
import { redirect } from '@sveltejs/kit';

import { requireFeature } from '$lib/utils/feature-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type {
  BlackoutPeriod,
  MachineListItem,
  StaffingRule,
} from './_lib/types';

const log = createLogger('VacationOverview');

const API_BASE = process.env.API_URL ?? 'http://localhost:3000/api/v2';

interface ApiResponse<T> {
  success?: boolean;
  data?: T;
}

interface RawMachine {
  id: number;
  name: string;
  isActive: boolean;
}

interface RawBlackout {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isGlobal: boolean;
}

interface RawStaffingRule {
  id: string;
  machineId: number;
  machineName: string;
  minStaffCount: number;
}

/** Extract data from API response envelope. */
function extractResponseData<T>(json: ApiResponse<T>): T | null {
  if ('success' in json && json.success === true) {
    return json.data ?? null;
  }
  if ('data' in json && json.data !== undefined) {
    return json.data;
  }
  return json as unknown as T;
}

async function apiFetch<T>(
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

    const json = (await response.json()) as ApiResponse<T>;
    return extractResponseData(json);
  } catch (err) {
    log.error({ err, endpoint }, 'Fetch error');
    return null;
  }
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeFeatures } = await parent();
  requireFeature(activeFeatures, 'vacation');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  /** Fetch machines, blackouts, and staffing rules in parallel */
  const [machinesData, blackoutsData, staffingData] = await Promise.all([
    apiFetch<RawMachine[]>('/machines', token, fetch),
    apiFetch<RawBlackout[]>('/vacation/blackouts', token, fetch),
    apiFetch<RawStaffingRule[]>('/vacation/staffing-rules', token, fetch),
  ]);

  const machines: MachineListItem[] =
    machinesData
      ?.filter((m) => m.isActive || m.isActive === (1 as unknown as boolean))
      .map((m) => ({ id: m.id, name: m.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'de')) ?? [];

  const blackouts: BlackoutPeriod[] =
    blackoutsData?.map((b) => ({
      id: b.id,
      name: b.name,
      startDate: b.startDate,
      endDate: b.endDate,
      isGlobal: b.isGlobal,
    })) ?? [];

  const staffingRules: StaffingRule[] =
    staffingData?.map((r) => ({
      id: r.id,
      machineId: r.machineId,
      machineName: r.machineName,
      minStaffCount: r.minStaffCount,
    })) ?? [];

  return {
    machines,
    blackouts,
    staffingRules,
    currentYear,
    currentMonth,
  };
};
