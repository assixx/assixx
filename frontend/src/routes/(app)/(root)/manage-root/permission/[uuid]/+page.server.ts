/**
 * Permission Management - Server-Side Data Loading (Root User Context)
 * @module manage-root/permission/[uuid]/+page.server
 *
 * Loads root user data and permission tree from backend API.
 * Uses shared loader to avoid code duplication across manage pages.
 */
import { loadPermissionData } from '$lib/server/load-permission-data';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch, params }) => {
  return await loadPermissionData({ cookies, fetch, params });
};
