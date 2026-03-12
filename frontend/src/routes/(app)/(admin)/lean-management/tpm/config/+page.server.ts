/**
 * TPM Config Page - Server-Side Data Loading
 * @module lean-management/tpm/config/+page.server
 *
 * SSR: Loads escalation config, color config, and templates in parallel.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';

import type { PageServerLoad } from './$types';
import type {
  TpmColorConfigEntry,
  IntervalColorConfigEntry,
  CategoryColorConfigEntry,
  TpmEscalationConfig,
} from '../_lib/types';

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'tpm');

  const [escalationData, colorsData, intervalColorsData, categoryColorsData] =
    await Promise.all([
      apiFetch<TpmEscalationConfig>('/tpm/config/escalation', token, fetch),
      apiFetch<TpmColorConfigEntry[]>('/tpm/config/colors', token, fetch),
      apiFetch<IntervalColorConfigEntry[]>(
        '/tpm/config/interval-colors',
        token,
        fetch,
      ),
      apiFetch<CategoryColorConfigEntry[]>(
        '/tpm/config/category-colors',
        token,
        fetch,
      ),
    ]);

  return {
    escalation: escalationData ?? {
      escalationAfterHours: 48,
      notifyTeamLead: true,
      notifyDepartmentLead: false,
      createdAt: '',
      updatedAt: '',
    },
    colors: Array.isArray(colorsData) ? colorsData : [],
    intervalColors: Array.isArray(intervalColorsData) ? intervalColorsData : [],
    categoryColors: Array.isArray(categoryColorsData) ? categoryColorsData : [],
  };
};
