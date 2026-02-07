/**
 * Permission Management - Server-Side Data Loading (Employee Context)
 * @module manage-employees/permission/[uuid]/+page.server
 *
 * Loads employee data and permission tree from backend API.
 * Uses shared loader to avoid code duplication across manage pages.
 */
import { loadPermissionData } from '$lib/server/load-permission-data';

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies, fetch, params }) => {
  return await loadPermissionData({ cookies, fetch, params });
};
