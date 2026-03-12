/**
 * Organigramm — Server-Side Data Loading
 * Root-only: RBAC enforced by (root) layout group
 */
import { redirect } from '@sveltejs/kit';

import { apiFetch } from '$lib/server/api-fetch';

import type { PageServerLoad } from './$types';
import type { OrgChartTree } from './_lib/types.js';

const EMPTY_TREE: OrgChartTree = {
  companyName: '',
  address: null,
  hierarchyLabels: {
    hall: 'Hallen',
    area: 'Bereiche',
    department: 'Abteilungen',
    team: 'Teams',
    asset: 'Anlagen',
  },
  viewport: { zoom: 1, panX: 0, panY: 0, fontSize: 13 },
  hallOverrides: {},
  canvasBg: null,
  nodes: [],
  halls: [],
};

export const load: PageServerLoad = async ({ cookies, fetch }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const tree = await apiFetch<OrgChartTree>('/organigram/tree', token, fetch);

  return {
    tree: tree ?? EMPTY_TREE,
    loadError: tree === null,
  };
};
