/**
 * Root Group Layout - Fail-Closed RBAC
 * @module (app)/(root)/+layout.server
 *
 * SECURITY: Only 'root' role can access routes in this group.
 * Uses parent() to get user data from (app)/+layout.server.ts.
 * Fail-closed: if role check fails for ANY reason, access is denied.
 *
 * @see ADR-012: Frontend Route Security Groups
 */
import { redirect } from '@sveltejs/kit';

import { createLogger } from '$lib/utils/logger';

import type { LayoutServerLoad } from './$types';

const log = createLogger('RootGroupLayout');

export const load: LayoutServerLoad = async ({ parent, url }) => {
  const { user } = await parent();

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defense-in-depth: parent guarantees user, but security checks must not rely on upstream alone
  if (user === null || user === undefined) {
    log.warn({ pathname: url.pathname }, 'RBAC(root): No user data, redirecting to login');
    redirect(302, '/login');
  }

  if (user.role !== 'root') {
    log.warn(
      { pathname: url.pathname, userRole: user.role },
      `RBAC(root): Access denied - ${user.role} tried to access root route`,
    );
    redirect(302, '/permission-denied');
  }

  log.debug({ pathname: url.pathname }, 'RBAC(root): Access granted');

  return {};
};
