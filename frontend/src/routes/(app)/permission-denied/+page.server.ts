/**
 * Permission Denied - Server-Side Data Loading
 * @module permission-denied/+page.server
 *
 * Minimal load - just passes parent layout data for role-based redirect.
 */
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const parentData = await parent();
  return {
    userRole: parentData.user?.role ?? null,
  };
};
