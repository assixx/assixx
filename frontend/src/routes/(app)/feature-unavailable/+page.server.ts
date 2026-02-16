/**
 * Feature Unavailable - Server-Side Data Loading
 * @module feature-unavailable/+page.server
 *
 * Minimal load - passes parent layout data for role-based redirect
 * and optional feature query param for specific messaging.
 */
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, url }) => {
  const parentData = await parent();
  return {
    userRole: parentData.user?.role ?? null,
    featureCode: url.searchParams.get('feature'),
  };
};
