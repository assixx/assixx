/**
 * Addon Unavailable - Server-Side Data Loading
 * @module addon-unavailable/+page.server
 *
 * Minimal load - passes parent layout data for role-based redirect
 * and optional addon query param for specific messaging.
 */
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
  const parentData = await parent();
  return {
    userRole: parentData.user?.role ?? null,
    addonCode: url.searchParams.get('addon'),
  };
};
