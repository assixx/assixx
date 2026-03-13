/**
 * Blackboard Archived - Server-Side Data Loading
 * @module blackboard/archived/+page.server
 *
 * Loads archived blackboard entries (is_active = 3)
 */
import { redirect } from '@sveltejs/kit';

import { apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';

const log = createLogger('BlackboardArchived');

interface ArchivedEntry {
  id: number;
  uuid: string;
  title: string;
  content: string;
  authorFullName: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  priority: string;
  orgLevel: string;
}

export const load: PageServerLoad = async ({ cookies, fetch, parent }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, '/login');
  }

  const { activeAddons } = await parent();
  requireAddon(activeAddons, 'blackboard');

  const result = await apiFetchWithPermission<ArchivedEntry[]>(
    '/blackboard/entries?isActive=3&limit=100',
    token,
    fetch,
  );

  if (result.permissionDenied) {
    return {
      permissionDenied: true as const,
      entries: [],
      error: null,
    };
  }

  const entries = Array.isArray(result.data) ? result.data : [];
  log.info({ count: entries.length }, 'Archived entries loaded');

  return {
    permissionDenied: false as const,
    entries,
    error: null,
  };
};
