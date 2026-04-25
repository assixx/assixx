/**
 * Approval Settings — Server-Side Data Loading
 * @module admin/settings/approvals/+page.server
 *
 * RBAC: (admin) layout group = admin + root.
 * Loads approval configs from backend API.
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';
import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { ApprovalConfig, Area, Department, Team } from './_lib/types';

const log = createLogger('Settings:Approvals');

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  const parentData = await parent();
  const user = parentData.user;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defense-in-depth
  if (user === null || user === undefined) {
    log.warn('No user data');
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  const [configs, areas, departments, teams] = await Promise.all([
    apiFetch<ApprovalConfig[]>('/approvals/configs', token, fetch),
    apiFetch<Area[]>('/areas', token, fetch),
    apiFetch<Department[]>('/departments', token, fetch),
    apiFetch<Team[]>('/teams', token, fetch),
  ]);

  return {
    configs: Array.isArray(configs) ? configs : [],
    areas: Array.isArray(areas) ? areas : [],
    departments: Array.isArray(departments) ? departments : [],
    teams: Array.isArray(teams) ? teams : [],
  };
};
