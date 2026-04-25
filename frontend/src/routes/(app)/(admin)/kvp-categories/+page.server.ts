/**
 * KVP Categories Admin - Server-Side Data Loading
 *
 * SSR: Loads customizable categories for admin view.
 * Route group: (admin) - requires admin/root role (enforced by layout).
 */
import { redirect } from '@sveltejs/kit';

import { apiFetchWithPermission } from '$lib/server/api-fetch';
import { requireAddon } from '$lib/utils/addon-guard';
import { buildLoginUrl } from '$lib/utils/build-apex-url';
import { createLogger } from '$lib/utils/logger';

import type { PageServerLoad } from './$types';
import type { CustomizableCategoriesData } from './_lib/types';

const log = createLogger('KvpCategoriesPage');

export const load: PageServerLoad = async ({ cookies, fetch, parent, url }) => {
  const token = cookies.get('accessToken');
  if (token === undefined || token === '') {
    redirect(302, buildLoginUrl('session-expired', undefined, url));
  }

  const { user, activeAddons } = await parent();
  requireAddon(activeAddons, 'kvp');
  if (user !== null && user.role !== 'root' && !user.hasFullAccess) {
    log.warn(
      { role: user.role },
      'RBAC: Admin without has_full_access denied access to KVP categories',
    );
    redirect(302, '/permission-denied');
  }

  const result = await apiFetchWithPermission<CustomizableCategoriesData>(
    '/kvp/categories/customizable',
    token,
    fetch,
  );

  if (result.permissionDenied) {
    return {
      permissionDenied: true as const,
      categories: null,
      error: null,
    };
  }

  return {
    permissionDenied: false as const,
    categories: result.data,
    error: result.data === null ? 'Fehler beim Laden der Kategorien' : null,
  };
};
